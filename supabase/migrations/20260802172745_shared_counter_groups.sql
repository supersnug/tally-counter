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

alter table public.profiles
  add column if not exists receive_group_invites boolean not null default true;

grant update (receive_group_invites) on public.profiles to authenticated;

create table public.counter_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.counter_group_members (
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_preset text not null default 'count_only' check (
    permission_preset in (
      'full_access', 'settings_only', 'scripting_only',
      'cosmetic_only', 'count_only', 'custom'
    )
  ),
  custom_permissions text[],
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_custom_permissions_shape check (
    (permission_preset = 'custom' and custom_permissions is not null)
    or (permission_preset <> 'custom' and custom_permissions is null)
  ),
  constraint group_custom_permissions_allowed check (
    custom_permissions is null or custom_permissions <@ array[
      'add', 'subtract', 'reset', 'delete_counter',
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
  )
);

create index counter_group_members_user_idx
on public.counter_group_members (user_id, group_id);

create table public.counter_group_invites (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  permission_preset text not null check (
    permission_preset in (
      'full_access', 'settings_only', 'scripting_only',
      'cosmetic_only', 'count_only', 'custom'
    )
  ),
  custom_permissions text[],
  created_at timestamptz not null default now(),
  unique (group_id, recipient_id),
  constraint group_invite_different_users check (inviter_id <> recipient_id),
  constraint group_invite_permissions_shape check (
    (permission_preset = 'custom' and custom_permissions is not null)
    or (permission_preset <> 'custom' and custom_permissions is null)
  ),
  constraint group_invite_custom_permissions_allowed check (
    custom_permissions is null or custom_permissions <@ array[
      'add','subtract','reset','delete_counter','settings_name','settings_startvalue',
      'settings_exactvalue','settings_posstep','settings_negstep',
      'settings_jump','settings_min','settings_max','settings_goaldir',
      'settings_addgoal','settings_removegoal','settings_color',
      'scripting_js','scripting_ts','superedit_embed','superedit_reset',
      'superedit_settings','superedit_delete','superedit_title',
      'superedit_count','superedit_goal','superedit_add','superedit_sub',
      'superedit_min_indicator','superedit_max_indicator',
      'superedit_posstep','superedit_negstep','superedit_min_setting',
      'superedit_max_setting','superedit_color','superedit_goaldir'
    ]::text[]
  )
);

create index counter_group_invites_recipient_idx
on public.counter_group_invites (recipient_id, created_at);

create table public.shared_counters (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  counter_data jsonb not null check (jsonb_typeof(counter_data) = 'object'),
  script jsonb,
  customization jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint shared_counter_script_object check (
    script is null or jsonb_typeof(script) = 'object'
  ),
  constraint shared_counter_customization_object check (
    customization is null or jsonb_typeof(customization) = 'object'
  )
);

create index shared_counters_group_idx
on public.shared_counters (group_id, updated_at);

alter table public.counter_groups enable row level security;
alter table public.counter_group_members enable row level security;
alter table public.counter_group_invites enable row level security;
alter table public.shared_counters enable row level security;

create function private.is_counter_group_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.counter_group_members
    where group_id = target_group and user_id = (select auth.uid())
  );
$$;

create function private.is_counter_group_owner(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.counter_groups
    where id = target_group and owner_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_counter_group_member(uuid)
from public, anon, authenticated;
revoke execute on function private.is_counter_group_owner(uuid)
from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_counter_group_member(uuid)
to authenticated;
grant execute on function private.is_counter_group_owner(uuid)
to authenticated;

create policy "Members can read groups"
on public.counter_groups for select to authenticated
using ((select private.is_counter_group_member(id)));

create policy "Members can read group membership"
on public.counter_group_members for select to authenticated
using ((select private.is_counter_group_member(group_id)));

create policy "Recipients and owners can read group invites"
on public.counter_group_invites for select to authenticated
using (
  recipient_id = (select auth.uid())
  or (select private.is_counter_group_owner(group_id))
);

create policy "Members can read shared counters"
on public.shared_counters for select to authenticated
using ((select private.is_counter_group_member(group_id)));

revoke all on public.counter_groups from anon, authenticated;
revoke all on public.counter_group_members from anon, authenticated;
revoke all on public.counter_group_invites from anon, authenticated;
revoke all on public.shared_counters from anon, authenticated;
grant select on public.counter_groups to authenticated;
grant select on public.counter_group_members to authenticated;
grant select on public.counter_group_invites to authenticated;
grant select on public.shared_counters to authenticated;

create function private.group_permission(target_group uuid, permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  membership public.counter_group_members%rowtype;
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
      'add','subtract','reset','settings_name','settings_startvalue',
      'settings_exactvalue','settings_posstep','settings_negstep',
      'settings_jump','settings_min','settings_max','settings_goaldir',
      'settings_addgoal','settings_removegoal','settings_color'
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

revoke execute on function private.group_permission(uuid, text)
from public, anon, authenticated;

create function public.create_counter_group(group_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_group uuid; current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if group_name is null or char_length(trim(group_name)) = 0 then
    raise exception 'Enter a group name';
  end if;
  insert into public.counter_groups (name, owner_id)
  values (trim(group_name), current_user_id) returning id into new_group;
  insert into public.counter_group_members (group_id, user_id, permission_preset)
  values (new_group, current_user_id, 'full_access');
  return new_group;
end; $$;

create function public.invite_counter_group_member(
  target_group uuid, recipient_identifier text, member_preset text,
  member_permissions text[] default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare recipient uuid; recipient_accepts boolean;
begin
  if not (select private.is_counter_group_owner(target_group)) then
    raise exception 'Only the group owner can invite members';
  end if;
  select id into recipient from public.profiles
  where username = lower(trim(recipient_identifier)) limit 1;
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users
    where lower(email) = lower(trim(recipient_identifier)) limit 1;
  end if;
  if recipient is null then raise exception 'No Tally account matches that recipient'; end if;
  select receive_group_invites into recipient_accepts
  from public.profiles where id = recipient;
  if not recipient_accepts then raise exception 'That account is not accepting group invites'; end if;
  if exists (
    select 1 from public.counter_group_members
    where group_id = target_group and user_id = recipient
  ) then
    raise exception 'You are already in this group';
  end if;
  insert into public.counter_group_invites (
    group_id, inviter_id, recipient_id, permission_preset, custom_permissions
  ) values (
    target_group, (select auth.uid()), recipient, member_preset,
    case when member_preset = 'custom' then member_permissions else null end
  );
end; $$;

create function public.respond_counter_group_invite(invite_id bigint, accept_invite boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare invitation public.counter_group_invites%rowtype;
begin
  select * into invitation from public.counter_group_invites
  where id = invite_id and recipient_id = (select auth.uid());
  if not found then raise exception 'Group invitation not found'; end if;
  if accept_invite then
    insert into public.counter_group_members (
      group_id, user_id, permission_preset, custom_permissions
    ) values (
      invitation.group_id, invitation.recipient_id,
      invitation.permission_preset, invitation.custom_permissions
    ) on conflict (group_id, user_id) do nothing;
  end if;
  delete from public.counter_group_invites where id = invite_id;
end; $$;

create function public.set_counter_group_member_permissions(
  target_group uuid, target_user uuid, member_preset text,
  member_permissions text[] default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_counter_group_owner(target_group)) then
    raise exception 'Only the group owner can change permissions';
  end if;
  if target_user = (select auth.uid()) then
    raise exception 'Owner permissions cannot be changed';
  end if;
  update public.counter_group_members
  set permission_preset = member_preset,
      custom_permissions = case when member_preset = 'custom' then member_permissions else null end
  where group_id = target_group and user_id = target_user;
end; $$;

create function public.remove_counter_group_member(target_group uuid, target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_user = (select auth.uid()) then
    if (select private.is_counter_group_owner(target_group)) then
      raise exception 'Delete the group instead of removing its owner';
    end if;
  elsif not (select private.is_counter_group_owner(target_group)) then
    raise exception 'Only the group owner can remove other members';
  end if;
  delete from public.counter_group_members
  where group_id = target_group and user_id = target_user;
end; $$;

create function public.delete_counter_group(target_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_counter_group_owner(target_group)) then
    raise exception 'Only the group owner can delete this group';
  end if;
  delete from public.counter_groups where id = target_group;
end; $$;

create function public.create_shared_counter(target_group uuid, initial_counter jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_counter uuid;
begin
  if not (select private.is_counter_group_owner(target_group)) and not exists (
    select 1 from public.counter_group_members
    where group_id = target_group and user_id = (select auth.uid())
      and permission_preset = 'full_access'
  ) then
    raise exception 'You do not have permission to create counters';
  end if;
  insert into public.shared_counters (group_id, counter_data, created_by)
  values (target_group, initial_counter - 'localOnly', (select auth.uid()))
  returning id into new_counter;
  return new_counter;
end; $$;

create function public.delete_shared_counter(target_counter uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_group uuid;
begin
  select group_id into target_group from public.shared_counters
  where id = target_counter;
  if target_group is null then raise exception 'Shared counter not found'; end if;
  if not (select private.group_permission(target_group, 'delete_counter')) then
    raise exception 'You do not have permission to delete this counter';
  end if;
  delete from public.shared_counters where id = target_counter;
end; $$;

create function public.perform_shared_counter_action(
  target_counter uuid, action_key text, action_value jsonb default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  shared public.shared_counters%rowtype;
  updated jsonb;
  number_value numeric;
  super_part text;
  expected_part text;
begin
  select * into shared from public.shared_counters where id = target_counter;
  if not found then raise exception 'Shared counter not found'; end if;
  if not (select private.group_permission(shared.group_id, action_key)) then
    raise exception 'You do not have permission for this action';
  end if;
  updated := shared.counter_data;
  if action_key = 'add' then
    number_value := least(
      coalesce((updated->>'max')::numeric, 'Infinity'::numeric),
      (updated->>'value')::numeric + (updated->>'plusStep')::numeric
    );
    updated := jsonb_set(updated, '{value}', to_jsonb(number_value));
  elsif action_key = 'subtract' then
    number_value := greatest(
      coalesce((updated->>'min')::numeric, '-Infinity'::numeric),
      (updated->>'value')::numeric - (updated->>'minusStep')::numeric
    );
    updated := jsonb_set(updated, '{value}', to_jsonb(number_value));
  elsif action_key = 'reset' then
    updated := jsonb_set(updated, '{value}', updated->'start');
  elsif action_key = 'scripting_js' or action_key = 'scripting_ts' then
    if (action_key = 'scripting_js' and action_value->>'language' <> 'javascript')
       or (action_key = 'scripting_ts' and action_value->>'language' <> 'tallyscript') then
      raise exception 'Script language does not match permission';
    end if;
    update public.shared_counters set script = action_value, updated_at = now()
    where id = target_counter;
    return;
  elsif action_key like 'superedit_%' then
    expected_part := case action_key
      when 'superedit_embed' then 'embed'
      when 'superedit_reset' then 'reset'
      when 'superedit_settings' then 'settings'
      when 'superedit_delete' then 'delete'
      when 'superedit_title' then 'title'
      when 'superedit_count' then 'count'
      when 'superedit_goal' then 'goal'
      when 'superedit_add' then 'add'
      when 'superedit_sub' then 'subtract'
      when 'superedit_min_indicator' then 'minimum'
      when 'superedit_max_indicator' then 'maximum'
      when 'superedit_posstep' then 'quick-plusStep'
      when 'superedit_negstep' then 'quick-minusStep'
      when 'superedit_min_setting' then 'quick-min'
      when 'superedit_max_setting' then 'quick-max'
      when 'superedit_color' then 'quick-color'
      when 'superedit_goaldir' then 'quick-goalDirection'
    end;
    super_part := action_value->>'partKey';
    if expected_part is null or super_part is distinct from expected_part then
      raise exception 'Super element does not match permission';
    end if;
    update public.shared_counters set customization =
      jsonb_set(
        jsonb_set(coalesce(customization, '{}'::jsonb), '{parts}',
          coalesce(customization->'parts', '{}'::jsonb) ||
          jsonb_build_object(super_part, coalesce(action_value->'part', '{}'::jsonb))),
        '{quickSettings}',
        case
          when super_part like 'quick-%' and coalesce((action_value->>'enabled')::boolean, false)
            then coalesce(customization->'quickSettings', '[]'::jsonb) ||
              case when coalesce(customization->'quickSettings', '[]'::jsonb) ? substring(super_part from 7)
                then '[]'::jsonb else jsonb_build_array(substring(super_part from 7)) end
          when super_part like 'quick-%' then (
            select coalesce(jsonb_agg(item), '[]'::jsonb)
            from jsonb_array_elements(coalesce(customization->'quickSettings', '[]'::jsonb)) item
            where item <> to_jsonb(substring(super_part from 7))
          )
          else coalesce(customization->'quickSettings', '[]'::jsonb)
        end
      ), updated_at = now()
    where id = target_counter;
    return;
  elsif action_key = 'settings_name' then
    updated := updated || jsonb_build_object('name', action_value->'name');
  elsif action_key = 'settings_startvalue' then
    updated := updated || jsonb_build_object('start', action_value->'start');
  elsif action_key = 'settings_exactvalue' or action_key = 'settings_jump' then
    updated := updated || jsonb_build_object('value', action_value->'value');
  elsif action_key = 'settings_posstep' then
    updated := updated || jsonb_build_object('plusStep', action_value->'plusStep');
  elsif action_key = 'settings_negstep' then
    updated := updated || jsonb_build_object('minusStep', action_value->'minusStep');
  elsif action_key = 'settings_min' then
    updated := updated || jsonb_build_object('min', action_value->'min');
  elsif action_key = 'settings_max' then
    updated := updated || jsonb_build_object('max', action_value->'max');
  elsif action_key = 'settings_goaldir' then
    updated := updated || jsonb_build_object('goalDirection', action_value->'goalDirection');
  elsif action_key = 'settings_color' then
    updated := updated || jsonb_build_object('color', action_value->'color');
  elsif action_key = 'settings_addgoal' then
    updated := jsonb_set(
      updated, '{goals}',
      coalesce(updated->'goals', '[]'::jsonb) || jsonb_build_array(action_value->'goal')
    );
  elsif action_key = 'settings_removegoal' then
    updated := jsonb_set(updated, '{goals}', (
      select coalesce(jsonb_agg(goal), '[]'::jsonb)
      from jsonb_array_elements(coalesce(updated->'goals', '[]'::jsonb)) goal
      where goal <> action_value->'goal'
    ));
  else
    raise exception 'Unsupported shared counter action';
  end if;
  update public.shared_counters set counter_data = updated, updated_at = now()
  where id = target_counter;
end; $$;

create function public.reject_disabled_group_invites()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.receive_group_invites and not new.receive_group_invites then
    delete from public.counter_group_invites where recipient_id = new.id;
  end if;
  return new;
end; $$;

create trigger on_group_invites_disabled
after update of receive_group_invites on public.profiles
for each row execute procedure public.reject_disabled_group_invites();

revoke execute on function public.reject_disabled_group_invites()
from public, anon, authenticated;

do $$
declare signature regprocedure;
begin
  foreach signature in array array[
    'public.create_counter_group(text)'::regprocedure,
    'public.invite_counter_group_member(uuid,text,text,text[])'::regprocedure,
    'public.respond_counter_group_invite(bigint,boolean)'::regprocedure,
    'public.set_counter_group_member_permissions(uuid,uuid,text,text[])'::regprocedure,
    'public.remove_counter_group_member(uuid,uuid)'::regprocedure,
    'public.delete_counter_group(uuid)'::regprocedure,
    'public.create_shared_counter(uuid,jsonb)'::regprocedure,
    'public.delete_shared_counter(uuid)'::regprocedure,
    'public.perform_shared_counter_action(uuid,text,jsonb)'::regprocedure
  ] loop
    execute format('revoke execute on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end $$;

create policy "Group members can read profile names"
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.counter_group_members mine
    join public.counter_group_members theirs using (group_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'shared_counters'
  ) then alter publication supabase_realtime add table public.shared_counters; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'counter_group_invites'
  ) then alter publication supabase_realtime add table public.counter_group_invites; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'counter_groups'
  ) then alter publication supabase_realtime add table public.counter_groups; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'counter_group_members'
  ) then alter publication supabase_realtime add table public.counter_group_members; end if;
end $$;
