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
import { sanitize, type AnyRecord } from "../counters/model";
import { normalizePreferences } from "./preferences";
import { normalizeIdentity } from "../counters/organization";

export const BACKUP_FORMAT = "tally-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_SCOPES = ["counters", "super", "all"] as const;
export type BackupScope = (typeof BACKUP_SCOPES)[number];

const PRESENTATION_KEYS = ["density", "columns", "numberSize", "showBounds", "animations", "defaultColor"] as const;
const CORE_KEYS = new Set(["id", "name", "value", "start", "plusStep", "minusStep", "goals", "goalDirection", "min", "max", "color", "tags", "folderId", "localOnly"]);
const projectCounter = (raw: AnyRecord, strict = false) => {
  if (!raw || typeof raw !== "object" || raw.id == null || typeof raw.name !== "string" || !raw.name.trim() || !Number.isFinite(Number(raw.value)) || !Number.isFinite(Number(raw.start)) || !Number.isFinite(Number(raw.plusStep)) || !Number.isFinite(Number(raw.minusStep)) || !Array.isArray(raw.goals) || raw.goals.some((goal: unknown) => !Number.isFinite(Number(goal))) || !["more", "less"].includes(raw.goalDirection) || (raw.min != null && !Number.isFinite(Number(raw.min))) || (raw.max != null && !Number.isFinite(Number(raw.max))) || typeof raw.color !== "string" || !/^#[\da-f]{6}$/i.test(raw.color) || (raw.tags != null && !Array.isArray(raw.tags))) throw new Error("Counter record is invalid.");
  if (strict && (typeof raw.value !== "number" || typeof raw.start !== "number" || typeof raw.plusStep !== "number" || typeof raw.minusStep !== "number" || (raw.min != null && typeof raw.min !== "number") || (raw.max != null && typeof raw.max !== "number") || (raw.localOnly != null && typeof raw.localOnly !== "boolean") || (raw.folderId != null && typeof raw.folderId !== "string") || (raw.tags || []).some((tag: unknown) => typeof tag !== "string") || (typeof raw.id !== "string" && typeof raw.id !== "number"))) throw new Error("Counter record fields are invalid.");
  if (strict && Object.keys(raw).some((key) => !CORE_KEYS.has(key))) throw new Error("Counter contains unsupported fields.");
  const low = raw.min == null ? null : Number(raw.min); const high = raw.max == null ? null : Number(raw.max); const min = low == null || high == null ? low : Math.min(low, high); const max = low == null || high == null ? high : Math.max(low, high); const clamp = (value: number) => Math.max(min == null ? value : min, Math.min(max == null ? value : max, value));
  return { id: raw.id, name: raw.name.trim(), value: clamp(Number(raw.value)), start: clamp(Number(raw.start)), plusStep: Math.abs(Number(raw.plusStep)) || 1, minusStep: Math.abs(Number(raw.minusStep)) || 1, goals: [...new Set(raw.goals.map(Number))], goalDirection: raw.goalDirection, min, max, color: raw.color, tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean))] : [], ...(raw.folderId != null ? { folderId: String(raw.folderId) } : {}), ...(raw.localOnly ? { localOnly: true } : {}) };
};
const projectFolder = (raw: AnyRecord) => ({ id: raw.id, name: String(raw.name).trim(), parentId: raw.parentId == null ? null : raw.parentId });
const projectScript = (raw: AnyRecord) => { if (typeof raw.source !== "string" || !["tallyscript", "javascript"].includes(raw.language)) throw new Error("Script record is invalid."); return { source: raw.source, language: raw.language, enabled: false }; };
const projectCustomization = (raw: unknown) => structuredClone(raw && typeof raw === "object" ? raw : {});

export function createBackup(input: AnyRecord, scope: BackupScope, options: AnyRecord = {}) {
  if (scope === "counters" && (!Array.isArray(options.selectedIds) || options.selectedIds.length === 0)) throw new Error("Select at least one active counter.");
  const selected = scope === "counters" && Array.isArray(options.selectedIds) ? new Set(options.selectedIds.map(String)) : null;
  const sourceCounters = Array.isArray(input.counters) ? input.counters : [];
  if (scope === "counters" && sourceCounters.filter((counter) => selected?.has(String(counter.id))).length !== selected?.size) throw new Error("Every selected counter must exist and be active.");
  const counters = sourceCounters.filter((counter: AnyRecord) => !selected || selected.has(String(counter.id))).map((counter) => projectCounter(counter));
  const retainedSource = Array.isArray(input.trash) ? input.trash : [];
  const allOwnerIds = new Set([...sourceCounters, ...retainedSource].map((counter: AnyRecord) => String(counter.id)));
  const linked = (records: AnyRecord = {}, project = (value: AnyRecord) => value, owners: Set<string> | null = null) => Object.fromEntries(Object.entries(records).filter(([id]) => owners ? owners.has(String(id)) : !selected || selected.has(String(id))).map(([id, value]) => [id, project(value as AnyRecord)]));
  const payload: AnyRecord = { format: BACKUP_FORMAT, version: BACKUP_VERSION, scope, exportedAt: new Date().toISOString(), included: [], sections: {} };
  if (scope === "counters" || scope === "all") {
    payload.sections.counters = counters;
    const allFolders = Array.isArray(input.folders) ? input.folders : [];
    if (scope === "all") payload.sections.folders = allFolders.map(projectFolder);
    else {
      const needed = new Set(counters.map((counter) => counter.folderId).filter(Boolean).map(String));
      let changed = true;
      while (changed) { changed = false; for (const folder of allFolders) if (needed.has(String(folder.id)) && folder.parentId != null && !needed.has(String(folder.parentId))) { needed.add(String(folder.parentId)); changed = true; } }
      payload.sections.folders = allFolders.filter((folder) => needed.has(String(folder.id))).map(projectFolder);
    }
    if (options.includeScripts) payload.sections.scripts = linked(input.scripts, projectScript);
    if (options.includeCounterCustomizations) payload.sections.counterCustomizations = linked(input.counterCustomizations, projectCustomization);
  }
  if (scope === "super" || scope === "all") {
    payload.sections.workspace = input.superSettings?.uiCustomizations || {};
    const preferences = normalizePreferences(input.preferences);
    payload.sections.preferences = scope === "all" ? structuredClone(preferences) : Object.fromEntries(PRESENTATION_KEYS.map((key) => [key, preferences[key]]));
  }
  if (scope === "all") {
    payload.sections.trash = Array.isArray(input.trash) ? input.trash.map((counter) => ({ ...projectCounter(counter), deletedAt: counter.deletedAt, retainedUntil: counter.retainedUntil ?? Number(counter.deletedAt) + 5 * 24 * 60 * 60 * 1000 })) : [];
    payload.sections.scripts = linked(input.scripts, projectScript, allOwnerIds);
    payload.sections.counterCustomizations = linked(input.counterCustomizations, projectCustomization, allOwnerIds);
  }
  payload.included = Object.keys(payload.sections).sort();
  return payload;
}

export function validateBackup(raw: unknown, expectedScope?: BackupScope) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Backup must be an object.");
  const value = raw as AnyRecord;
  if (Object.keys(value).some((key) => !["format", "version", "scope", "exportedAt", "included", "sections"].includes(key))) throw new Error("Backup contains unsupported top-level fields.");
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) throw new Error("Unsupported backup format or version.");
  if (!BACKUP_SCOPES.includes(value.scope) || (expectedScope && value.scope !== expectedScope)) throw new Error("Backup scope does not match the selected import.");
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) throw new Error("Backup export time is invalid.");
  const sections = value.sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) throw new Error("Backup sections are missing.");
  const allowedByScope: Record<BackupScope, string[]> = { counters: ["counters", "folders", "scripts", "counterCustomizations"], super: ["workspace", "preferences"], all: ["counters", "trash", "folders", "scripts", "counterCustomizations", "workspace", "preferences"] };
  const sectionKeys = Object.keys(sections).sort();
  if (!Array.isArray(value.included) || value.included.some((item: unknown) => typeof item !== "string") || JSON.stringify([...value.included].sort()) !== JSON.stringify(sectionKeys) || sectionKeys.some((key) => !allowedByScope[value.scope as BackupScope].includes(key))) throw new Error("Backup section metadata or scope payload is invalid.");
  if ((value.scope === "counters" || value.scope === "all") && !Array.isArray(sections.counters)) throw new Error("Counter records are missing.");
  if ((value.scope === "counters" || value.scope === "all") && !Array.isArray(sections.folders)) throw new Error("Folder records are missing.");
  if (value.scope === "all" && !Array.isArray(sections.trash)) throw new Error("Retained bundle records are missing.");
  if (value.scope === "all" && (!Object.prototype.hasOwnProperty.call(sections, "scripts") || !Object.prototype.hasOwnProperty.call(sections, "counterCustomizations"))) throw new Error("All backup linked sections are missing.");
  if ((value.scope === "super" || value.scope === "all") && (!sections.workspace || typeof sections.workspace !== "object" || Array.isArray(sections.workspace))) throw new Error("Workspace customization is missing.");
  const counters = Array.isArray(sections.counters) ? sections.counters.map((counter: AnyRecord) => projectCounter(structuredClone(counter), true)) : [];
  const ids = new Set<string>();
  for (const counter of counters) {
    const id = String(counter.id);
    if (ids.has(id)) throw new Error("Backup contains duplicate counter identities.");
    ids.add(id);
    if (!Number.isFinite(counter.value) || !Number.isFinite(counter.start)) throw new Error("Backup contains invalid numeric data.");
  }
  const folders = Array.isArray(sections.folders) ? sections.folders : [];
  const folderIds = new Set<string>();
  const parents = new Map<string, string | null>();
  for (const folder of folders) {
    if (!folder || typeof folder !== "object" || !folder.id || typeof folder.name !== "string" || !folder.name.trim()) throw new Error("Folder record is invalid.");
    if (Object.keys(folder).some((key) => !["id", "name", "parentId"].includes(key)) || (typeof folder.id !== "string" && typeof folder.id !== "number") || (folder.parentId != null && typeof folder.parentId !== "string" && typeof folder.parentId !== "number")) throw new Error("Folder fields are invalid.");
    const id = String(folder.id);
    if (folderIds.has(id)) throw new Error("Backup contains duplicate folder identities.");
    folderIds.add(id);
    parents.set(id, folder.parentId == null ? null : String(folder.parentId));
  }
  const siblingPaths = new Set<string>();
  for (const folder of folders) { const parent = folder.parentId == null ? "" : String(folder.parentId); const key = `${parent}/${normalizeIdentity(folder.name)}`; if (siblingPaths.has(key)) throw new Error("Folder path collision."); siblingPaths.add(key); }
  for (const [id, parent] of parents) {
    if (parent != null && (!folderIds.has(parent) || parent === id)) throw new Error("Folder parent reference is invalid.");
    const seen = new Set<string>();
    let current: string | null = id;
    while (current != null) {
      if (seen.has(current)) throw new Error("Folder hierarchy contains a cycle.");
      seen.add(current);
      current = parents.get(current) ?? null;
    }
  }
  for (const counter of counters) {
    if (counter.folderId != null && counter.folderId !== "" && !folderIds.has(String(counter.folderId))) throw new Error("Counter folder reference is invalid.");
  }
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  const trash = Array.isArray(sections.trash) ? sections.trash.filter((counter: AnyRecord) => {
    if (counter.deletedAt == null || counter.retainedUntil == null) throw new Error("Retained metadata is incomplete.");
    if (typeof counter.deletedAt !== "number" || typeof counter.retainedUntil !== "number") throw new Error("Retained metadata types are invalid.");
    const deletedAt = counter.deletedAt;
    if (!Number.isFinite(deletedAt)) throw new Error("Retained deletion time is invalid.");
    const expectedDeadline = deletedAt + fiveDays;
    if (counter.retainedUntil !== expectedDeadline) throw new Error("Retained deadline is invalid.");
    return expectedDeadline > Date.now();
  }).map((counter: AnyRecord) => ({ ...projectCounter(Object.fromEntries(Object.entries(counter).filter(([key]) => !["deletedAt", "retainedUntil"].includes(key))), true), deletedAt: Number(counter.deletedAt), retainedUntil: Number(counter.retainedUntil) })) : [];
  for (const counter of trash) { if (ids.has(String(counter.id))) throw new Error("Active and retained counter identities must be unique."); ids.add(String(counter.id)); }
  const expiredRetainedIds = new Set((Array.isArray(sections.trash) ? sections.trash : []).filter((counter: AnyRecord) => typeof counter.deletedAt === "number" && typeof counter.retainedUntil === "number" && counter.retainedUntil <= Date.now()).map((counter: AnyRecord) => String(counter.id)));
  const validateLinked = (section: unknown, name: string) => {
    if (section == null) return {};
    if (typeof section !== "object" || Array.isArray(section)) throw new Error(`${name} section is invalid.`);
    const linked = structuredClone(section) as AnyRecord;
    for (const [id, record] of Object.entries(linked)) {
       if (expiredRetainedIds.has(String(id))) { delete linked[id]; continue; }
       if (!ids.has(String(id))) throw new Error(`${name} references an unselected counter.`);
       if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${name} record is invalid.`);
       if (name === "Scripts" && (Object.keys(record).some((key) => !["source", "language", "enabled"].includes(key)) || !["tallyscript", "javascript"].includes((record as AnyRecord).language) || typeof (record as AnyRecord).enabled !== "boolean")) throw new Error("Script record fields are invalid.");
       if (name === "Scripts") {
         if (typeof (record as AnyRecord).source !== "string") throw new Error("Script source is invalid.");
         linked[id] = { source: (record as AnyRecord).source, language: (record as AnyRecord).language, enabled: false };
       }
    }
    return linked;
  };
  const scripts = validateLinked(sections.scripts, "Scripts");
  const counterCustomizations = validateLinked(sections.counterCustomizations, "Customization");
  if ((value.scope === "super" || value.scope === "all") && (!sections.preferences || typeof sections.preferences !== "object")) throw new Error("Presentation preferences are missing.");
  if (value.scope === "all" && sections.preferences && !Object.prototype.hasOwnProperty.call(sections.preferences, "theme")) sections.preferences.theme = "light";
  const preferenceKeys: string[] = value.scope === "all" ? ["density", "columns", "numberSize", "showBounds", "animations", "defaultColor", "trashEnabled", "syncTrash", "theme"] : [...PRESENTATION_KEYS];
  if ((value.scope === "super" || value.scope === "all") && (Object.keys(sections.preferences).length !== preferenceKeys.length || Object.keys(sections.preferences).some((key) => !preferenceKeys.includes(key)))) throw new Error("Preference section keys are invalid.");
  const preferenceValues: AnyRecord = { density: ["compact", "comfortable", "spacious"], columns: ["auto", "2", "3", "4"], numberSize: ["small", "standard", "large"], showBounds: "boolean", animations: "boolean", defaultColor: /^#[0-9a-f]{6}$/i, trashEnabled: "boolean", syncTrash: "boolean", theme: ["light", "dark"] };
  if (value.scope === "super" || value.scope === "all") for (const key of preferenceKeys) { const expected = preferenceValues[key]; const actual = sections.preferences[key]; if (expected === "boolean" ? typeof actual !== "boolean" : expected instanceof RegExp ? typeof actual !== "string" || !expected.test(actual) : !expected.includes(actual)) throw new Error("Preference value is invalid."); }
  const preferences = (value.scope === "super" || value.scope === "all") ? Object.fromEntries(preferenceKeys.map((key) => [key, sections.preferences[key]])) : undefined;
  return { format: value.format, version: value.version, scope: value.scope, exportedAt: value.exportedAt, included: [...value.included], sections: { ...sections, counters, folders, trash, scripts, counterCustomizations, ...(preferences ? { preferences } : {}) } };
}
