-- This file is part of Tally.
--
-- Copyright (C) 2026 Tally contributors
--
-- Tally is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as
-- published by the Free Software Foundation, version 3 of the
-- License.
--
-- Tally is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with Tally. If not, see <https://www.gnu.org/licenses/>.

-- Counter Copy Sharing protocol boundary.
-- All browser-facing sharing access is through role-specific SECURITY DEFINER
-- functions. The base table remains RLS-protected and is not a Data API.

alter table public.counter_shares
  add column if not exists state text not null default 'Pending',
  add column if not exists terminal_at timestamptz,
  add column if not exists offered_script boolean not null default false,
  add column if not exists offered_customization boolean not null default false,
  add column if not exists sender_acknowledged boolean not null default false;

update public.counter_shares
set state = case
  when accepted is true then 'Accepted'
  when accepted is false and response_reason = 'sharing_disabled' then 'Receiving disabled'
  when accepted is false then 'Declined'
  else 'Pending'
end,
terminal_at = case when accepted is null then null else coalesce(created_at, now()) end,
offered_script = counter_script is not null,
offered_customization = counter_customization is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'counter_shares_state_check'
      and conrelid = 'public.counter_shares'::regclass
  ) then
    alter table public.counter_shares add constraint counter_shares_state_check check (
      state in ('Pending','Accepted','Declined','Receiving disabled')
      and ((state = 'Pending' and accepted is null)
        or (state = 'Accepted' and accepted is true)
        or (state in ('Declined','Receiving disabled') and accepted is false))
    );
  end if;
end;
$$;

create index if not exists counter_shares_recipient_state_idx
  on public.counter_shares (recipient_id, state, created_at desc);
create index if not exists counter_shares_sender_state_idx
  on public.counter_shares (sender_id, state, created_at desc);

create or replace function private.sync_counter_share_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state <> 'Pending' and new.state <> old.state then
    raise exception 'Counter Copy outcome is terminal';
  end if;
  if new.accepted is true then new.state := 'Accepted'; end if;
  if new.accepted is false then
    new.state := case when new.response_reason = 'sharing_disabled' then 'Receiving disabled' else 'Declined' end;
  end if;
  if new.state <> 'Pending' and new.terminal_at is null then new.terminal_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists sync_counter_share_state on public.counter_shares;
create trigger sync_counter_share_state
before update on public.counter_shares
for each row execute function private.sync_counter_share_state();
revoke execute on function private.sync_counter_share_state()
  from public, anon, authenticated;

create table if not exists private.counter_copy_claims (
  share_id bigint primary key references public.counter_shares(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null unique,
  destination_id uuid not null,
  mode text not null check (mode in ('local','non_local')),
  status text not null check (status in ('claimed','accepted')),
  include_script boolean not null default false,
  include_customization boolean not null default false,
  delivery_token_hash text,
  delivery_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.counter_copy_claims from public, anon, authenticated;

create or replace function private.copy_number(value jsonb, label text)
returns numeric
language plpgsql immutable set search_path = '' as $$
declare raw text;
begin
  if value is null or jsonb_typeof(value) not in ('number','string') then raise exception '% must be finite', label; end if;
  raw := value #>> '{}';
  if raw !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception '% must be finite', label; end if;
  begin return raw::numeric;
  exception when numeric_value_out_of_range then raise exception '% must be finite', label;
  end;
end;
$$;
revoke execute on function private.copy_number(jsonb,text) from public, anon, authenticated;

create or replace function private.normalize_copy_counter(source jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  name text; direction text; color text; value numeric; start_value numeric;
  plus_step numeric; minus_step numeric; minimum numeric; maximum numeric; goal numeric;
  goals jsonb := '[]'::jsonb; item jsonb;
begin
  if jsonb_typeof(source) <> 'object' then raise exception 'Source counter is malformed'; end if;
  name := coalesce(nullif(trim(source->>'name'), ''), 'Untitled counter');
  value := private.copy_number(source->'value', 'Value');
  start_value := private.copy_number(source->'start', 'Starting value');
  plus_step := abs(private.copy_number(source->'plusStep', 'Positive step')); if plus_step = 0 then plus_step := 1; end if;
  minus_step := abs(private.copy_number(source->'minusStep', 'Negative step')); if minus_step = 0 then minus_step := 1; end if;
  minimum := case when source->'min' is null or source->'min' = 'null'::jsonb then null else private.copy_number(source->'min','Minimum') end;
  maximum := case when source->'max' is null or source->'max' = 'null'::jsonb then null else private.copy_number(source->'max','Maximum') end;
  if minimum is not null and maximum is not null and minimum > maximum then
    goal := minimum; minimum := maximum; maximum := goal;
  end if;
  value := greatest(coalesce(minimum,'-Infinity'::numeric), least(coalesce(maximum,'Infinity'::numeric), value));
  start_value := greatest(coalesce(minimum,'-Infinity'::numeric), least(coalesce(maximum,'Infinity'::numeric), start_value));
  if source->'goals' is not null and source->'goals' <> 'null'::jsonb then
    if jsonb_typeof(source->'goals') <> 'array' then raise exception 'Goals are malformed'; end if;
    for item in select goal_item from jsonb_array_elements(source->'goals') as goals(goal_item) loop
      goal := private.copy_number(item, 'Goal');
      if not exists (select 1 from jsonb_array_elements(goals) existing where private.copy_number(existing,'Goal') = goal) then goals := goals || jsonb_build_array(goal); end if;
    end loop;
  end if;
  direction := source->>'goalDirection';
  if direction not in ('more','less') then raise exception 'Goal direction is invalid'; end if;
  color := source->>'color';
  if color is null or color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color is invalid'; end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'name',name,'value',value,'start',start_value,'plusStep',plus_step,
    'minusStep',minus_step,'min',minimum,'max',maximum,'goals',goals,
    'goalDirection',direction,'color',color
  ));
end;
$$;
revoke execute on function private.normalize_copy_counter(jsonb) from public, anon, authenticated;

create or replace function private.stopped_copy_script(source jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if source is null or coalesce(jsonb_typeof(source),'') <> 'object'
     or source->'source' is null or jsonb_typeof(source->'source') <> 'string'
     or source->>'language' is null or source->>'language' not in ('tallyscript','javascript') then
    raise exception 'Linked script is malformed';
  end if;
  return jsonb_build_object('source',source->>'source','language',source->>'language','enabled',false);
end;
$$;
revoke execute on function private.stopped_copy_script(jsonb) from public, anon, authenticated;

-- Source-bound offer creation. Client counter JSON is intentionally absent.
drop function if exists public.send_counter_copy_from_source(text,text,boolean,boolean,text);
create function public.send_counter_copy_from_source(
  recipient_identifier text,
  source_counter_id text,
  include_script boolean default false,
  include_customization boolean default false,
  sharing_pin text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sender uuid := (select auth.uid()); recipient uuid; recipient_enabled boolean;
  profile public.profiles%rowtype; workspace public.user_data%rowtype; source jsonb;
  snapshot jsonb; linked_script jsonb; linked_customization jsonb; share_id bigint;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  select * into profile from public.profiles where id = sender;
  if not profile.copy_sharing_enabled then raise exception 'Copy sharing is disabled'; end if;
  if profile.copy_sharing_pin_enabled then
    if sharing_pin is null or not exists (select 1 from private.copy_sharing_secrets secret
      where secret.user_id = sender and extensions.crypt(sharing_pin, secret.pin_hash) = secret.pin_hash) then
      raise exception 'Incorrect sharing PIN';
    end if;
  end if;
  select id into recipient from public.profiles where username = lower(trim(recipient_identifier));
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users where lower(email) = lower(trim(recipient_identifier));
  end if;
  if recipient is null or recipient = sender then raise exception 'Invalid recipient'; end if;
  select copy_sharing_enabled into recipient_enabled from public.profiles where id = recipient;
  select * into workspace from public.user_data where user_id = sender for share;
  if workspace.user_id is null then raise exception 'Source counter not found'; end if;
  select item into source from jsonb_array_elements(workspace.counters) item where item->>'id' = source_counter_id;
  if source is null or coalesce((source->>'localOnly')::boolean,false) then raise exception 'Source counter is unavailable for sharing'; end if;
  snapshot := private.normalize_copy_counter(source);
  if include_script then
    linked_script := private.stopped_copy_script(workspace.scripts->source_counter_id);
  end if;
  if include_customization then
    linked_customization := workspace.tally_super->'counterCustomizations'->source_counter_id;
    if linked_customization is null or jsonb_typeof(linked_customization) <> 'object' then raise exception 'Selected customization is unavailable'; end if;
  end if;
  insert into public.counter_shares(sender_id,recipient_id,counter_data,counter_script,counter_customization,
    sender_anonymous,state,accepted,response_reason,offered_script,offered_customization,terminal_at)
  values (sender,recipient,snapshot,linked_script,linked_customization,profile.anonymize_shares,
    case when coalesce(recipient_enabled,false) then 'Pending' else 'Receiving disabled' end,
    case when coalesce(recipient_enabled,false) then null else false end,
    case when coalesce(recipient_enabled,false) then null else 'sharing_disabled' end,
    include_script,include_customization,case when coalesce(recipient_enabled,false) then null else now() end)
  returning id into share_id;
  return jsonb_build_object('id',share_id::text,
    'state',case when coalesce(recipient_enabled,false) then 'Pending' else 'Receiving disabled' end,
    'createdAt',now(),'terminalAt',case when coalesce(recipient_enabled,false) then null else now() end,
    'recipientDisplay',coalesce((select username from public.profiles where id = recipient),'Tally user'));
end;
$$;
revoke execute on function public.send_counter_copy_from_source(text,text,boolean,boolean,text) from public, anon;
grant execute on function public.send_counter_copy_from_source(text,text,boolean,boolean,text) to authenticated;

-- Role-specific reads. No public table SELECT is needed by the browser.
create function public.list_incoming_counter_copies()
returns setof jsonb language sql security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id',share.id::text,'state',share.state,
    'senderDisplay',case when share.sender_anonymous then 'A Tally user' else coalesce(sender.username,'Tally user') end,
    'counter',share.counter_data,'script',case when share.offered_script then share.counter_script end,
    'customization',case when share.offered_customization then share.counter_customization end,
    'offeredScript',share.offered_script,'offeredCustomization',share.offered_customization,
    'createdAt',share.created_at,'terminalAt',share.terminal_at
  ))
  from public.counter_shares share join public.profiles sender on sender.id = share.sender_id
  where (select auth.uid()) is not null and share.recipient_id = (select auth.uid()) and share.state = 'Pending'
  order by share.created_at desc;
$$;
revoke execute on function public.list_incoming_counter_copies() from public, anon;
grant execute on function public.list_incoming_counter_copies() to authenticated;

create function public.list_outgoing_counter_copy_outcomes()
returns setof jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',share.id::text,'state',share.state,
    'recipientDisplay',coalesce(recipient.username,'Tally user'),'createdAt',share.created_at,
    'terminalAt',share.terminal_at,'senderAcknowledged',share.sender_acknowledged)
  from public.counter_shares share join public.profiles recipient on recipient.id = share.recipient_id
  where (select auth.uid()) is not null and share.sender_id = (select auth.uid()) and share.state <> 'Pending' and share.sender_acknowledged = false
  order by share.created_at desc;
$$;
revoke execute on function public.list_outgoing_counter_copy_outcomes() from public, anon;
grant execute on function public.list_outgoing_counter_copy_outcomes() to authenticated;

drop function if exists public.decline_counter_copy(bigint);
create function public.decline_counter_copy(share_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare share public.counter_shares%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into share from public.counter_shares as target_share where target_share.id = decline_counter_copy.share_id and target_share.recipient_id = (select auth.uid()) for update;
  if not found or share.state <> 'Pending' or exists (select 1 from private.counter_copy_claims claim where claim.share_id = decline_counter_copy.share_id and claim.status = 'claimed') then
    raise exception 'Counter Copy is not pending or is already claimed';
  end if;
  update public.counter_shares set state='Declined',accepted=false,response_reason='declined',terminal_at=now() where public.counter_shares.id=decline_counter_copy.share_id;
  return jsonb_build_object('id',share_id::text,'state','Declined','terminalAt',now());
end;
$$;
revoke execute on function public.decline_counter_copy(bigint) from public, anon;
grant execute on function public.decline_counter_copy(bigint) to authenticated;

create function public.acknowledge_counter_copy(share_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare share public.counter_shares%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into share from public.counter_shares as target_share where target_share.id=acknowledge_counter_copy.share_id and target_share.sender_id=(select auth.uid()) for update;
  if not found or share.state = 'Pending' then raise exception 'Counter Copy outcome is unavailable'; end if;
  update public.counter_shares set sender_acknowledged=true where public.counter_shares.id=acknowledge_counter_copy.share_id;
  return jsonb_build_object('id',share_id::text,'state',share.state,'senderAcknowledged',true,'terminalAt',share.terminal_at);
end;
$$;
revoke execute on function public.acknowledge_counter_copy(bigint) from public, anon;
grant execute on function public.acknowledge_counter_copy(bigint) to authenticated;

-- Claim and finalization are recipient-bound and serialize on the immutable offer.
create or replace function public.claim_counter_copy(
  share_id bigint, operation_id uuid, include_script boolean default false,
  include_customization boolean default false, local_only boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare share public.counter_shares%rowtype; claim private.counter_copy_claims%rowtype;
  token text; script jsonb; customization jsonb; next_scripts jsonb; next_tally jsonb; destination uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into share from public.counter_shares as target_share where target_share.id=claim_counter_copy.share_id and target_share.recipient_id=(select auth.uid()) for update;
  if not found then raise exception 'Counter Copy is not available'; end if;
  if include_script and not share.offered_script then raise exception 'Script was not offered'; end if;
  if include_customization and not share.offered_customization then raise exception 'Customization was not offered'; end if;
  select * into claim from private.counter_copy_claims where counter_copy_claims.share_id=claim_counter_copy.share_id for update;
  if found then
    if claim.operation_id <> operation_id or claim.include_script <> include_script or claim.include_customization <> include_customization or claim.mode <> (case when local_only then 'local' else 'non_local' end) then raise exception 'Counter Copy claim choices are immutable'; end if;
    if claim.status = 'accepted' then return jsonb_build_object('id',claim.share_id::text,'state','Accepted','mode',claim.mode,'operationId',claim.operation_id,'destinationId',claim.destination_id); end if;
    if not local_only then raise exception 'Non-local claim is incomplete'; end if;
  elsif share.state <> 'Pending' then
    raise exception 'Counter Copy is not pending';
  else
    destination := gen_random_uuid();
    insert into private.counter_copy_claims(share_id,recipient_id,operation_id,destination_id,mode,status,include_script,include_customization)
      values (share_id,(select auth.uid()),operation_id,destination,case when local_only then 'local' else 'non_local' end,'claimed',include_script,include_customization)
      returning * into claim;
  end if;
  if local_only then
    token := encode(extensions.gen_random_bytes(32),'hex');
    update private.counter_copy_claims set delivery_token_hash=encode(extensions.digest(token,'sha256'),'hex'),delivery_expires_at=now()+interval '10 minutes',updated_at=now() where counter_copy_claims.share_id=claim_counter_copy.share_id returning * into claim;
    return jsonb_strip_nulls(jsonb_build_object('id',claim.share_id::text,'state','Pending','mode','local','operationId',claim.operation_id,'destinationId',claim.destination_id,'deliveryToken',token,'deliveryExpiresAt',claim.delivery_expires_at,'counter',share.counter_data,'script',case when include_script then share.counter_script end,'customization',case when include_customization then share.counter_customization end,'offeredScript',share.offered_script,'offeredCustomization',share.offered_customization));
  end if;
  script := case when include_script then share.counter_script end;
  customization := case when include_customization then share.counter_customization end;
  next_scripts := coalesce((select scripts from public.user_data where user_id=(select auth.uid())),'{}'::jsonb);
  if include_script then next_scripts := next_scripts || jsonb_build_object(claim.destination_id::text,script); end if;
  next_tally := coalesce((select tally_super from public.user_data where user_id=(select auth.uid())),'{}'::jsonb);
  if include_customization then
    if jsonb_typeof(next_tally) <> 'object' then next_tally := '{}'::jsonb; end if;
    if jsonb_typeof(next_tally->'counterCustomizations') <> 'object' then
      next_tally := jsonb_set(next_tally,'{counterCustomizations}','{}'::jsonb,true);
    end if;
    next_tally := jsonb_set(next_tally,ARRAY['counterCustomizations',claim.destination_id::text],customization,true);
  end if;
  insert into public.user_data(user_id,counters,scripts,tally_super,revision)
    values ((select auth.uid()),jsonb_build_array(share.counter_data || jsonb_build_object('id',claim.destination_id,'localOnly',false)),next_scripts,next_tally,1)
    on conflict (user_id) do update set counters=coalesce(public.user_data.counters,'[]'::jsonb)||jsonb_build_array(share.counter_data||jsonb_build_object('id',claim.destination_id,'localOnly',false)),scripts=next_scripts,tally_super=next_tally,revision=public.user_data.revision+1,updated_at=now();
  update private.counter_copy_claims set status='accepted',updated_at=now() where counter_copy_claims.share_id=claim_counter_copy.share_id;
  update public.counter_shares set state='Accepted',accepted=true,terminal_at=now() where public.counter_shares.id=claim_counter_copy.share_id;
  return jsonb_build_object('id',claim.share_id::text,'state','Accepted','mode','non_local','operationId',claim.operation_id,'destinationId',claim.destination_id);
end;
$$;
revoke execute on function public.claim_counter_copy(bigint,uuid,boolean,boolean,boolean) from public, anon;
grant execute on function public.claim_counter_copy(bigint,uuid,boolean,boolean,boolean) to authenticated;

create or replace function public.finalize_local_counter_copy(
  share_id bigint, operation_id uuid, destination_id uuid, delivery_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claim private.counter_copy_claims%rowtype; share public.counter_shares%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into share from public.counter_shares as target_share
    where target_share.id=finalize_local_counter_copy.share_id
      and target_share.recipient_id=(select auth.uid()) for update;
  if not found then raise exception 'Counter Copy is not available'; end if;
  select * into claim from private.counter_copy_claims where counter_copy_claims.share_id=finalize_local_counter_copy.share_id and recipient_id=(select auth.uid()) and counter_copy_claims.operation_id=finalize_local_counter_copy.operation_id for update;
  if not found or claim.mode <> 'local' then raise exception 'Local claim not found'; end if;
  if claim.status='accepted' then
    if share.state <> 'Accepted' or share.accepted is not true then raise exception 'Local claim state is inconsistent'; end if;
    return jsonb_build_object('id',claim.share_id::text,'state','Accepted','mode','local','operationId',claim.operation_id,'destinationId',claim.destination_id);
  end if;
  if share.state <> 'Pending' or share.accepted is not null then raise exception 'Counter Copy is no longer pending'; end if;
  if claim.destination_id <> destination_id or claim.delivery_expires_at < now() or delivery_token is null or claim.delivery_token_hash <> encode(extensions.digest(delivery_token,'sha256'),'hex') then raise exception 'Invalid or expired delivery authorization'; end if;
  update public.counter_shares set state='Accepted',accepted=true,terminal_at=now()
    where public.counter_shares.id=finalize_local_counter_copy.share_id
      and public.counter_shares.recipient_id=(select auth.uid()) and public.counter_shares.state='Pending';
  if not found then raise exception 'Counter Copy finalization did not transition the request'; end if;
  update private.counter_copy_claims set status='accepted',delivery_token_hash=null,delivery_expires_at=null,updated_at=now() where counter_copy_claims.share_id=finalize_local_counter_copy.share_id;
  return jsonb_build_object('id',claim.share_id::text,'state','Accepted','mode','local','operationId',operation_id,'destinationId',destination_id);
end;
$$;
revoke execute on function public.finalize_local_counter_copy(bigint,uuid,uuid,text) from public, anon;
grant execute on function public.finalize_local_counter_copy(bigint,uuid,uuid,text) to authenticated;

-- Settings updates preserve a claimed Local request: disabling receiving only
-- terminalizes genuinely unclaimed Pending offers.
create or replace function public.update_copy_sharing_settings(
  anonymize boolean,
  sharing_enabled boolean,
  pin_enabled boolean,
  new_pin text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if pin_enabled then
    if new_pin is not null then
      if new_pin !~ '^[0-9]{6}$' then raise exception 'The sharing PIN must contain exactly 6 digits'; end if;
      insert into private.copy_sharing_secrets(user_id,pin_hash)
        values (uid,extensions.crypt(new_pin,extensions.gen_salt('bf')))
        on conflict (user_id) do update set pin_hash=excluded.pin_hash;
    elsif not exists (select 1 from private.copy_sharing_secrets secret where secret.user_id=uid) then
      raise exception 'Enter a 6-digit sharing PIN';
    end if;
  else
    delete from private.copy_sharing_secrets where user_id=uid;
  end if;
  update public.profiles set anonymize_shares=anonymize,copy_sharing_enabled=sharing_enabled,copy_sharing_pin_enabled=pin_enabled where public.profiles.id=uid;
  if not sharing_enabled then
    update public.counter_shares set state='Receiving disabled',accepted=false,response_reason='sharing_disabled',terminal_at=now()
      where public.counter_shares.recipient_id=uid and public.counter_shares.state='Pending'
        and not exists (select 1 from private.counter_copy_claims claim where claim.share_id=public.counter_shares.id and claim.status='claimed');
  end if;
end;
$$;
revoke execute on function public.update_copy_sharing_settings(boolean,boolean,boolean,text) from public, anon;
grant execute on function public.update_copy_sharing_settings(boolean,boolean,boolean,text) to authenticated;

create or replace function public.get_copy_sharing_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); settings public.profiles%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into settings from public.profiles where public.profiles.id=uid;
  if not found then raise exception 'Account settings unavailable'; end if;
  return jsonb_build_object('copySharingEnabled',settings.copy_sharing_enabled,
    'copySharingPinEnabled',settings.copy_sharing_pin_enabled);
end;
$$;
revoke execute on function public.get_copy_sharing_settings() from public, anon;
grant execute on function public.get_copy_sharing_settings() to authenticated;

-- Obsolete unrestricted paths and direct table access are not supported by the
-- role-specific protocol. Existing SECURITY DEFINER internals retain access.
revoke execute on function public.send_counter_copy(text,jsonb,text) from public, anon, authenticated;
revoke execute on function public.send_counter_copy_with_data(text,jsonb,text,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.accept_counter_copy(bigint,uuid,boolean,boolean,boolean) from public, anon, authenticated;
revoke select, insert, update, delete on public.counter_shares from public, anon, authenticated;
