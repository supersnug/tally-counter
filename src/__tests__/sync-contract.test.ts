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
import { acknowledgeJournal, appendJournal, buildEligibleUpload, commitConflictAtomically, deliverJournalEntry, eligibleWorkspace, eligibleWorkspaceDigest, eligibleWorkspacesDiffer, mergeEligible, preserveLocalBrowserSections, readReplayJournal, resolveConflict, splitEligibleRows, stampJournalEntry, statusLabel } from "../features/settings/sync";
import { workspaceDigest } from "../features/settings/backupImport";

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } as unknown as Storage;
};

describe("revision-aware eligible sync contract", () => {
  it("projects only eligible sections and excludes Local bundles", () => {
    const workspace = eligibleWorkspace({ counters: [{ id: 1, name: "local", localOnly: true }, { id: 2, name: "cloud", localOnly: false }], trash: [], folders: [], preferences: { syncTrash: true }, superSettings: { uiCustomizations: { items: [] }, counterCustomizations: { "1": { private: true } } }, scripts: { "1": { source: "x" }, "2": { source: "y" } } });
    expect(workspace.counters.map((counter) => counter.id)).toEqual([2]);
    expect(workspace.scripts).toEqual({ "2": { source: "y" } });
    expect(workspace).not.toHaveProperty("history");
  });
  it("projects workspace elements without Local counter references", () => {
    const uiCustomizations = {
      theme: "midnight",
      items: [
        { type: "counter", counterId: "local" },
        { type: "counter", counterId: "cloud" },
        { type: "counter", counterId: "orphan" },
        { type: "text", text: "Keep this" },
      ],
    };
    const workspace = eligibleWorkspace({
      counters: [{ id: "local", localOnly: true }, { id: "cloud", localOnly: false }],
      trash: [],
      folders: [],
      preferences: { syncTrash: true },
      superSettings: { uiCustomizations },
      scripts: {},
    });

    expect(workspace.workspace).toEqual({
      theme: "midnight",
      items: [
        { type: "counter", counterId: "cloud" },
        { type: "text", text: "Keep this" },
      ],
    });
    expect(uiCustomizations.items).toHaveLength(4);
  });
  it("builds every upload from one post-operation eligible workspace", () => {
    const payload = buildEligibleUpload({
      counters: [{ id: "local", localOnly: true }, { id: "cloud", localOnly: false }],
      trash: [],
      folders: [],
      preferences: { syncTrash: true, density: "compact" },
      superSettings: { uiCustomizations: { items: [{ type: "counter", counterId: "local" }, { type: "text", text: "ok" }] }, counterCustomizations: { local: { private: true }, cloud: { accent: "blue" } } },
      scripts: { local: { source: "private" }, cloud: { source: "published" } },
    });
    expect(payload.next_counters).toHaveLength(1);
    expect(payload.next_counters[0]).toMatchObject({ id: "cloud", localOnly: false });
    expect(payload.next_preferences).toEqual(expect.objectContaining({ density: "compact", syncTrash: true }));
    expect(payload.next_tally_super).toEqual({ uiCustomizations: { items: [{ type: "text", text: "ok" }] }, counterCustomizations: { cloud: { accent: "blue" } } });
    expect(payload.next_scripts).toEqual({ cloud: { source: "published" } });
    expect(payload.next_folders).toEqual([]);
  });
  it("treats non-counter eligible divergence as an initial conflict", () => {
    const input = { counters: [{ id: "cloud", localOnly: false }], trash: [], folders: [{ id: "a", name: "A", parentId: null }], preferences: { syncTrash: true }, superSettings: { uiCustomizations: { theme: "light" } }, scripts: {} };
    const device = eligibleWorkspace(input);
    const cloud = eligibleWorkspace({ ...input, folders: [{ id: "b", name: "B", parentId: null }] });
    expect(eligibleWorkspacesDiffer(device, cloud)).toBe(true);
  });
  it("detects preference-only and one-sided eligible divergence deterministically", () => {
    const base = eligibleWorkspace({ counters: [], trash: [], folders: [], preferences: { syncTrash: true }, superSettings: {}, scripts: {} });
    const preference = eligibleWorkspace({ counters: [], trash: [], folders: [], preferences: { syncTrash: false }, superSettings: {}, scripts: {} });
    const oneSided = eligibleWorkspace({ counters: [{ id: "one", localOnly: false }], trash: [], folders: [], preferences: { syncTrash: true }, superSettings: {}, scripts: {} });
    expect(eligibleWorkspacesDiffer(base, preference)).toBe(true);
    expect(eligibleWorkspacesDiffer(base, oneSided)).toBe(true);
    expect(eligibleWorkspaceDigest({ b: 1, a: 2 })).toBe(eligibleWorkspaceDigest({ a: 2, b: 1 }));
  });
  it("splits retained rows and preserves Local linked browser sections", () => {
    const rows = splitEligibleRows([{ id: "active" }, { id: "retained", deletedAt: 1 }]);
    expect(rows.active).toHaveLength(1);
    expect(rows.retained).toHaveLength(1);
    const result = preserveLocalBrowserSections({ counters: [{ id: "cloud" }], scripts: { cloud: { source: "c" } }, workspace: { items: [{ type: "counter", counterId: "cloud" }] } }, [{ id: "local", localOnly: true }], [{ id: "local-trash", localOnly: true, deletedAt: 1 }], { local: { source: "private" } }, { items: [{ type: "counter", counterId: "local" }] });
    expect(result.active.map((counter) => counter.id)).toEqual(["local", "cloud"]);
    expect(result.retained.map((counter) => counter.id)).toEqual(["local-trash"]);
    expect(result.scripts).toHaveProperty("local");
    expect(result.workspace.items).toContainEqual({ type: "counter", counterId: "local" });
  });
  it("deduplicates journal retries by operation identity and labels offline state", () => {
    const target = storage();
    appendJournal(target, { operationId: "op", baseRevision: 1, state: "pending" });
    appendJournal(target, { operationId: "op", baseRevision: 1, state: "acknowledged" });
    expect(JSON.parse(target.getItem("tally-sync-journal")!)).toHaveLength(1);
    expect(statusLabel("Synchronized", true)).toBe("Synchronized · Offline");
  });
  it("acknowledges only the matching current session and revision", () => {
    const target = storage();
    appendJournal(target, { operationId: "op", sessionGeneration: 2, baseRevision: 4, state: "pending" });
    expect(acknowledgeJournal(target, "op", 1, 4)).toBe(false);
    expect(acknowledgeJournal(target, "op", 2, 4)).toBe(true);
    expect(JSON.parse(target.getItem("tally-sync-journal")!)).toEqual([]);
  });
  it("replays only current-account/session entries in order and quarantines others", () => {
    const target = storage();
    appendJournal(target, { operationId: "late", accountId: "a", sessionGeneration: 2, baseRevision: 2, createdAt: 2 });
    appendJournal(target, { operationId: "first", accountId: "a", sessionGeneration: 1, baseRevision: 1, createdAt: 1 });
    appendJournal(target, { operationId: "other", accountId: "b", sessionGeneration: 2, baseRevision: 1, createdAt: 0 });
    expect(readReplayJournal(target, "a", 2).map((entry) => entry.operationId)).toEqual(["late"]);
    expect(JSON.parse(target.getItem("tally-sync-journal-quarantine")!)).toHaveLength(2);
  });
  it("stamps delivery identity before network and preserves unknown state", () => {
    const entry = stampJournalEntry({ operationId: "op", deliveryState: "unknown" }, "account", 3, 7, "digest", { counters: [] });
    expect(entry).toMatchObject({ accountId: "account", sessionGeneration: 3, baseRevision: 7, deliveryState: "unknown", digest: "digest" });
  });
  it("stamps the digest of the delivered eligible upload", async () => {
    const upload = buildEligibleUpload({ counters: [{ id: "cloud", localOnly: false }], trash: [], folders: [], preferences: { syncTrash: true }, superSettings: { uiCustomizations: { items: [] } }, scripts: {} });
    const entry = stampJournalEntry({ operationId: "import" }, "account", 1, 0, workspaceDigest(upload), upload);
    expect(entry.digest).toBe(workspaceDigest(upload));
    expect((await deliverJournalEntry(entry, { accountId: "account", generation: 1, revision: 0, rpc: async (args) => ({ data: args.next_counters.length }) })).state).toBe("acknowledged");
  });
  it("serializes outcome semantics for ack, conflict, error, unknown, and stale generations", async () => {
    const entry = stampJournalEntry({ operationId: "op", workspace: { next_counters: [], next_folders: [] } }, "account", 3, 7, "digest", { next_counters: [], next_folders: [] });
    const base = { accountId: "account", generation: 3, revision: 7 };
    expect((await deliverJournalEntry(entry, { ...base, rpc: async () => ({ data: 8 }) })).state).toBe("acknowledged");
    expect((await deliverJournalEntry(entry, { ...base, rpc: async () => ({ error: { message: "revision conflict" } }) })).state).toBe("conflict");
    expect((await deliverJournalEntry(entry, { ...base, rpc: async () => ({ error: { message: "validation failed" } }) })).state).toBe("error");
    expect((await deliverJournalEntry(entry, { ...base, rpc: async () => { throw new Error("offline"); } })).state).toBe("unknown");
    expect((await deliverJournalEntry(entry, { ...base, generation: 4, rpc: async () => ({ data: 9 }) })).state).toBe("stale");
  });
  it("requires the observed revision and supports all conflict choices/singletons", () => {
    const device = { counters: [{ id: 1, value: 1 }], folders: [], preferences: { density: "compact" }, workspace: { items: ["d"] } };
    const cloud = { counters: [{ id: 1, value: 2 }], folders: [], preferences: { density: "spacious" }, workspace: { items: ["c"] } };
    expect(resolveConflict(device, cloud, "device", 1, 2).state).toBe("stale");
    expect(resolveConflict(device, cloud, "cloud", 2, 2, { preferences: "device" }).workspace.preferences.density).toBe("compact");
    expect(resolveConflict(device, cloud, "merge", 2, 2).workspace.counters).toHaveLength(2);
  });
  it("commits browser first, skips CAS on browser failure, and fully rolls back on cloud failure/unknown", async () => {
    const target = storage(); target.setItem("aggregate", "old");
    let calls = 0;
    expect((await commitConflictAtomically(target, "aggregate", "old", "new", async () => { calls += 1; return { error: new Error("cloud") }; })).state).toBe("cloud-error");
    expect(target.getItem("aggregate")).toBe("old");
    const failing = { getItem: () => "old", setItem: () => { throw new Error("quota"); }, removeItem: () => {} } as unknown as Storage;
    expect((await commitConflictAtomically(failing, "aggregate", "old", "new", async () => { calls += 1; return {}; })).state).toBe("browser-error");
    expect(calls).toBe(1);
    expect((await commitConflictAtomically(target, "aggregate", "old", "new", async () => { throw new Error("offline"); })).state).toBe("unknown");
    expect(target.getItem("aggregate")).toBe("old");
  });
  it("rolls every workspace key back after a later section write or cloud failure", async () => {
    const target = storage();
    target.setItem("aggregate", "old"); target.setItem("folders", "old-folders"); target.setItem("preferences", "old-preferences");
    const writes = [{ key: "folders", previous: "old-folders", candidate: "new-folders" }, { key: "preferences", previous: "old-preferences", candidate: "new-preferences" }];
    expect((await commitConflictAtomically(target, "aggregate", "old", "new", async () => ({ error: new Error("cloud") }), writes)).state).toBe("cloud-error");
    expect(target.getItem("aggregate")).toBe("old");
    expect(target.getItem("folders")).toBe("old-folders");
    expect(target.getItem("preferences")).toBe("old-preferences");
  });
  it("does not call RPC when a later section write fails and restores every key", async () => {
    const values = new Map([["aggregate", "old"], ["folders", "old-folders"], ["preferences", "old-preferences"]]);
    let calls = 0;
    let fail = true;
    const target = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { if (key === "preferences" && value === "new-preferences" && fail) { fail = false; throw new Error("quota"); } values.set(key, value); }, removeItem: (key: string) => values.delete(key) } as unknown as Storage;
    const writes = [{ key: "folders", previous: "old-folders", candidate: "new-folders" }, { key: "preferences", previous: "old-preferences", candidate: "new-preferences" }];
    expect((await commitConflictAtomically(target, "aggregate", "old", "new", async () => { calls += 1; return {}; }, writes)).state).toBe("browser-error");
    expect(calls).toBe(0);
    expect(values.get("aggregate")).toBe("old");
    expect(values.get("folders")).toBe("old-folders");
    expect(values.get("preferences")).toBe("old-preferences");
  });
  it("merges one-sided records and duplicates divergent records with valid folders", () => {
    const result = mergeEligible({ counters: [{ id: 1, name: "device" }], scripts: { "1": { source: "device" } }, counterCustomizations: { "1": { color: "red" } }, folders: [{ id: "a", name: "A", parentId: null }] }, { counters: [{ id: 1, name: "cloud" }, { id: 2, name: "two" }], scripts: { "1": { source: "cloud" } }, counterCustomizations: { "1": { color: "blue" }, "2": { color: "green" } }, folders: [{ id: "b", name: "B", parentId: null }] });
    expect(result.counters).toHaveLength(3);
    expect(result.folders).toHaveLength(2);
    expect(Object.values(result.scripts)).toEqual(expect.arrayContaining([{ source: "device" }, { source: "cloud" }]));
    expect(Object.values(result.counterCustomizations)).toEqual(expect.arrayContaining([{ color: "red" }, { color: "blue" }, { color: "green" }]));
  });
});
