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
import { appendEligibleSyncJournal, workspaceDigest } from "../features/settings/backupImport";

describe("backup destination revision and sync journal", () => {
  it("creates deterministic revisions and appends pending eligible work", () => {
    const storage = new Map<string, string>();
    const adapter = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) } as unknown as Storage;
    expect(workspaceDigest({ a: 1, b: 2 })).toBe(workspaceDigest({ a: 1, b: 2 }));
    appendEligibleSyncJournal(adapter, { operationId: "op", baseRevision: "rev", state: "pending" });
    expect(JSON.parse(storage.get("tally-sync-journal") || "[]")).toHaveLength(1);
  });
});
