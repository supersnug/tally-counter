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
import { eligibleCloudBundles } from "../counters/bundle";
import { validateFolders, type Folder } from "../counters/organization";
import { normalizePreferences } from "./preferences";

export const SYNC_STATES = ["Local-only", "Loading", "Saving", "Synchronized", "Conflict", "Error"] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export function eligibleWorkspace(input: { counters: any[]; trash: any[]; folders: Folder[]; preferences: any; superSettings: any; scripts: any }) {
  const preferences = normalizePreferences(input.preferences);
  const eligibleCounterIds = new Set(input.counters.filter((counter) => !counter.localOnly).map((counter) => String(counter.id)));
  const sourceWorkspace = input.superSettings?.uiCustomizations;
  const workspace = sourceWorkspace && typeof sourceWorkspace === "object" && !Array.isArray(sourceWorkspace)
    ? {
        ...sourceWorkspace,
        ...(Array.isArray(sourceWorkspace.items)
          ? { items: sourceWorkspace.items.filter((item: any) => item?.type !== "counter" || eligibleCounterIds.has(String(item.counterId))) }
          : {}),
      }
    : {};
  return {
    version: 1,
    counters: eligibleCloudBundles(input.counters, input.trash, preferences.syncTrash),
    folders: validateFolders(input.folders),
    preferences: { ...preferences },
    workspace,
    scripts: Object.fromEntries(Object.entries(input.scripts || {}).filter(([id]) => input.counters.some((counter) => String(counter.id) === id && !counter.localOnly))),
    counterCustomizations: Object.fromEntries(Object.entries(input.superSettings?.counterCustomizations || {}).filter(([id]) => eligibleCounterIds.has(String(id)))),
  };
}
export const buildEligibleWorkspace = eligibleWorkspace;

/** Compare the complete eligible projection, not just its counter array. */
export function eligibleWorkspaceDigest(value: unknown) {
  const canonicalize = (input: any): any => {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (input && typeof input === "object") return Object.keys(input).sort().reduce((result, key) => ({ ...result, [key]: canonicalize(input[key]) }), {});
    return input;
  };
  return JSON.stringify(canonicalize(value));
}

export function eligibleWorkspacesDiffer(device: ReturnType<typeof eligibleWorkspace>, cloud: ReturnType<typeof eligibleWorkspace>) {
  return eligibleWorkspaceDigest(device) !== eligibleWorkspaceDigest(cloud);
}

export function splitEligibleRows(rows: any[]) {
  return {
    active: rows.filter((row) => !row?.deletedAt),
    retained: rows.filter((row) => Boolean(row?.deletedAt)),
  };
}

export function preserveLocalBrowserSections(candidate: any, localCounters: any[], localTrash: any[], localScripts: Record<string, any>, localWorkspace: any) {
  const localIds = new Set(localCounters.map((counter) => String(counter.id)));
  const localItems = Array.isArray(localWorkspace?.items)
    ? localWorkspace.items.filter((item: any) => item?.type === "counter" && localIds.has(String(item.counterId)))
    : [];
  const candidateItems = Array.isArray(candidate.workspace?.items) ? candidate.workspace.items : [];
  return {
    active: [...localCounters, ...splitEligibleRows(candidate.counters || []).active],
    retained: [...localTrash, ...splitEligibleRows(candidate.counters || []).retained],
    scripts: { ...candidate.scripts, ...localScripts },
    workspace: { ...candidate.workspace, ...(localItems.length || candidateItems.length ? { items: [...candidateItems, ...localItems] } : {}) },
  };
}

/** Build the one RPC payload shared by discovery and Local conversion uploads. */
export function buildEligibleUpload(input: Parameters<typeof eligibleWorkspace>[0]) {
  const workspace = eligibleWorkspace(input);
  return {
    next_counters: workspace.counters,
    next_preferences: workspace.preferences,
    next_tally_super: { uiCustomizations: workspace.workspace, counterCustomizations: workspace.counterCustomizations },
    next_scripts: workspace.scripts,
    next_folders: workspace.folders,
  };
}

export const statusLabel = (state: SyncState, offline = false) => `${state}${offline ? " · Offline" : ""}`;

export function isCurrentSession(entry: { sessionGeneration?: number; baseRevision?: number }, generation: number, revision: number) {
  return entry.sessionGeneration === generation && entry.baseRevision === revision;
}

export function acknowledgeJournal(storage: Storage, operationId: string, generation: number, revision: number) {
  const current = JSON.parse(storage.getItem("tally-sync-journal") || "[]");
  if (!Array.isArray(current)) throw new Error("Sync journal is malformed.");
  const entry = current.find((item) => item.operationId === operationId);
  if (!entry || !isCurrentSession(entry, generation, revision)) return false;
  storage.setItem("tally-sync-journal", JSON.stringify(current.filter((item) => item.operationId !== operationId)));
  return true;
}

export function appendJournal(storage: Storage, entry: Record<string, unknown>) {
  const current = JSON.parse(storage.getItem("tally-sync-journal") || "[]");
  if (!Array.isArray(current)) throw new Error("Sync journal is malformed.");
  const next = [...current.filter((item) => item?.operationId !== entry.operationId), entry];
  storage.setItem("tally-sync-journal", JSON.stringify(next));
  return next;
}

export function readReplayJournal(storage: Storage, accountId: string, generation: number) {
  try {
    const current = JSON.parse(storage.getItem("tally-sync-journal") || "[]");
    if (!Array.isArray(current)) throw new Error("Sync journal is malformed.");
    const valid = current.filter((entry) => entry && entry.accountId === accountId && entry.sessionGeneration === generation && entry.operationId && entry.baseRevision != null);
    const quarantined = current.filter((entry) => !valid.includes(entry));
    if (quarantined.length) storage.setItem("tally-sync-journal-quarantine", JSON.stringify(quarantined));
    return valid.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  } catch (error) {
    storage.setItem("tally-sync-journal-quarantine", JSON.stringify([{ error: error instanceof Error ? error.message : "Malformed journal" }]));
    return [];
  }
}

export function stampJournalEntry(entry: Record<string, unknown>, accountId: string | null, sessionGeneration: number, baseRevision: number, digest: string, workspace: unknown) {
  return { ...entry, accountId, sessionGeneration, baseRevision, digest, workspace, deliveryState: entry.deliveryState || "pending", createdAt: entry.createdAt || Date.now() };
}

export async function deliverJournalEntry(entry: any, context: { accountId: string; generation: number; revision: number; rpc: (args: any) => Promise<{ data?: unknown; error?: any }> }) {
  if (!isCurrentSession(entry, context.generation, context.revision) || entry.accountId !== context.accountId) return { state: "stale" as const };
  try {
    const result = await context.rpc({ expected_revision: entry.baseRevision, operation_id: entry.operationId, ...entry.workspace });
    if (result.error) {
      const message = String(result.error.message || result.error.code || result.error);
      if (/revision|conflict/i.test(message)) return { state: "conflict" as const, error: result.error };
      return { state: "error" as const, error: result.error };
    }
    return { state: "acknowledged" as const, revision: Number(result.data) };
  } catch (error) { return { state: "unknown" as const, error }; }
}

export function mergeEligible(device: any, cloud: any) {
  const counters = [...(device.counters || [])];
  const byId = new Map(counters.map((counter) => [String(counter.id), counter]));
  const scripts = { ...(device.scripts || {}) };
  const counterCustomizations = { ...(device.counterCustomizations || {}) };
  for (const counter of cloud.counters || []) {
    const current = byId.get(String(counter.id));
    if (!current) {
      counters.push(counter);
      if (cloud.scripts?.[String(counter.id)]) scripts[String(counter.id)] = cloud.scripts[String(counter.id)];
      if (cloud.counterCustomizations?.[String(counter.id)]) counterCustomizations[String(counter.id)] = cloud.counterCustomizations[String(counter.id)];
    }
    else if (JSON.stringify(current) !== JSON.stringify(counter)) {
      const id = `${counter.id}-cloud-${crypto.randomUUID()}`;
      counters.push({ ...counter, id, name: `${counter.name} (cloud)` });
      if (cloud.scripts?.[String(counter.id)]) scripts[id] = cloud.scripts[String(counter.id)];
      if (cloud.counterCustomizations?.[String(counter.id)]) counterCustomizations[id] = cloud.counterCustomizations[String(counter.id)];
    } else {
      if (cloud.scripts?.[String(counter.id)]) scripts[String(counter.id)] = cloud.scripts[String(counter.id)];
      if (cloud.counterCustomizations?.[String(counter.id)]) counterCustomizations[String(counter.id)] = cloud.counterCustomizations[String(counter.id)];
    }
  }
  const folders = [...(device.folders || []), ...(cloud.folders || []).filter((folder) => !(device.folders || []).some((item) => item.id === folder.id))];
  return { ...device, ...cloud, counters, folders: validateFolders(folders), scripts, counterCustomizations };
}

export function resolveConflict(device: any, cloud: any, choice: "device" | "cloud" | "merge", observedRevision: number, currentRevision: number, singleton: { preferences?: "device" | "cloud"; workspace?: "device" | "cloud" } = {}) {
  if (observedRevision !== currentRevision) return { state: "stale" as const };
  if (choice === "device") return { state: "ready" as const, workspace: { ...device, preferences: singleton.preferences === "cloud" ? cloud.preferences : device.preferences, workspace: singleton.workspace === "cloud" ? cloud.workspace : device.workspace } };
  if (choice === "cloud") return { state: "ready" as const, workspace: { ...cloud, preferences: singleton.preferences === "device" ? device.preferences : cloud.preferences, workspace: singleton.workspace === "device" ? device.workspace : cloud.workspace } };
  const merged = mergeEligible(device, cloud);
  return { state: "ready" as const, workspace: { ...merged, preferences: singleton.preferences === "cloud" ? cloud.preferences : device.preferences, workspace: singleton.workspace === "cloud" ? cloud.workspace : device.workspace } };
}

export async function commitConflictAtomically(storage: Storage, aggregateKey: string, previous: string, candidate: string, rpc: () => Promise<{ data?: unknown; error?: unknown }>, sections: { key: string; previous: string | null; candidate: string }[] = []) {
  const writes = [{ key: aggregateKey, previous, candidate }, ...sections];
  try { storage.setItem(aggregateKey, candidate); } catch (error) { return { state: "browser-error" as const, error }; }
  try {
    for (const write of sections) storage.setItem(write.key, write.candidate);
  } catch (error) {
    for (const write of writes) if (write.previous == null) storage.removeItem(write.key); else storage.setItem(write.key, write.previous);
    return { state: "browser-error" as const, error };
  }
  try {
    const result = await rpc();
    if (result.error) { for (const write of writes) if (write.previous == null) storage.removeItem(write.key); else storage.setItem(write.key, write.previous); return { state: "cloud-error" as const, error: result.error }; }
    return { state: "acknowledged" as const, revision: result.data };
  } catch (error) { for (const write of writes) if (write.previous == null) storage.removeItem(write.key); else storage.setItem(write.key, write.previous); return { state: "unknown" as const, error }; }
}
