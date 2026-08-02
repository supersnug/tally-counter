create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  counters jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  tally_super jsonb not null default '{}'::jsonb,
  scripts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can read their own tally data"
on public.user_data for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own tally data"
on public.user_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own tally data"
on public.user_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tally data"
on public.user_data for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists user_data_user_id_idx on public.user_data(user_id);

grant select, insert, update, delete on public.user_data to authenticated;

-- Public account identities. Emails remain in auth.users and are never exposed
-- through this table.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  anonymize_shares boolean not null default false,
  copy_sharing_enabled boolean not null default true,
  copy_sharing_pin_enabled boolean not null default false,
  receive_group_invites boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,24}$'
  )
);

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create function public.handle_new_tally_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '')
  );
  return new;
end;
$$;

create trigger on_tally_user_created
after insert on auth.users
for each row execute procedure public.handle_new_tally_user();

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
grant update (receive_group_invites) on public.profiles to authenticated;

-- Copy-sharing invitations. The nullable decision records pending/denied/
-- accepted without requiring separate status rows.
create table if not exists public.counter_shares (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  counter_data jsonb not null,
  counter_script jsonb,
  counter_customization jsonb,
  sender_anonymous boolean not null default false,
  accepted boolean,
  response_reason text,
  created_at timestamptz not null default now(),
  constraint counter_shares_different_users check (sender_id <> recipient_id),
  constraint counter_shares_response_reason check (
    response_reason is null or response_reason in ('declined', 'sharing_disabled')
  ),
  constraint counter_shares_counter_object check (
    jsonb_typeof(counter_data) = 'object'
    and octet_length(counter_data::text) <= 65536
  ),
  constraint counter_shares_script_object check (
    counter_script is null or (
      jsonb_typeof(counter_script) = 'object'
      and octet_length(counter_script::text) <= 65536
    )
  ),
  constraint counter_shares_customization_object check (
    counter_customization is null or (
      jsonb_typeof(counter_customization) = 'object'
      and octet_length(counter_customization::text) <= 65536
    )
  )
);

create index if not exists counter_shares_recipient_pending_idx
on public.counter_shares (recipient_id, created_at)
where accepted is null;

create index if not exists counter_shares_sender_decided_idx
on public.counter_shares (sender_id, created_at)
where accepted is not null;

alter table public.counter_shares enable row level security;

create policy "Participants can read counter shares"
on public.counter_shares for select
to authenticated
using (
  (select auth.uid()) = sender_id
  or (select auth.uid()) = recipient_id
);

create policy "Users can send counter copies"
on public.counter_shares for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and recipient_id <> (select auth.uid())
  and accepted is null
);

create policy "Recipients can answer counter shares"
on public.counter_shares for update
to authenticated
using (
  (select auth.uid()) = recipient_id
  and accepted is null
)
with check (
  (select auth.uid()) = recipient_id
  and accepted is not null
  and (
    (accepted = true and response_reason is null)
    or (accepted = false and response_reason = 'declined')
  )
);

create policy "Senders can clear answered counter shares"
on public.counter_shares for delete
to authenticated
using (
  (select auth.uid()) = sender_id
  and accepted is not null
);

revoke all on public.counter_shares from anon, authenticated;
grant select, delete on public.counter_shares to authenticated;
grant update (accepted, response_reason) on public.counter_shares to authenticated;
grant usage, select on sequence public.counter_shares_id_seq to authenticated;

-- Return only an exact recipient UUID. This avoids exposing auth.users emails
-- or a searchable user directory to the browser.
create function public.resolve_share_recipient(identifier text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select profiles.id into recipient
  from public.profiles as profiles
  where profiles.username = lower(trim(identifier))
  limit 1;

  if recipient is null and position('@' in identifier) > 1 then
    select users.id into recipient
    from auth.users as users
    where lower(users.email) = lower(trim(identifier))
    limit 1;
  end if;

  return recipient;
end;
$$;

revoke execute on function public.resolve_share_recipient(text)
from public, anon;
grant execute on function public.resolve_share_recipient(text)
to authenticated;

-- Participants may resolve the username shown on an existing invitation.
create policy "Share participants can read profile names"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.counter_shares
    where (
      sender_id = profiles.id
      and recipient_id = (select auth.uid())
      and not sender_anonymous
    ) or (
      recipient_id = profiles.id
      and sender_id = (select auth.uid())
    )
  )
);

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.copy_sharing_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null
);
revoke all on private.copy_sharing_secrets from public, anon, authenticated;

create function public.update_copy_sharing_settings(
  anonymize boolean,
  sharing_enabled boolean,
  pin_enabled boolean,
  new_pin text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if pin_enabled then
    if new_pin is not null then
      if new_pin !~ '^[0-9]{6}$' then
        raise exception 'The sharing PIN must contain exactly 6 digits';
      end if;
      insert into private.copy_sharing_secrets (user_id, pin_hash)
      values (
        current_user_id,
        extensions.crypt(new_pin, extensions.gen_salt('bf'))
      )
      on conflict (user_id) do update set pin_hash = excluded.pin_hash;
    elsif not exists (
      select 1 from private.copy_sharing_secrets
      where user_id = current_user_id
    ) then
      raise exception 'Enter a 6-digit sharing PIN';
    end if;
  else
    delete from private.copy_sharing_secrets where user_id = current_user_id;
  end if;

  update public.profiles
  set anonymize_shares = anonymize,
      copy_sharing_enabled = sharing_enabled,
      copy_sharing_pin_enabled = pin_enabled
  where id = current_user_id;

  if not sharing_enabled then
    update public.counter_shares
    set accepted = false, response_reason = 'sharing_disabled'
    where recipient_id = current_user_id and accepted is null;
  end if;
end;
$$;

revoke execute on function public.update_copy_sharing_settings(boolean, boolean, boolean, text)
from public, anon;
grant execute on function public.update_copy_sharing_settings(boolean, boolean, boolean, text)
to authenticated;

create function public.send_counter_copy(
  recipient_identifier text,
  shared_counter jsonb,
  sharing_pin text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := (select auth.uid());
  recipient uuid;
  sender_profile public.profiles%rowtype;
  recipient_enabled boolean;
  secret_hash text;
  share_id bigint;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(shared_counter) <> 'object'
     or octet_length(shared_counter::text) > 65536 then
    raise exception 'Invalid counter data';
  end if;

  select * into sender_profile from public.profiles where id = sender;
  if sender_profile.copy_sharing_pin_enabled then
    select pin_hash into secret_hash
    from private.copy_sharing_secrets where user_id = sender;
    if sharing_pin is null
       or secret_hash is null
       or extensions.crypt(sharing_pin, secret_hash) <> secret_hash then
      raise exception 'Incorrect sharing PIN';
    end if;
  end if;

  select id into recipient from public.profiles
  where username = lower(trim(recipient_identifier)) limit 1;
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users
    where lower(email) = lower(trim(recipient_identifier)) limit 1;
  end if;
  if recipient is null then raise exception 'No Tally account matches that recipient'; end if;
  if recipient = sender then raise exception 'You cannot send a counter to yourself'; end if;

  select copy_sharing_enabled into recipient_enabled
  from public.profiles where id = recipient;
  if not coalesce(recipient_enabled, false) then
    raise exception 'That account is not accepting counter copies';
  end if;

  insert into public.counter_shares (
    sender_id, recipient_id, counter_data, sender_anonymous
  ) values (
    sender, recipient, shared_counter, sender_profile.anonymize_shares
  ) returning id into share_id;
  return share_id;
end;
$$;

revoke execute on function public.send_counter_copy(text, jsonb, text)
from public, anon;
grant execute on function public.send_counter_copy(text, jsonb, text)
to authenticated;

create function public.send_counter_copy_with_data(
  recipient_identifier text,
  shared_counter jsonb,
  sharing_pin text default null,
  shared_script jsonb default null,
  shared_customization jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := (select auth.uid());
  recipient uuid;
  sender_profile public.profiles%rowtype;
  recipient_enabled boolean;
  secret_hash text;
  share_id bigint;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(shared_counter) <> 'object'
     or octet_length(shared_counter::text) > 65536 then
    raise exception 'Invalid counter data';
  end if;
  if shared_script is not null and (
    jsonb_typeof(shared_script) <> 'object'
    or octet_length(shared_script::text) > 65536
  ) then raise exception 'Invalid counter script'; end if;
  if shared_customization is not null and (
    jsonb_typeof(shared_customization) <> 'object'
    or octet_length(shared_customization::text) > 65536
  ) then raise exception 'Invalid counter customization'; end if;

  select * into sender_profile from public.profiles where id = sender;
  if sender_profile.copy_sharing_pin_enabled then
    select pin_hash into secret_hash
    from private.copy_sharing_secrets where user_id = sender;
    if sharing_pin is null
       or secret_hash is null
       or extensions.crypt(sharing_pin, secret_hash) <> secret_hash then
      raise exception 'Incorrect sharing PIN';
    end if;
  end if;

  select id into recipient from public.profiles
  where username = lower(trim(recipient_identifier)) limit 1;
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users
    where lower(email) = lower(trim(recipient_identifier)) limit 1;
  end if;
  if recipient is null then raise exception 'No Tally account matches that recipient'; end if;
  if recipient = sender then raise exception 'You cannot send a counter to yourself'; end if;

  select copy_sharing_enabled into recipient_enabled
  from public.profiles where id = recipient;
  if not coalesce(recipient_enabled, false) then
    raise exception 'That account is not accepting counter copies';
  end if;

  insert into public.counter_shares (
    sender_id,
    recipient_id,
    counter_data,
    counter_script,
    counter_customization,
    sender_anonymous
  ) values (
    sender,
    recipient,
    shared_counter,
    shared_script,
    shared_customization,
    sender_profile.anonymize_shares
  ) returning id into share_id;
  return share_id;
end;
$$;

revoke execute on function public.send_counter_copy_with_data(text, jsonb, text, jsonb, jsonb)
from public, anon;
grant execute on function public.send_counter_copy_with_data(text, jsonb, text, jsonb, jsonb)
to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'counter_shares'
  ) then
    alter publication supabase_realtime add table public.counter_shares;
  end if;
end;
$$;
