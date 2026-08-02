create or replace function public.create_counter_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if group_name is null or char_length(trim(group_name)) = 0 then
    raise exception 'Enter a group name';
  end if;
  insert into public.counter_groups (name, owner_id)
  values (trim(group_name), current_user_id)
  returning id into new_group;
  insert into public.counter_group_members (
    group_id, user_id, permission_preset
  ) values (new_group, current_user_id, 'full_access');
  return new_group;
end;
$$;
