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

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  counters jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  tally_super jsonb not null default '{}'::jsonb,
  scripts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  revision bigint not null default 0 check (revision >= 0)
);

alter table public.user_data enable row level security;
create policy "Users can read their own tally data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own tally data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own tally data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tally data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);
create index user_data_user_id_idx on public.user_data(user_id);
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  anonymize_shares boolean not null default false,
  copy_sharing_enabled boolean not null default true,
  copy_sharing_pin_enabled boolean not null default false,
  receive_group_invites boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,24}$'
  )
);
create unique index profiles_username_lower_idx on public.profiles (lower(username))
  where username is not null;
alter table public.profiles enable row level security;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, receive_group_invites) on public.profiles to authenticated;

create function public.handle_new_tally_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_tally_user_created after insert on auth.users
  for each row execute function public.handle_new_tally_user();

create table public.counter_shares (
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
  constraint counter_shares_counter_object check (
    jsonb_typeof(counter_data) = 'object' and octet_length(counter_data::text) <= 65536
  ),
  constraint counter_shares_response_reason check (
    response_reason is null or response_reason in ('declined', 'sharing_disabled')
  ),
  constraint counter_shares_script_object check (
    counter_script is null or (jsonb_typeof(counter_script) = 'object' and octet_length(counter_script::text) <= 65536)
  ),
  constraint counter_shares_customization_object check (
    counter_customization is null or (jsonb_typeof(counter_customization) = 'object' and octet_length(counter_customization::text) <= 65536)
  )
);
create index counter_shares_recipient_pending_idx on public.counter_shares (recipient_id, created_at)
  where accepted is null;
create index counter_shares_sender_decided_idx on public.counter_shares (sender_id, created_at)
  where accepted is not null;
alter table public.counter_shares enable row level security;
create policy "Participants can read counter shares" on public.counter_shares
  for select to authenticated using ((select auth.uid()) in (sender_id, recipient_id));
create policy "Users can send counter copies" on public.counter_shares
  for insert to authenticated with check ((select auth.uid()) = sender_id and recipient_id <> (select auth.uid()) and accepted is null);
create policy "Recipients can answer counter shares" on public.counter_shares
  for update to authenticated using ((select auth.uid()) = recipient_id and accepted is null)
  with check ((select auth.uid()) = recipient_id and accepted is not null and
    ((accepted and response_reason is null) or (not accepted and response_reason = 'declined')));
create policy "Senders can clear answered counter shares" on public.counter_shares
  for delete to authenticated using ((select auth.uid()) = sender_id and accepted is not null);
revoke all on public.counter_shares from anon, authenticated;
grant select, delete on public.counter_shares to authenticated;
grant update (accepted, response_reason) on public.counter_shares to authenticated;
grant usage, select on sequence public.counter_shares_id_seq to authenticated;

create policy "Share participants can read profile names" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.counter_shares
      where (sender_id = profiles.id and recipient_id = (select auth.uid()) and not sender_anonymous)
         or (recipient_id = profiles.id and sender_id = (select auth.uid()))
    )
  );

create table public.user_data_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  base_revision bigint not null,
  resulting_revision bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.user_data_operations enable row level security;
create policy "Users can read their own data operations" on public.user_data_operations
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.user_data_operations from anon, authenticated;
grant select on public.user_data_operations to authenticated;

create function public.update_user_data_revision(
  expected_revision bigint, operation_id uuid, next_counters jsonb,
  next_preferences jsonb, next_tally_super jsonb, next_scripts jsonb
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); current_revision bigint; prior_revision bigint;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if operation_id is null or expected_revision is null then raise exception 'Revision and operation identity are required'; end if;
  select resulting_revision into prior_revision from public.user_data_operations
    where user_id = uid and user_data_operations.operation_id = update_user_data_revision.operation_id;
  if prior_revision is not null then return prior_revision; end if;
  select revision into current_revision from public.user_data where user_id = uid for update;
  if current_revision is null then
    if expected_revision <> 0 then raise exception 'Workspace revision conflict' using errcode = '40001'; end if;
    insert into public.user_data(user_id, counters, preferences, tally_super, scripts, revision)
      values (uid, next_counters, next_preferences, next_tally_super, next_scripts, 1);
    current_revision := 1;
  else
    if current_revision <> expected_revision then raise exception 'Workspace revision conflict' using errcode = '40001'; end if;
    update public.user_data set counters = next_counters, preferences = next_preferences,
      tally_super = next_tally_super, scripts = next_scripts, revision = current_revision + 1,
      updated_at = now() where user_id = uid;
    current_revision := current_revision + 1;
  end if;
  insert into public.user_data_operations(user_id, operation_id, base_revision, resulting_revision)
    values (uid, operation_id, expected_revision, current_revision);
  return current_revision;
end;
$$;
revoke execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
