alter table public.counter_group_members
  drop constraint group_custom_permissions_allowed;

alter table public.counter_group_members
  add constraint group_custom_permissions_allowed check (
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
  );

alter table public.counter_group_invites
  drop constraint group_invite_custom_permissions_allowed;

alter table public.counter_group_invites
  add constraint group_invite_custom_permissions_allowed check (
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
  );

create or replace function public.create_shared_counter(
  target_group uuid, initial_counter jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
end;
$$;

create or replace function public.delete_shared_counter(target_counter uuid)
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
  if not (select private.group_permission(target_group, 'delete_counter')) then
    raise exception 'You do not have permission to delete this counter';
  end if;
  delete from public.shared_counters where id = target_counter;
end;
$$;

update public.shared_counters
set counter_data = counter_data - 'localOnly'
where counter_data ? 'localOnly';
