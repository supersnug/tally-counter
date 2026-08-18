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
import { commitStorageAtomically, createImportPlan, prepareImport } from "../features/settings/backupImport";
import { createBackup } from "../features/settings/backup";

describe("backup import transaction", () => {
  it("rolls storage back when a later write fails", () => {
    const values = new Map([["a", "old"], ["b", "old"]]);
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { if (key === "b") throw new Error("quota"); values.set(key, value); }, removeItem: (key: string) => values.delete(key) } as unknown as Storage;
    expect(commitStorageAtomically(storage, { a: "new", b: "new" }).ok).toBe(false);
    expect(values.get("a")).toBe("old");
  });

  it("removes old active links while preserving retained links when options omit candidates", () => {
    const current = { counters: [{ id: "old" }], trash: [{ id: "retained" }], folders: [], preferences: {}, superSettings: { uiCustomizations: {}, counterCustomizations: { old: { keep: false }, retained: { keep: true }, orphan: { keep: false } } }, scripts: { old: { source: "old", language: "tallyscript" }, retained: { source: "retained", language: "tallyscript" }, orphan: { source: "orphan", language: "tallyscript" } } };
    const raw = createBackup({ counters: [{ id: "new", name: "New", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], folders: [], scripts: { new: { source: "new", language: "tallyscript" } }, counterCustomizations: { new: { keep: true } } }, "counters", { selectedIds: ["new"], includeScripts: true, includeCounterCustomizations: true });
    const plan = createImportPlan(current, prepareImport(raw, "counters", "rev"), { includeScripts: false, includeCounterCustomizations: false });
    expect(plan.state.scripts).toEqual({ retained: current.scripts.retained });
    expect(plan.state.customizations).toEqual({ retained: current.superSettings.counterCustomizations.retained });
  });

  it("restores all workspace, preferences, and customizations", () => {
    const raw = createBackup({ counters: [{ id: "a", name: "A", value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], folders: [], trash: [], preferences: { density: "spacious", columns: "3", numberSize: "large", showBounds: false, animations: false, defaultColor: "#123456", trashEnabled: false, syncTrash: false }, superSettings: { uiCustomizations: { items: ["x"] }, counterCustomizations: {} }, counterCustomizations: { a: { enabled: true } }, scripts: {} }, "all");
    const plan = createImportPlan({ counters: [], folders: [], trash: [], preferences: {}, superSettings: { uiCustomizations: {}, counterCustomizations: {} }, scripts: {} }, prepareImport(raw, "all", "rev"));
    expect(plan.state.superSettings.uiCustomizations).toEqual({ items: ["x"] });
    expect(plan.state.preferences.syncTrash).toBe(false);
    expect(plan.state.customizations).toEqual({ a: { enabled: true } });
  });

  it("rejects a stale destination before producing a plan", () => {
    const raw = createBackup({ counters: [{ id: "candidate", name: "Candidate", value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], folders: [] }, "counters", { selectedIds: ["candidate"] });
    expect(() => createImportPlan({ counters: [], folders: [], revision: "changed" }, prepareImport(raw, "counters", "original"))).toThrow(/changed/i);
  });
});
