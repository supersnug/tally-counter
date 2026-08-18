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
export const GROUP_PERMISSION_OPTIONS = [
  ["add", "Add to count"], ["subtract", "Subtract from count"], ["create_counter", "Create counters"],
  ["reset", "Reset counter"], ["delete_counter", "Delete counter"],
  ["create_folder", "Create folders"],
  ["delete_folder", "Delete folders"],
  ["settings_folder", "Move counters and folders"],
  ["settings_name", "Change counter name"],
  ["settings_startvalue", "Change start value"],
  ["settings_exactvalue", "Change exact value"],
  ["settings_posstep", "Change positive step"],
  ["settings_negstep", "Change negative step"],
  ["settings_jump", "Jump to saved value"],
  ["settings_min", "Change minimum value"],
  ["settings_max", "Change maximum value"],
  ["settings_goaldir", "Change goal direction"],
  ["settings_addgoal", "Add a goal"],
  ["settings_removegoal", "Remove a goal"],
  ["settings_color", "Change the counter’s color"],
  ["scripting_js", "Modify JavaScript code"],
  ["scripting_ts", "Modify TallyScript code"],
  ["superedit_embed", "Edit embed button in Tally Super"],
  ["superedit_reset", "Edit reset button in Tally Super"],
  ["superedit_settings", "Edit settings button in Tally Super"],
  ["superedit_delete", "Edit delete button in Tally Super"],
  ["superedit_title", "Edit counter title in Tally Super"],
  ["superedit_count", "Edit count in Tally Super"],
  ["superedit_goal", "Edit goal bar in Tally Super"],
  ["superedit_add", "Edit add button in Tally Super"],
  ["superedit_sub", "Edit subtract button in Tally Super"],
  ["superedit_min_indicator", "Edit minimum indicator in Tally Super"],
  ["superedit_max_indicator", "Edit maximum indicator in Tally Super"],
  ["superedit_posstep", "Edit positive step setting in Tally Super"],
  ["superedit_negstep", "Edit negative step setting in Tally Super"],
  ["superedit_min_setting", "Edit minimum setting in Tally Super"],
  ["superedit_max_setting", "Edit maximum setting in Tally Super"],
  ["superedit_color", "Edit color setting in Tally Super"],
  ["superedit_goaldir", "Edit goal direction setting in Tally Super"],
] as const;

export const GROUP_PERMISSION_SECTIONS = [
  ["Counting", ["add", "subtract", "reset", "delete_counter"]],
  ["Folders", ["create_folder", "delete_folder", "settings_folder"]],
  ["Counter settings", GROUP_PERMISSION_OPTIONS.map(([key]) => key).filter((key) => key.startsWith("settings_"))],
  ["Scripting", ["scripting_js", "scripting_ts"]],
  ["Tally Super", GROUP_PERMISSION_OPTIONS.map(([key]) => key).filter((key) => key.startsWith("superedit_"))],
] as const;

export const GROUP_PRESETS = [
  ["full_access", "Full Access"], ["settings_only", "Settings Only"],
  ["scripting_only", "Scripts Only"], ["cosmetic_only", "Super Only"],
  ["count_only", "Counting Only"], ["custom", "Custom"],
] as const;

export const presetPermissions = (preset, custom: string[] = []) => {
  if (preset === "full_access") return GROUP_PERMISSION_OPTIONS.map(([key]) => key);
  if (preset === "count_only") return ["add", "subtract", "reset"];
  if (preset === "scripting_only") return ["scripting_js", "scripting_ts"];
  if (preset === "settings_only")
    return GROUP_PERMISSION_OPTIONS.map(([key]) => key).filter(
      (key) => ["add", "subtract", "reset"].includes(key) || ["settings_name", "settings_startvalue", "settings_exactvalue", "settings_posstep", "settings_negstep", "settings_jump", "settings_min", "settings_max", "settings_goaldir", "settings_addgoal", "settings_removegoal", "settings_color"].includes(key),
    );
  if (preset === "cosmetic_only")
    return GROUP_PERMISSION_OPTIONS.map(([key]) => key).filter(
      (key) => key === "settings_name" || key === "settings_color" || key.startsWith("superedit_"),
    );
  const known = new Set<string>(GROUP_PERMISSION_OPTIONS.map(([key]) => key));
  return custom.filter((key) => known.has(key));
};

export function permissionsForChangedFields(base: Record<string, any>, proposed: Record<string, any>, fields: string[]) {
  const permissions = fields.filter((field) => field !== "goals").map((field) => ({
    value: "settings_exactvalue", start: "settings_startvalue", plusStep: "settings_posstep",
    minusStep: "settings_negstep", min: "settings_min", max: "settings_max",
    goalDirection: "settings_goaldir", name: "settings_name", color: "settings_color",
    folder_id: "settings_folder",
  }[field])).filter(Boolean);
  if (fields.includes("goals")) {
    const before = new Set((base.goals || []).map(Number));
    const after = new Set((proposed.goals || []).map(Number));
    if ([...after].some((goal) => !before.has(goal))) permissions.push("settings_addgoal");
    if ([...before].some((goal) => !after.has(goal))) permissions.push("settings_removegoal");
  }
  return permissions;
}
