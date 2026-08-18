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
import { deleteFolder, migrateLegacyOrganization, normalizeTags, searchCounters, validateFolders } from "../features/counters/organization";

describe("explicit personal organization contract", () => {
  it("rejects blank/colliding/cyclic folders", () => {
    expect(() => validateFolders([{ id: "a", name: " ", parentId: null }])).toThrow(/blank/i);
    expect(() => validateFolders([{ id: "a", name: "Work", parentId: null }, { id: "b", name: " work ", parentId: null }])).toThrow(/collides/i);
    expect(() => validateFolders([{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }])).toThrow(/cycle/i);
  });
  it("preserves first tag spelling while deduplicating identity", () => {
    expect(normalizeTags([" Ideas ", "ideas", "URGENT"])).toEqual(["Ideas", "URGENT"]);
  });
  it("searches folder context and normalized tags", () => {
    const counters = [{ id: 1, name: "Client", folder: "f", tags: ["Urgent"] }, { id: 2, name: "Other", folder: "f", tags: [] }];
    expect(searchCounters(counters, [{ id: "f", name: "Work", parentId: null }], " work ", "URGENT")).toHaveLength(1);
  });
  it("migrates legacy paths deterministically and preserves empty folders", () => {
    const first = migrateLegacyOrganization(["Work/Today", "Empty"], [{ id: 1, name: "x", folder: "Work/Today", payload: { keep: true } }]);
    const second = migrateLegacyOrganization(["Work/Today", "Empty"], [{ id: 1, name: "x", folder: "Work/Today", payload: { keep: true } }]);
    expect(first).toEqual(second);
    expect(first.folders.map((folder) => folder.name)).toEqual(["Work", "Today", "Empty"]);
    expect(first.counters[0]).toMatchObject({ folderId: first.folders[1].id, payload: { keep: true } });
    expect(first.counters[0]).not.toHaveProperty("folder");
  });
  it("promotes direct children and counters while preserving descendants", () => {
    const folders = [{ id: "a", name: "A", parentId: null }, { id: "b", name: "B", parentId: "a" }, { id: "c", name: "C", parentId: "b" }];
    const result = deleteFolder(folders, [{ id: 1, folderId: "a" }, { id: 2, folderId: "b" }], "a");
    expect(result.folders).toEqual([{ id: "b", name: "B", parentId: null }, { id: "c", name: "C", parentId: "b" }]);
    expect(result.counters[0].folderId).toBeNull();
    expect(result.counters[1].folderId).toBe("b");
  });
});
