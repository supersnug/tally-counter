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
import { validateBackup } from "../features/settings/backup";
import { workspaceDigest } from "../features/settings/backupImport";

describe("folder sync contract", () => {
  it("accepts empty folders and stable folder references", () => {
    const backup = validateBackup({ format: "tally-backup", version: 1, scope: "all", exportedAt: new Date().toISOString(), included: ["counterCustomizations", "counters", "folders", "preferences", "scripts", "trash", "workspace"], sections: { counters: [], counterCustomizations: {}, folders: [], preferences: { density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true, defaultColor: "#ef6a47", trashEnabled: true, syncTrash: true }, scripts: {}, trash: [], workspace: {} } });
    expect(backup.sections.folders).toEqual([]);
  });

  it("includes folder state in eligible workspace digests", () => {
    expect(workspaceDigest({ counters: [], folders: [] })).not.toBe(workspaceDigest({ counters: [], folders: [{ id: "a", name: "A", parentId: null }] }));
  });
});
