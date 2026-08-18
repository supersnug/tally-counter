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

alter table public.shared_counters
  add column version bigint not null default 0 check (version >= 0);

create table public.shared_counter_events (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  counter_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  client_event_id uuid,
  action_key text not null,
  base_version bigint not null,
  resulting_version bigint not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint shared_counter_event_versions check (resulting_version >= base_version),
  constraint shared_counter_event_payloads check (
    (before_data is null or jsonb_typeof(before_data) = 'object') and
    (after_data is null or jsonb_typeof(after_data) = 'object')
  )
);

create unique index shared_counter_events_idempotency_idx
on public.shared_counter_events (actor_id, client_event_id)
where client_event_id is not null;

create index shared_counter_events_group_created_idx
on public.shared_counter_events (group_id, created_at desc);

create index shared_counter_events_counter_created_idx
on public.shared_counter_events (counter_id, created_at desc);

alter table public.shared_counter_events enable row level security;

create policy "Members can read shared counter activity"
on public.shared_counter_events for select to authenticated
using ((select private.is_counter_group_member(group_id)));

revoke all on public.shared_counter_events from anon, authenticated;
grant select on public.shared_counter_events to authenticated;

create function private.version_shared_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger version_shared_counter_before_update
before update on public.shared_counters
for each row execute function private.version_shared_counter();

create function private.audit_shared_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_action text := nullif(current_setting('tally.action_key', true), '');
  configured_event text := nullif(current_setting('tally.client_event_id', true), '');
begin
  insert into public.shared_counter_events (
    group_id, counter_id, actor_id, client_event_id, action_key,
    base_version, resulting_version, before_data, after_data
  ) values (
    coalesce(new.group_id, old.group_id), coalesce(new.id, old.id), (select auth.uid()),
    configured_event::uuid,
    coalesce(configured_action, lower(tg_op)),
    coalesce(old.version, 0), coalesce(new.version, old.version + 1, 0),
    case when old is null then null else old.counter_data end,
    case when new is null then null else new.counter_data end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_shared_counter_after_change
after insert or update or delete on public.shared_counters
for each row execute function private.audit_shared_counter();

alter function public.perform_shared_counter_action(uuid, text, jsonb)
rename to perform_shared_counter_action_unlocked;

create function public.perform_shared_counter_action(
  target_counter uuid,
  action_key text,
  action_value jsonb default null,
  client_event_id uuid default gen_random_uuid(),
  expected_version bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
  prior_version bigint;
begin
  if client_event_id is null then raise exception 'An event ID is required'; end if;

  select resulting_version into prior_version
  from public.shared_counter_events
  where actor_id = (select auth.uid()) and shared_counter_events.client_event_id = perform_shared_counter_action.client_event_id;
  if prior_version is not null then return prior_version; end if;

  select version into current_version
  from public.shared_counters
  where id = target_counter
  for update;
  if not found then raise exception 'Shared counter not found'; end if;

  if expected_version is not null and expected_version <> current_version
     and action_key not in ('add', 'subtract') then
    raise exception using
      errcode = '40001',
      message = 'This counter changed on another device. Reloaded the latest version; review your change and try again.';
  end if;

  perform set_config('tally.action_key', action_key, true);
  perform set_config('tally.client_event_id', client_event_id::text, true);
  perform public.perform_shared_counter_action_unlocked(target_counter, action_key, action_value);

  select version into current_version from public.shared_counters where id = target_counter;
  return current_version;
end;
$$;

revoke execute on function public.perform_shared_counter_action_unlocked(uuid, text, jsonb)
from public, anon, authenticated;
revoke execute on function public.perform_shared_counter_action(uuid, text, jsonb, uuid, bigint)
from public, anon;
grant execute on function public.perform_shared_counter_action(uuid, text, jsonb, uuid, bigint)
to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_counter_events'
  ) then
    alter publication supabase_realtime add table public.shared_counter_events;
  end if;
end;
$$;
