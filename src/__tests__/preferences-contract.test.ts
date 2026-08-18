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
import { createBackup, validateBackup } from "../features/settings/backup";
import { effectiveColumns, normalizePreferences } from "../features/settings/preferences";

describe("workspace preference contract", () => {
  it("normalizes malformed persisted preferences to safe defaults", () => {
    const value = normalizePreferences({ density: "invalid", columns: 99, numberSize: null, showBounds: "yes", defaultColor: "red" });
    expect(value).toMatchObject({ density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, defaultColor: "#ef6a47" });
  });
  it("preserves desired columns while deriving responsive effective columns", () => {
    expect(normalizePreferences({ columns: "4" }).columns).toBe("4");
    expect(effectiveColumns("4", 320)).toBe(1);
    expect(effectiveColumns("4", 1200)).toBe(4);
  });
  it("transfers exactly presentation preferences and excludes theme/trash", () => {
    const backup = createBackup({ preferences: { density: "spacious", columns: "4", numberSize: "large", showBounds: false, animations: false, defaultColor: "#123456", trashEnabled: false, syncTrash: true }, superSettings: { uiCustomizations: { items: [] } } }, "super");
    expect(Object.keys(backup.sections.preferences)).toEqual(["density", "columns", "numberSize", "showBounds", "animations", "defaultColor"]);
    expect(backup.sections.preferences.trashEnabled).toBeUndefined();
    expect(validateBackup(backup, "super").sections.preferences.columns).toBe("4");
  });
});
