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

const input = { counters: [{ id: 1, name: "A", value: 2, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], preferences: { density: "comfortable", columns: 4, numberSize: "standard", showBounds: true, animations: true, defaultColor: "#ef6a47", trashEnabled: true, syncTrash: true }, superSettings: { uiCustomizations: { items: [] }, counterCustomizations: { secret: {} } }, scripts: { "1": { language: "tallyscript", source: "add 1", enabled: true } } };

describe("versioned backup contracts", () => {
  it("projects exact presentation preferences and stops exposing unlisted settings", () => {
    const backup = createBackup(input, "super");
    expect(Object.keys(backup.sections.preferences)).toEqual(["density", "columns", "numberSize", "showBounds", "animations", "defaultColor"]);
    expect(backup.sections.preferences.trashEnabled).toBeUndefined();
  });
  it("validates scope/version and normalizes counters before use", () => {
    const backup = createBackup(input, "counters", { includeScripts: true, selectedIds: [1] });
    expect(validateBackup(backup, "counters").sections.counters[0].id).toBe(1);
    expect(() => validateBackup({ ...backup, version: 99 }, "counters")).toThrow(/version/i);
    expect(() => validateBackup(backup, "all")).toThrow(/scope/i);
  });
  it("rejects folder cycles/orphans and normalizes expired retained data", () => {
    const backup = createBackup({ ...input, folders: [{ id: "root", name: "Root", parentId: null }, { id: "child", name: "Child", parentId: "root" }] }, "all", { selectedIds: [1] });
    backup.sections.counters[0].folderId = "child";
    backup.sections.trash = [{ ...input.counters[0], id: 2, deletedAt: Date.now() - 6 * 24 * 60 * 60 * 1000 }];
    expect(() => validateBackup(backup, "all")).toThrow(/metadata/i);
    backup.sections.trash[0].retainedUntil = backup.sections.trash[0].deletedAt + 5 * 24 * 60 * 60 * 1000;
    expect(validateBackup(backup, "all").sections.trash).toHaveLength(0);
    expect(() => validateBackup({ ...backup, sections: { ...backup.sections, folders: [{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }] } }, "all")).toThrow(/cycle/i);
  });
  it("rejects invalid preference domains and exact linked record fields", () => {
    const backup = createBackup(input, "all");
    backup.sections.preferences.density = "invalid";
    expect(() => validateBackup(backup, "all")).toThrow(/preference/i);
    const scripts = createBackup(input, "all");
    scripts.sections.scripts["1"].private = true;
    expect(() => validateBackup(scripts, "all")).toThrow(/script/i);
  });
  it("projects only active and retained owners and drops expired linked data", () => {
    const source = { ...input, counters: [...input.counters, { ...input.counters[0], id: "active" }], trash: [{ ...input.counters[0], id: "expired", deletedAt: Date.now() - 6 * 24 * 60 * 60 * 1000 }], scripts: { "1": input.scripts["1"], active: input.scripts["1"], expired: input.scripts["1"], orphan: input.scripts["1"] }, counterCustomizations: { orphan: { x: true } } };
    const backup = createBackup(source, "all");
    expect(backup.sections.scripts.orphan).toBeUndefined();
    backup.sections.scripts.expired = { ...backup.sections.scripts["1"] };
    backup.sections.scripts.expired.enabled = false;
    expect(validateBackup(backup, "all").sections.scripts.expired).toBeUndefined();
  });
  it("rejects malformed folder and retained field types without mutating input", () => {
    const backup = createBackup({ ...input, folders: [{ id: "root", name: "Root", parentId: null }] }, "all");
    const before = structuredClone(backup);
    backup.sections.folders[0].parentId = 42;
    expect(() => validateBackup(backup, "all")).toThrow(/folder/i);
    expect(before.sections.folders[0].parentId).toBe(null);
  });
  it("rejects invalid folder links and invalid source scripts during export", () => {
    const counterBackup = createBackup(input, "counters", { selectedIds: [1] }); counterBackup.sections.counters[0].folderId = 42;
    expect(() => validateBackup(counterBackup, "counters")).toThrow(/fields/i);
    expect(() => createBackup({ ...input, scripts: { "1": { source: 42, language: "unknown" } } }, "all")).toThrow(/script/i);
  });
});
