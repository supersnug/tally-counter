create function public.move_counter_group_folder(
  target_folder uuid,
  target_parent uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
begin
  select group_id into target_group
  from public.counter_group_folders
  where id = target_folder;

  if target_group is null then
    raise exception 'Shared folder not found';
  end if;
  if not (select private.group_permission(target_group, 'settings_folder')) then
    raise exception 'You do not have permission to move folders';
  end if;
  if target_parent = target_folder then
    raise exception 'A folder cannot be moved into itself';
  end if;
  if target_parent is not null and not exists (
    select 1 from public.counter_group_folders
    where id = target_parent and group_id = target_group
  ) then
    raise exception 'Parent folder not found in this group';
  end if;
  if target_parent is not null and exists (
    with recursive descendants as (
      select id from public.counter_group_folders where parent_id = target_folder
      union all
      select folder.id
      from public.counter_group_folders folder
      join descendants descendant on folder.parent_id = descendant.id
    )
    select 1 from descendants where id = target_parent
  ) then
    raise exception 'A folder cannot be moved into one of its nested folders';
  end if;

  update public.counter_group_folders
  set parent_id = target_parent
  where id = target_folder;
exception
  when unique_violation then
    raise exception 'A folder with that name already exists there';
end;
$$;

revoke execute on function public.move_counter_group_folder(uuid, uuid)
from public, anon;
grant execute on function public.move_counter_group_folder(uuid, uuid)
to authenticated;
