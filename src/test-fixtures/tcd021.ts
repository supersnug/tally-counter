/*
 * This file is part of Tally.
 *
 * Copyright (C) 2026 Tally contributors
 *
 * Tally is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * Tally is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Tally. If not, see <https://www.gnu.org/licenses/>.
 */
export const TCD021_FIXTURES = {
  users: [{ id: "user-a", email: "a@example.test" }, { id: "user-b", email: "b@example.test" }],
  workspaces: [{ id: "workspace-a", owner: "user-a", members: { "user-a": "owner", "user-b": "counting_only" } }],
  operations: [{ id: "operation-1", user: "user-a", revision: 4 }, { id: "operation-1", user: "user-a", revision: 4 }],
  failure: { rollback: true, activity: false },
} as const;
