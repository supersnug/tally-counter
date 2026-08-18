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
import { validateBackup, type BackupScope } from "./backup";
import { normalizeSuperSettings } from "../counters/model";
import { normalizeScriptRecords } from "../counters/operations";
import { normalizeIdentity, validateFolders } from "../counters/organization";
import { BUNDLE_STORAGE_KEY } from "../counters/bundle";

export type ImportSession = {
  scope: BackupScope;
  candidate: any;
  revision: string;
  replacements: string[];
  excluded: string[];
};

export function workspaceDigest(value: unknown) {
  return JSON.stringify(value);
}

export function prepareImport(raw: unknown, scope: BackupScope, revision: string): ImportSession {
  const candidate = validateBackup(raw, scope);
  const replacements = scope === "counters"
    ? ["active counters", "represented folders", "selected linked data"]
    : scope === "super"
      ? ["workspace customization", "six presentation preferences"]
      : ["active and retained bundles", "folders", "preferences", "scripts", "per-counter customization", "workspace customization"];
  return { scope, candidate, revision, replacements, excluded: ["history", "undo/redo", "session statistics", "account/share/group/embed data"] };
}

export function appendEligibleSyncJournal(storage: Storage, entry: Record<string, unknown>) {
  const current = JSON.parse(storage.getItem("tally-sync-journal") || "[]");
  if (!Array.isArray(current)) throw new Error("Sync journal is malformed.");
  storage.setItem("tally-sync-journal", JSON.stringify([...current.filter((item) => item?.operationId !== entry.operationId), entry]));
}

export function commitStorageAtomically(storage: Storage, writes: Record<string, string>) {
  const recovered = recoverStorageTransaction(storage);
  if (!recovered.ok) return recovered;
  const previous = Object.fromEntries(Object.keys(writes).map((key) => [key, storage.getItem(key)]));
  const transactionKey = "tally-storage-transaction";
  const transaction = JSON.stringify({ previous, writes });
  try {
    storage.setItem(transactionKey, transaction);
    for (const [key, value] of Object.entries(writes)) storage.setItem(key, value);
    storage.removeItem(transactionKey);
    return { ok: true as const };
  } catch (error) {
    try {
      for (const [key, value] of Object.entries(previous)) value == null ? storage.removeItem(key) : storage.setItem(key, value);
      storage.removeItem(transactionKey);
    } catch { /* durable transaction marker enables recovery on the next storage access */ }
    return { ok: false as const, error };
  }
}

/** Complete a previously interrupted aggregate write before another operation starts. */
export function recoverStorageTransaction(storage: Storage) {
  try {
    const raw = storage.getItem("tally-storage-transaction");
    if (!raw) return { ok: true as const };
    const transaction = JSON.parse(raw) as { previous?: Record<string, string | null> };
    if (!transaction.previous || typeof transaction.previous !== "object") throw new Error("Storage transaction is malformed.");
    for (const [key, value] of Object.entries(transaction.previous)) value == null ? storage.removeItem(key) : storage.setItem(key, value);
    storage.removeItem("tally-storage-transaction");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error };
  }
}

export function createImportPlan(current: any, session: ImportSession, options: any = {}) {
  if (current.revision && current.revision !== session.revision) throw new Error("The workspace changed while this backup was being reviewed. Review the backup again.");
  const { scope, candidate } = session;
  const sections = candidate.sections;
  const importedCounters = scope === "counters" || scope === "all" ? sections.counters : current.counters;
  const oldActiveIds = new Set((current.counters || []).map((item: any) => String(item.id)));
  const affectedInvocationIds = scope === "super" ? new Set<string>() : oldActiveIds;
  const mergeFolders = () => {
    if (scope === "all") return { folders: sections.folders, ids: new Map() };
    const result = (current.folders || []).map((folder: any) => ({ ...folder }));
    const normalize = (value: unknown) => normalizeIdentity(value);
    const path = (id: unknown, source: any[], seen = new Set<string>()): string => {
      if (id == null || id === "") return "";
      const key = String(id); if (seen.has(key)) throw new Error("Folder hierarchy contains a cycle.");
      const folder = source.find((item) => String(item.id) === key); if (!folder) throw new Error("Folder reference is missing.");
      seen.add(key); return `${path(folder.parentId, source, seen)}/${normalize(folder.name)}`;
    };
    const byPath = new Map(result.map((folder) => [path(folder.id, result), folder.id]));
    const ids = new Map<string, string>();
    for (const folder of [...sections.folders].sort((a, b) => path(a.id, sections.folders).split("/").length - path(b.id, sections.folders).split("/").length)) {
      const normalizedPath = path(folder.id, sections.folders);
      const existing = byPath.get(normalizedPath);
      if (existing) { ids.set(String(folder.id), String(existing)); continue; }
      const parentPath = normalizedPath.split("/").slice(0, -1).join("/");
      const parentId = byPath.get(parentPath) || null;
      const id = `${folder.id}-imported-${crypto.randomUUID()}`;
      result.push({ ...folder, id, parentId }); byPath.set(normalizedPath, id); ids.set(String(folder.id), id);
    }
    return { folders: result, ids };
  };
  const folderMerge = mergeFolders();
  const folders = folderMerge.folders;
  const counters = importedCounters.map((counter: any) => ({ ...counter, ...(scope === "counters" && counter.folderId ? { folderId: folderMerge.ids.get(String(counter.folderId)) || null } : {}) }));
  const retainedIds = new Set((current.trash || []).map((item: any) => String(item.id)));
  const preservedScripts = Object.fromEntries(Object.entries(current.scripts || {}).filter(([id]) => retainedIds.has(String(id))));
  const preservedCustomizations = Object.fromEntries(Object.entries(current.superSettings?.counterCustomizations || {}).filter(([id]) => retainedIds.has(String(id))));
  const scripts = scope === "all" ? normalizeScriptRecords(sections.scripts) : scope === "counters" && options.includeScripts ? { ...preservedScripts, ...normalizeScriptRecords(sections.scripts) } : preservedScripts;
  const customizations = scope === "all" ? sections.counterCustomizations : scope === "counters" && options.includeCounterCustomizations ? { ...preservedCustomizations, ...sections.counterCustomizations } : preservedCustomizations;
  const superSettings = scope === "all" ? normalizeSuperSettings({ uiCustomizations: sections.workspace, counterCustomizations: customizations }) : scope === "super" ? { ...current.superSettings, uiCustomizations: sections.workspace } : { ...current.superSettings, counterCustomizations: customizations };
  const preferences = scope === "all" || scope === "super" ? { ...current.preferences, ...sections.preferences } : current.preferences;
  const trash = scope === "all" ? sections.trash : current.trash;
  const state = { counters, folders, trash, scripts, customizations, superSettings, preferences };
  return { state, affectedInvocationIds, writes: { [BUNDLE_STORAGE_KEY]: JSON.stringify({ version: 1, state: { active: counters, retained: trash, scripts, customizations } }), "tally-folders": JSON.stringify(folders), "tally-super": JSON.stringify(superSettings), "tally-preferences": JSON.stringify(preferences) } };
}

export function commitImportPlan(storage: Storage, plan: ReturnType<typeof createImportPlan>) {
  return commitStorageAtomically(storage, plan.writes);
}
