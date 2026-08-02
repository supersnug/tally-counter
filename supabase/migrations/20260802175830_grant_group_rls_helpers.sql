-- RLS policies invoke these SECURITY DEFINER helpers as the authenticated role.
-- They expose only boolean membership checks and cannot modify group data.
grant usage on schema private to authenticated;

grant execute on function private.is_counter_group_member(uuid)
to authenticated;

grant execute on function private.is_counter_group_owner(uuid)
to authenticated;
