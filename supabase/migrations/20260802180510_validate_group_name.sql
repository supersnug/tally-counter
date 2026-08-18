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
