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

-- Conformance boundary corrections.  All identity and authorization decisions
-- are derived from auth.uid(); client payloads are never trusted as ownership.

alter table public.counter_group_invites
  add column if not exists status text not null default 'Pending';
alter table public.counter_group_invites
  add constraint counter_group_invites_status_check
  check (status in ('Pending', 'Accepted', 'Declined'));
create index if not exists counter_group_invites_recipient_status_idx
  on public.counter_group_invites (recipient_id, status, created_at);

create or replace function private.group_permission(target_group uuid, permission_key text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare membership public.counter_group_members%rowtype;
begin
  select * into membership from public.counter_group_members
    where group_id = target_group and user_id = (select auth.uid());
  if not found then return false; end if;
  if exists (select 1 from public.counter_groups where id = target_group and owner_id = (select auth.uid())) then return true; end if;
  if membership.permission_preset = 'full_access' then return true; end if;
  if membership.permission_preset = 'count_only' then return permission_key = any(array['add','subtract','reset']); end if;
  if membership.permission_preset = 'settings_only' then
    return permission_key = any(array['add','subtract','reset','settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color']);
  end if;
  if membership.permission_preset = 'scripting_only' then return permission_key = any(array['scripting_js','scripting_ts']); end if;
  if membership.permission_preset = 'cosmetic_only' then return permission_key in ('settings_name','settings_color') or permission_key like 'superedit_%'; end if;
  return permission_key = any(coalesce(membership.custom_permissions, array[]::text[]));
end;
$$;

create or replace function public.create_shared_counter(target_group uuid, initial_counter jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_counter uuid; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not (select private.group_permission(target_group, 'create_counter'))
     and not (select private.group_permission(target_group, 'add')) then
    raise exception 'You do not have permission to create counters';
  end if;
  if jsonb_typeof(initial_counter) <> 'object' then raise exception 'Invalid counter data'; end if;
  insert into public.shared_counters (group_id, counter_data, created_by)
    values (target_group, initial_counter - 'localOnly', uid) returning id into new_counter;
  return new_counter;
end;
$$;

create or replace function public.respond_counter_group_invite(invite_id bigint, accept_invite boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare invitation public.counter_group_invites%rowtype; next_status text;
begin
  select * into invitation from public.counter_group_invites
    where id = invite_id and recipient_id = (select auth.uid()) and status = 'Pending' for update;
  if not found then raise exception 'Group invitation not found or already resolved'; end if;
  next_status := case when accept_invite then 'Accepted' else 'Declined' end;
  if accept_invite then
    insert into public.counter_group_members(group_id,user_id,permission_preset,custom_permissions)
      values (invitation.group_id, invitation.recipient_id, invitation.permission_preset, invitation.custom_permissions)
      on conflict (group_id,user_id) do nothing;
  end if;
  update public.counter_group_invites set status = next_status where id = invite_id;
end;
$$;

create or replace function public.leave_counter_group(target_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.counter_groups where id = target_group and owner_id = (select auth.uid())) then
    raise exception 'Transfer ownership or delete the group before leaving';
  end if;
  delete from public.counter_group_members where group_id = target_group and user_id = (select auth.uid());
end;
$$;

create or replace function public.transfer_counter_group_ownership(
  target_group uuid, new_owner uuid, former_owner_preset text default 'full_access'
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.counter_groups where id = target_group and owner_id = (select auth.uid())) then
    raise exception 'Only the current owner can transfer ownership';
  end if;
  if new_owner = (select auth.uid()) or not exists (
    select 1 from public.counter_group_members where group_id = target_group and user_id = new_owner
  ) then raise exception 'The new owner must be another active member'; end if;
  if former_owner_preset not in ('full_access','settings_only','scripting_only','cosmetic_only','count_only','custom') then
    raise exception 'Invalid former-owner access';
  end if;
  update public.counter_groups set owner_id = new_owner where id = target_group;
  update public.counter_group_members set permission_preset = former_owner_preset,
    custom_permissions = case when former_owner_preset = 'custom' then custom_permissions else null end
    where group_id = target_group and user_id = (select auth.uid());
end;
$$;

create or replace function private.prevent_owned_group_profile_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.counter_groups where owner_id = old.id) then
    raise exception 'Account owns groups; transfer ownership or delete each group first';
  end if;
  return old;
end;
$$;
drop trigger if exists prevent_owned_group_profile_delete on public.profiles;
create trigger prevent_owned_group_profile_delete
  before delete on public.profiles for each row
  execute function private.prevent_owned_group_profile_delete();
revoke execute on function private.prevent_owned_group_profile_delete() from public, anon, authenticated;

-- Positive Counter Copy projection. The source is resolved inside the owner row;
-- source identity and organization never enter the stored snapshot.
create table if not exists private.copy_acceptance_results (
  share_id bigint primary key references public.counter_shares(id) on delete cascade,
  operation_id uuid not null unique,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  destination_id uuid not null,
  created_at timestamptz not null default now()
);
alter table private.copy_acceptance_results
  add column if not exists mode text not null default 'non_local',
  add column if not exists status text not null default 'accepted',
  add column if not exists include_script boolean not null default false,
  add column if not exists include_customization boolean not null default false,
  add column if not exists delivery_token_hash text,
  add column if not exists finalized_at timestamptz;
alter table private.copy_acceptance_results
  drop constraint if exists copy_acceptance_results_mode_check,
  drop constraint if exists copy_acceptance_results_status_check;
alter table private.copy_acceptance_results
  add constraint copy_acceptance_results_mode_check check (mode in ('local', 'non_local')),
  add constraint copy_acceptance_results_status_check check (status in ('claimed', 'accepted'));
revoke all on private.copy_acceptance_results from public, anon, authenticated;

create or replace function public.send_counter_copy_from_source(
  recipient_identifier text, source_counter_id text, include_script boolean default false,
  include_customization boolean default false, sharing_pin text default null
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); recipient uuid; source jsonb; snapshot jsonb; share_id bigint;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select item into source from public.user_data d, jsonb_array_elements(d.counters) item
    where d.user_id = uid and item->>'id' = source_counter_id;
  if source is null then raise exception 'Source counter not found'; end if;
  select id into recipient from public.profiles where username = lower(trim(recipient_identifier));
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users where lower(email) = lower(trim(recipient_identifier));
  end if;
  if recipient is null or recipient = uid then raise exception 'Invalid recipient'; end if;
  snapshot := jsonb_build_object('name',source->'name','value',source->'value','start',source->'start',
    'plusStep',source->'plusStep','minusStep',source->'minusStep','min',source->'min','max',source->'max',
    'goals',source->'goals','goalDirection',source->'goalDirection','color',source->'color');
  insert into public.counter_shares(sender_id,recipient_id,counter_data,counter_script,counter_customization,sender_anonymous)
    values (uid,recipient,snapshot,
      case when include_script then (select scripts -> source_counter_id::text from public.user_data where user_id = uid) end,
      case when include_customization then (select tally_super -> source_counter_id::text from public.user_data where user_id = uid) end,
      (select anonymize_shares from public.profiles where id = uid)) returning id into share_id;
  return share_id;
end;
$$;
revoke execute on function public.send_counter_copy_from_source(text,text,boolean,boolean,text) from public, anon;
grant execute on function public.send_counter_copy_from_source(text,text,boolean,boolean,text) to authenticated;
revoke execute on function public.send_counter_copy(text,jsonb,text) from authenticated;
revoke execute on function public.send_counter_copy_with_data(text,jsonb,text,jsonb,jsonb) from authenticated;

create or replace function public.accept_counter_copy(
  p_share_id bigint, p_operation_id uuid, p_include_script boolean default false,
  p_include_customization boolean default false, p_local_only boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare share public.counter_shares%rowtype; uid uuid := (select auth.uid()); destination uuid;
  bundle jsonb; next_scripts jsonb; next_super jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_local_only then raise exception 'Local acceptance requires browser delivery finalization'; end if;
  if p_operation_id is null then raise exception 'An operation identity is required'; end if;
  select * into share from public.counter_shares where id = p_share_id and recipient_id = uid for update;
  if not found then raise exception 'Counter copy not found'; end if;
  select destination_id into destination from private.copy_acceptance_results where copy_acceptance_results.share_id = p_share_id;
  if destination is not null then return destination; end if;
  if share.accepted is not null then raise exception 'Counter copy is already resolved'; end if;
  if p_include_script and share.counter_script is null then raise exception 'Script was not offered'; end if;
  if p_include_customization and share.counter_customization is null then raise exception 'Customization was not offered'; end if;
  destination := gen_random_uuid();
  bundle := share.counter_data || jsonb_build_object('id', destination, 'localOnly', false);
  next_scripts := case when p_include_script then jsonb_build_object(destination::text, jsonb_set(share.counter_script, '{enabled}', 'false'::jsonb, true)) else '{}'::jsonb end;
  next_super := case when p_include_customization then jsonb_build_object(destination::text, share.counter_customization) else '{}'::jsonb end;
  insert into public.user_data(user_id, counters, scripts, tally_super)
    values (uid, jsonb_build_array(bundle), next_scripts, next_super)
    on conflict (user_id) do update set counters = coalesce(public.user_data.counters, '[]'::jsonb) || jsonb_build_array(bundle),
      scripts = case when p_include_script then coalesce(public.user_data.scripts, '{}'::jsonb) || next_scripts else public.user_data.scripts end,
      tally_super = case when p_include_customization then coalesce(public.user_data.tally_super, '{}'::jsonb) || next_super else public.user_data.tally_super end,
      revision = public.user_data.revision + 1, updated_at = now();
  insert into private.copy_acceptance_results(share_id, operation_id, recipient_id, destination_id)
    values (p_share_id, p_operation_id, uid, destination);
  update public.counter_shares set accepted = true, response_reason = null where id = p_share_id;
  return destination;
end;
$$;
revoke execute on function public.accept_counter_copy(bigint,uuid,boolean,boolean,boolean) from public, anon;
grant execute on function public.accept_counter_copy(bigint,uuid,boolean,boolean,boolean) to authenticated;

-- Claim is the sole recipient-side entry point. A Local claim stores only
-- protocol metadata; the offered snapshot is read from the immutable offer
-- row and returned for browser-local persistence, never copied into the claim.
create or replace function public.claim_counter_copy(
  share_id bigint, operation_id uuid, include_script boolean default false,
  include_customization boolean default false, local_only boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); share public.counter_shares%rowtype;
  result private.copy_acceptance_results%rowtype; token text; snapshot jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  select * into share from public.counter_shares where id = share_id and recipient_id = uid for update;
  if not found then raise exception 'Counter copy not found'; end if;
  if include_script and share.counter_script is null then raise exception 'Script was not offered'; end if;
  if include_customization and share.counter_customization is null then raise exception 'Customization was not offered'; end if;
  select * into result from private.copy_acceptance_results where copy_acceptance_results.share_id = share_id for update;
  if found then
    if result.operation_id <> operation_id then raise exception 'Counter copy is already claimed by another operation'; end if;
    if result.mode <> (case when local_only then 'local' else 'non_local' end)
       or result.include_script <> include_script or result.include_customization <> include_customization then
      raise exception 'Counter copy choices do not match the original claim';
    end if;
    if result.mode = 'local' and result.status = 'claimed' then
      token := encode(extensions.gen_random_bytes(32), 'hex');
      update private.copy_acceptance_results set delivery_token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
         where copy_acceptance_results.share_id = share_id;
      return jsonb_build_object('state','pending','mode','local','shareId',share_id,
        'operationId',operation_id,'destinationId',result.destination_id,'deliveryToken',token,
        'counter',share.counter_data,'script',case when include_script then jsonb_set(share.counter_script, '{enabled}', 'false'::jsonb, true) end,
         'customization',case when include_customization then share.counter_customization end);
    end if;
     return jsonb_build_object('state',result.status,'mode',result.mode,'shareId',share_id,
      'operationId',result.operation_id,'destinationId',result.destination_id);
  end if;
  if share.accepted is not null then raise exception 'Counter copy is already resolved'; end if;
  if local_only then
    token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into private.copy_acceptance_results(share_id,operation_id,recipient_id,destination_id,mode,status,include_script,include_customization,delivery_token_hash)
       values (share_id,operation_id,uid,extensions.gen_random_uuid(),'local','claimed',include_script,include_customization,encode(extensions.digest(token, 'sha256'), 'hex'))
      returning * into result;
     return jsonb_build_object('state','pending','mode','local','shareId',share_id,'operationId',operation_id,
      'destinationId',result.destination_id,'deliveryToken',token,'counter',share.counter_data,
       'script',case when include_script then jsonb_set(share.counter_script, '{enabled}', 'false'::jsonb, true) end,
        'customization',case when include_customization then share.counter_customization end);
  end if;
  perform public.accept_counter_copy(share_id, operation_id, include_script, include_customization, false);
  select * into result from private.copy_acceptance_results where copy_acceptance_results.share_id = share_id;
  return jsonb_build_object('state','accepted','mode','non_local','shareId',share_id,
    'operationId',result.operation_id,'destinationId',result.destination_id);
end;
$$;
revoke execute on function public.claim_counter_copy(bigint,uuid,boolean,boolean,boolean) from public, anon;
grant execute on function public.claim_counter_copy(bigint,uuid,boolean,boolean,boolean) to authenticated;

create or replace function public.finalize_local_counter_copy(
  share_id bigint, operation_id uuid, destination_id uuid, delivery_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); result private.copy_acceptance_results%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if delivery_token is null or length(delivery_token) < 32 then raise exception 'Invalid delivery authorization'; end if;
  select * into result from private.copy_acceptance_results
    where copy_acceptance_results.share_id = share_id
      and copy_acceptance_results.operation_id = finalize_local_counter_copy.operation_id and recipient_id = uid for update;
  if not found or result.mode <> 'local' or result.status <> 'claimed' then raise exception 'Local copy claim not found'; end if;
  if result.destination_id <> destination_id or result.delivery_token_hash <> encode(extensions.digest(delivery_token, 'sha256'), 'hex') then
    raise exception 'Invalid delivery authorization';
  end if;
  update private.copy_acceptance_results set status = 'accepted', finalized_at = now(), delivery_token_hash = null
    where copy_acceptance_results.share_id = share_id;
  update public.counter_shares set accepted = true, response_reason = null
    where id = share_id and recipient_id = uid and accepted is null;
  return jsonb_build_object('state','accepted','mode','local','shareId',share_id,
    'operationId',operation_id,'destinationId',destination_id);
end;
$$;
revoke execute on function public.finalize_local_counter_copy(bigint,uuid,uuid,text) from public, anon;
grant execute on function public.finalize_local_counter_copy(bigint,uuid,uuid,text) to authenticated;

create or replace function public.decline_counter_copy(p_target_share_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.counter_shares set accepted = false, response_reason = 'declined'
    where id = p_target_share_id and recipient_id = (select auth.uid()) and accepted is null
      and not exists (select 1 from private.copy_acceptance_results where share_id = p_target_share_id and status = 'claimed');
  if not found then raise exception 'Counter copy is not pending or is already claimed'; end if;
end;
$$;
revoke execute on function public.decline_counter_copy(bigint) from public, anon;
grant execute on function public.decline_counter_copy(bigint) to authenticated;
