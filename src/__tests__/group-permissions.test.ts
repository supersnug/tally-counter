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
import { describe, expect, it } from "vitest";
import {
  GROUP_PERMISSION_OPTIONS,
  permissionsForChangedFields,
  presetPermissions,
} from "../features/groups/permissions";

describe("shared group permission presets", () => {
  it("grants every permission to full access", () => {
    expect(presetPermissions("full_access")).toEqual(
      GROUP_PERMISSION_OPTIONS.map(([key]) => key),
    );
  });

  it("keeps counting-only access limited to counter actions", () => {
    expect(presetPermissions("count_only")).toEqual([
      "add",
      "subtract",
      "reset",
    ]);
  });

  it("distinguishes indicators from quick settings", () => {
    const permissions = presetPermissions("cosmetic_only");
    expect(permissions).toContain("superedit_min_indicator");
    expect(permissions).toContain("superedit_min_setting");
    expect(permissions).toContain("superedit_max_indicator");
    expect(permissions).toContain("superedit_max_setting");
  });

  it("returns only explicitly selected custom permissions", () => {
    expect(presetPermissions("custom", ["add", "scripting_ts"])).toEqual([
      "add",
      "scripting_ts",
    ]);
  });

  it("authorizes goal additions and removals independently", () => {
    expect(permissionsForChangedFields({ goals: [1] }, { goals: [1, 2] }, ["goals"])).toEqual(["settings_addgoal"]);
    expect(permissionsForChangedFields({ goals: [1, 2] }, { goals: [1] }, ["goals"])).toEqual(["settings_removegoal"]);
  });

  it("treats normalized goal ordering and duplicates as equivalent", () => {
    expect(permissionsForChangedFields({ goals: [1, 2] }, { goals: [2, 1, 1] }, ["goals"])).toEqual([]);
    expect(permissionsForChangedFields({ goals: [1] }, { goals: [2, 1, 2] }, ["goals"])).toEqual(["settings_addgoal"]);
    expect(permissionsForChangedFields({ goals: [1, 2, 2] }, { goals: [2] }, ["goals"])).toEqual(["settings_removegoal"]);
  });
});
