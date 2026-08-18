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
import type { AnyRecord } from "./model";

export const normalizeIdentity = (value: unknown) => String(value ?? "").trim().normalize("NFKC").toLowerCase();
export const normalizeFolderName = (value: unknown) => {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Folder name cannot be blank.");
  if (name.includes("/")) throw new Error("Folder name cannot contain '/'.");
  return name;
};

export type Folder = { id: string; name: string; parentId: string | null };

const stableId = (value: string) => {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.codePointAt(0) || 0; hash = Math.imul(hash, 16777619); }
  return `folder-${(hash >>> 0).toString(36)}`;
};

export function migrateLegacyOrganization(rawFolders: unknown, rawCounters: AnyRecord[]) {
  const paths = [...(Array.isArray(rawFolders) ? rawFolders : []), ...rawCounters.map((counter) => counter.folder)]
    .flatMap((value) => { const parts = String(value || "").split("/").map((part) => part.trim()).filter(Boolean); return parts.map((_, index) => parts.slice(0, index + 1)); });
  const folders: Folder[] = [], byKey = new Map<string, Folder>();
  for (const parts of paths) {
    let parentId: string | null = null;
    for (const part of parts) {
      const key = `${parentId || "root"}:${normalizeIdentity(part)}`;
      const existing = byKey.get(key);
      if (existing) { parentId = existing.id; continue; }
      const folder = { id: stableId(key), name: normalizeFolderName(part), parentId };
      byKey.set(key, folder); folders.push(folder); parentId = folder.id;
    }
  }
  const rewrite = (counter: AnyRecord) => {
    const parts = String(counter.folder || "").split("/").map((part) => part.trim()).filter(Boolean);
    let parentId: string | null = null;
    for (const part of parts) parentId = byKey.get(`${parentId || "root"}:${normalizeIdentity(part)}`)?.id || null;
    return sanitizeOrganizationCounter(counter, parentId);
  };
  const counters = rawCounters.map(rewrite);
  return { folders, counters, notices: rawCounters.some((counter) => counter.folder && !counters[rawCounters.indexOf(counter)].folderId) ? ["Some folder references were recovered to My counters."] : [] };
}

export function sanitizeOrganizationCounter(counter: AnyRecord, folderId: string | null = counter.folderId || null) {
  const next: AnyRecord = { ...counter, folderId: folderId || null };
  delete next.folder;
  return next;
}

export function folderPath(folderId: string | null, folders: Folder[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = []; const seen = new Set<string>(); let current = folderId;
  while (current) { if (seen.has(current)) break; seen.add(current); const folder = byId.get(current); if (!folder) break; names.unshift(folder.name); current = folder.parentId; }
  return names.join("/");
}

export function deleteFolder(folders: Folder[], counters: AnyRecord[], id: string) {
  const target = folders.find((folder) => folder.id === id); if (!target) return { folders, counters };
  const nextFolders = folders.filter((folder) => folder.id !== id).map((folder) => folder.parentId === id ? { ...folder, parentId: target.parentId } : folder);
  const nextCounters = counters.map((counter) => counter.folderId === id ? { ...counter, folderId: target.parentId } : counter);
  return { folders: validateFolders(nextFolders), counters: nextCounters };
}

export function validateFolders(raw: unknown): Folder[] {
  const folders = Array.isArray(raw) ? raw.map((folder) => ({ id: String((folder as AnyRecord).id), name: normalizeFolderName((folder as AnyRecord).name), parentId: (folder as AnyRecord).parentId == null ? null : String((folder as AnyRecord).parentId) })) : [];
  const ids = new Set<string>();
  const siblingNames = new Set<string>();
  for (const folder of folders) {
    if (!folder.id || ids.has(folder.id)) throw new Error("Folder identities must be unique.");
    ids.add(folder.id);
    if (folder.parentId && !ids.has(folder.parentId)) {
      if (!folders.some((candidate) => candidate.id === folder.parentId)) throw new Error("Folder parent does not exist.");
    }
    const key = `${folder.parentId || "root"}:${normalizeIdentity(folder.name)}`;
    if (siblingNames.has(key)) throw new Error(`Folder name collides with an existing sibling: ${folder.name}`);
    siblingNames.add(key);
  }
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  for (const folder of folders) {
    const seen = new Set<string>(); let current: string | null = folder.id;
    while (current) { if (seen.has(current)) throw new Error("Folder hierarchy contains a cycle."); seen.add(current); current = parents.get(current) || null; }
  }
  return folders;
}

export function normalizeTags(raw: unknown) {
  const result: string[] = [], identities = new Set<string>();
  for (const value of Array.isArray(raw) ? raw : []) {
    const display = String(value).trim();
    if (!display) continue;
    const identity = normalizeIdentity(display);
    if (!identities.has(identity)) { identities.add(identity); result.push(display); }
  }
  return result;
}

export function searchCounters(counters: AnyRecord[], folders: Folder[], query = "", selectedTag = "all") {
  const normalizedQuery = normalizeIdentity(query);
  const idsByName = new Map(folders.map((folder) => [folder.id, folder.name]));
  return counters.filter((counter) => {
    const folderText = folderPath(counter.folderId || null, folders) || idsByName.get(String(counter.folder)) || String(counter.folder || "");
    const haystack = [counter.name, folderText, ...normalizeTags(counter.tags)].join(" ");
    const queryMatch = !normalizedQuery || normalizeIdentity(haystack).includes(normalizedQuery);
    const tagMatch = selectedTag === "all" || normalizeTags(counter.tags).some((tag) => normalizeIdentity(tag) === normalizeIdentity(selectedTag));
    return queryMatch && tagMatch;
  });
}
