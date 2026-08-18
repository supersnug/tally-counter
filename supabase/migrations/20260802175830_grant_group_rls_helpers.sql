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

-- RLS policies invoke these SECURITY DEFINER helpers as the authenticated role.
-- They expose only boolean membership checks and cannot modify group data.
grant usage on schema private to authenticated;

grant execute on function private.is_counter_group_member(uuid)
to authenticated;

grant execute on function private.is_counter_group_owner(uuid)
to authenticated;
