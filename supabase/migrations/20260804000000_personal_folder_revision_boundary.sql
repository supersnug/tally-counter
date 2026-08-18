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

-- Explicit personal folders are part of the eligible workspace aggregate.
-- Existing rows receive an empty hierarchy and remain valid.
alter table public.user_data
  add column if not exists folders jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_data_folders_array'
      and conrelid = 'public.user_data'::regclass
  ) then
    alter table public.user_data add constraint user_data_folders_array
      check (jsonb_typeof(folders) = 'array');
  end if;
end;
$$;

create or replace function private.validate_personal_folders(candidate jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if candidate is null or jsonb_typeof(candidate) <> 'array' then
    raise exception 'Folders must be an array';
  end if;

  if exists (
    select 1 from jsonb_array_elements(candidate) item
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'id') <> 'string'
      or nullif(trim(item->>'id'), '') is null
      or jsonb_typeof(item->'name') <> 'string'
      or nullif(trim(item->>'name'), '') is null
      or (item ? 'parentId' and item->'parentId' <> 'null'
          and jsonb_typeof(item->'parentId') <> 'string')
  ) then
    raise exception 'Each folder requires a nonblank id and name and an optional string parentId';
  end if;

  if exists (
    select trim(item->>'id') from jsonb_array_elements(candidate) item
    group by trim(item->>'id') having count(*) > 1
  ) then
    raise exception 'Folder IDs must be unique';
  end if;

  if exists (
    select 1 from jsonb_array_elements(candidate) item
    where item->'parentId' <> 'null'::jsonb
      and item->>'parentId' is not null
      and not exists (
        select 1 from jsonb_array_elements(candidate) parent_item
        where trim(parent_item->>'id') = trim(item->>'parentId')
      )
  ) then
    raise exception 'Every folder parentId must reference a folder in the same workspace';
  end if;

  if exists (
    with recursive folder_rows as (
      select trim(item->>'id') as id,
        nullif(trim(item->>'parentId'), '') as parent_id
      from jsonb_array_elements(candidate) item
      where item->'parentId' <> 'null'::jsonb
    ), walk(start_id, current_id, path, cycle) as (
      select id, parent_id, array[id], false from folder_rows
      union all
      select walk.start_id, parent.parent_id, walk.path || parent.id,
        parent.id = any(walk.path)
      from walk
      join folder_rows parent on parent.id = walk.current_id
      where walk.current_id is not null and not walk.cycle
    )
    select 1 from walk where cycle
  ) then
    raise exception 'Folder hierarchy cannot contain cycles';
  end if;
end;
$$;
revoke execute on function private.validate_personal_folders(jsonb)
  from public, anon, authenticated;

-- Canonical seven-argument CAS operation. The folder candidate is validated
-- before the row lock is changed, so the aggregate remains all-old or all-new.
create or replace function public.update_user_data_revision(
  expected_revision bigint,
  operation_id uuid,
  next_counters jsonb,
  next_preferences jsonb,
  next_tally_super jsonb,
  next_scripts jsonb,
  next_folders jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  current_revision bigint;
  prior_revision bigint;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if operation_id is null or expected_revision is null then
    raise exception 'Revision and operation identity are required';
  end if;
  perform private.validate_personal_folders(next_folders);

  select resulting_revision into prior_revision
  from public.user_data_operations
  where user_id = uid
    and user_data_operations.operation_id = update_user_data_revision.operation_id;
  if prior_revision is not null then return prior_revision; end if;

  select revision into current_revision
  from public.user_data where user_id = uid for update;
  if current_revision is null then
    if expected_revision <> 0 then
      raise exception 'Workspace revision conflict' using errcode = '40001';
    end if;
    insert into public.user_data(
      user_id, counters, preferences, tally_super, scripts, folders, revision
    ) values (
      uid, next_counters, next_preferences, next_tally_super, next_scripts, next_folders, 1
    );
    current_revision := 1;
  else
    if current_revision <> expected_revision then
      raise exception 'Workspace revision conflict' using errcode = '40001';
    end if;
    update public.user_data set
      counters = next_counters,
      preferences = next_preferences,
      tally_super = next_tally_super,
      scripts = next_scripts,
      folders = next_folders,
      revision = current_revision + 1,
      updated_at = now()
    where user_id = uid;
    current_revision := current_revision + 1;
  end if;

  insert into public.user_data_operations(
    user_id, operation_id, base_revision, resulting_revision
  ) values (uid, operation_id, expected_revision, current_revision);
  return current_revision;
end;
$$;
revoke execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

-- Compatibility overload for existing clients. It preserves the stored folder
-- section while callers migrate to the complete seven-argument projection.
create or replace function public.update_user_data_revision(
  expected_revision bigint,
  operation_id uuid,
  next_counters jsonb,
  next_preferences jsonb,
  next_tally_super jsonb,
  next_scripts jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing_folders jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select coalesce(folders, '[]'::jsonb) into existing_folders
  from public.user_data where user_id = uid;
  return public.update_user_data_revision(
    expected_revision, operation_id, next_counters, next_preferences,
    next_tally_super, next_scripts, coalesce(existing_folders, '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_user_data_revision(bigint, uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
