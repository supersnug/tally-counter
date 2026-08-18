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

create table public.counter_group_folders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  parent_id uuid,
  name text not null check (
    name = trim(name)
    and char_length(name) between 1 and 60
    and position('/' in name) = 0
  ),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (parent_id, group_id)
    references public.counter_group_folders(id, group_id) on delete cascade,
  constraint counter_group_folder_not_self check (id <> parent_id)
);

create unique index counter_group_folders_sibling_name_idx
on public.counter_group_folders (group_id, parent_id, lower(name)) nulls not distinct;

create index counter_group_folders_group_parent_idx
on public.counter_group_folders (group_id, parent_id);

alter table public.shared_counters
  add column folder_id uuid references public.counter_group_folders(id) on delete set null;

create index shared_counters_folder_idx
on public.shared_counters (folder_id)
where folder_id is not null;

alter table public.counter_group_folders enable row level security;

create policy "Members can read group folders"
on public.counter_group_folders for select to authenticated
using ((select private.is_counter_group_member(group_id)));

revoke all on public.counter_group_folders from anon, authenticated;
grant select on public.counter_group_folders to authenticated;

alter table public.counter_group_members
  drop constraint group_custom_permissions_allowed;

alter table public.counter_group_members
  add constraint group_custom_permissions_allowed check (
    custom_permissions is null or custom_permissions <@ array[
      'add', 'subtract', 'reset', 'delete_counter',
      'create_folder', 'delete_folder', 'settings_folder',
      'settings_name', 'settings_startvalue', 'settings_exactvalue',
      'settings_posstep', 'settings_negstep', 'settings_jump',
      'settings_min', 'settings_max', 'settings_goaldir',
      'settings_addgoal', 'settings_removegoal', 'settings_color',
      'scripting_js', 'scripting_ts',
      'superedit_embed', 'superedit_reset', 'superedit_settings',
      'superedit_delete', 'superedit_title', 'superedit_count',
      'superedit_goal', 'superedit_add', 'superedit_sub',
      'superedit_min_indicator', 'superedit_max_indicator',
      'superedit_posstep', 'superedit_negstep',
      'superedit_min_setting', 'superedit_max_setting',
      'superedit_color', 'superedit_goaldir'
    ]::text[]
  );

alter table public.counter_group_invites
  drop constraint group_invite_custom_permissions_allowed;

alter table public.counter_group_invites
  add constraint group_invite_custom_permissions_allowed check (
    custom_permissions is null or custom_permissions <@ array[
      'add', 'subtract', 'reset', 'delete_counter',
      'create_folder', 'delete_folder', 'settings_folder',
      'settings_name', 'settings_startvalue', 'settings_exactvalue',
      'settings_posstep', 'settings_negstep', 'settings_jump',
      'settings_min', 'settings_max', 'settings_goaldir',
      'settings_addgoal', 'settings_removegoal', 'settings_color',
      'scripting_js', 'scripting_ts',
      'superedit_embed', 'superedit_reset', 'superedit_settings',
      'superedit_delete', 'superedit_title', 'superedit_count',
      'superedit_goal', 'superedit_add', 'superedit_sub',
      'superedit_min_indicator', 'superedit_max_indicator',
      'superedit_posstep', 'superedit_negstep',
      'superedit_min_setting', 'superedit_max_setting',
      'superedit_color', 'superedit_goaldir'
    ]::text[]
  );

create or replace function private.group_permission(target_group uuid, permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare membership public.counter_group_members%rowtype;
begin
  select * into membership from public.counter_group_members
  where group_id = target_group and user_id = (select auth.uid());
  if not found then return false; end if;
  if membership.permission_preset = 'full_access' then return true; end if;
  if membership.permission_preset = 'count_only' then
    return permission_key = any(array['add','subtract','reset']);
  end if;
  if membership.permission_preset = 'settings_only' then
    return permission_key = any(array[
      'add','subtract','reset','settings_folder','settings_name',
      'settings_startvalue','settings_exactvalue','settings_posstep',
      'settings_negstep','settings_jump','settings_min','settings_max',
      'settings_goaldir','settings_addgoal','settings_removegoal','settings_color'
    ]);
  end if;
  if membership.permission_preset = 'scripting_only' then
    return permission_key = any(array['scripting_js','scripting_ts']);
  end if;
  if membership.permission_preset = 'cosmetic_only' then
    return permission_key = 'settings_name'
      or permission_key = 'settings_color'
      or permission_key like 'superedit_%';
  end if;
  return permission_key = any(coalesce(membership.custom_permissions, array[]::text[]));
end;
$$;

create function public.create_counter_group_folder(
  target_group uuid,
  folder_name text,
  target_parent uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_folder uuid;
begin
  if not (select private.group_permission(target_group, 'create_folder')) then
    raise exception 'You do not have permission to create folders';
  end if;
  if folder_name is null or char_length(trim(folder_name)) = 0
     or char_length(trim(folder_name)) > 60 or position('/' in folder_name) > 0 then
    raise exception 'Enter a folder name between 1 and 60 characters without slashes';
  end if;
  if target_parent is not null and not exists (
    select 1 from public.counter_group_folders
    where id = target_parent and group_id = target_group
  ) then raise exception 'Parent folder not found in this group'; end if;
  insert into public.counter_group_folders (group_id, parent_id, name, created_by)
  values (target_group, target_parent, trim(folder_name), (select auth.uid()))
  returning id into new_folder;
  return new_folder;
exception when unique_violation then
  raise exception 'A folder with that name already exists here';
end;
$$;

create function public.delete_counter_group_folder(target_folder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_group uuid;
begin
  select group_id into target_group from public.counter_group_folders
  where id = target_folder;
  if target_group is null then raise exception 'Shared folder not found'; end if;
  if not (select private.group_permission(target_group, 'delete_folder')) then
    raise exception 'You do not have permission to delete folders';
  end if;
  delete from public.counter_group_folders where id = target_folder;
end;
$$;

create function public.move_shared_counter_to_folder(
  target_counter uuid,
  target_folder uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_group uuid;
begin
  select group_id into target_group from public.shared_counters
  where id = target_counter;
  if target_group is null then raise exception 'Shared counter not found'; end if;
  if not (select private.group_permission(target_group, 'settings_folder')) then
    raise exception 'You do not have permission to move counters between folders';
  end if;
  if target_folder is not null and not exists (
    select 1 from public.counter_group_folders
    where id = target_folder and group_id = target_group
  ) then raise exception 'Folder not found in this group'; end if;
  update public.shared_counters set folder_id = target_folder, updated_at = now()
  where id = target_counter;
end;
$$;

revoke execute on function public.create_counter_group_folder(uuid, text, uuid)
from public, anon;
revoke execute on function public.delete_counter_group_folder(uuid)
from public, anon;
revoke execute on function public.move_shared_counter_to_folder(uuid, uuid)
from public, anon;
grant execute on function public.create_counter_group_folder(uuid, text, uuid)
to authenticated;
grant execute on function public.delete_counter_group_folder(uuid)
to authenticated;
grant execute on function public.move_shared_counter_to_folder(uuid, uuid)
to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'counter_group_folders'
  ) then
    alter publication supabase_realtime add table public.counter_group_folders;
  end if;
end;
$$;
