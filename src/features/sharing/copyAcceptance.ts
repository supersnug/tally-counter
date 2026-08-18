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
import { BUNDLE_STORAGE_KEY, type BundleRepositoryState } from "../counters/bundle";
import { commitStorageAtomically } from "../settings/backupImport";
import { sanitize, type AnyRecord } from "../counters/model";

export const COPY_ACCEPTANCE_JOURNAL_KEY = "tally-copy-acceptance-journal";
export type CopyAcceptanceJournal = {
  version: 1;
  requestId: string;
  operationId: string;
  destinationId: string;
  localOnly: boolean;
  includeScript: boolean;
  includeCustomization: boolean;
  stage: "claimed" | "persisted" | "finalizing";
};
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const JOURNAL_KEYS = ["version", "requestId", "operationId", "destinationId", "localOnly", "includeScript", "includeCustomization", "stage"];
const isDecimalId = (value: unknown) => typeof value === "string" && /^[1-9][0-9]*$/.test(value);

export function readCopyAcceptanceJournal(storage: Storage, requestId?: string): CopyAcceptanceJournal | null {
  try {
    const value = JSON.parse(storage.getItem(COPY_ACCEPTANCE_JOURNAL_KEY) || "null");
    const valid = value && Object.keys(value).sort().join(",") === [...JOURNAL_KEYS].sort().join(",") && value.version === 1 && isDecimalId(value.requestId) && (requestId == null || value.requestId === requestId) && isUuid(value.operationId) && ((value.stage === "claimed" && value.destinationId === "") || isUuid(value.destinationId)) && typeof value.localOnly === "boolean" && typeof value.includeScript === "boolean" && typeof value.includeCustomization === "boolean" && ["claimed", "persisted", "finalizing"].includes(value.stage);
    if (!valid) { if (storage.getItem(COPY_ACCEPTANCE_JOURNAL_KEY) != null) storage.removeItem(COPY_ACCEPTANCE_JOURNAL_KEY); return null; }
    return value;
  } catch { storage.removeItem(COPY_ACCEPTANCE_JOURNAL_KEY); return null; }
}

export function writeCopyAcceptanceJournal(storage: Storage, journal: CopyAcceptanceJournal) {
  const safe = { ...journal };
  storage.setItem(COPY_ACCEPTANCE_JOURNAL_KEY, JSON.stringify(safe));
}

export function clearCopyAcceptanceJournal(storage: Storage) {
  storage.removeItem(COPY_ACCEPTANCE_JOURNAL_KEY);
}

export function buildLocalCopyBundle(delivery: AnyRecord, journal: CopyAcceptanceJournal) {
  if (!delivery || typeof delivery !== "object" || delivery.state !== "Pending" || delivery.mode !== "local" || delivery.operationId !== journal.operationId || delivery.destinationId !== journal.destinationId || typeof delivery.offeredScript !== "boolean" || typeof delivery.offeredCustomization !== "boolean" || (journal.includeScript && delivery.offeredScript !== true) || (journal.includeCustomization && delivery.offeredCustomization !== true) || !delivery.counter) throw new Error("The counter copy delivery is malformed or does not match the bound operation.");
  const allowedCounterKeys = ["name", "value", "start", "plusStep", "minusStep", "goals", "goalDirection", "min", "max", "color"];
  if (Object.keys(delivery.counter).some((key) => !allowedCounterKeys.includes(key)) || typeof delivery.counter.name !== "string" || !Number.isFinite(delivery.counter.value) || !Number.isFinite(delivery.counter.start) || !Number.isFinite(delivery.counter.plusStep) || !Number.isFinite(delivery.counter.minusStep) || !Array.isArray(delivery.counter.goals) || delivery.counter.goals.some((goal: unknown) => typeof goal !== "number" || !Number.isFinite(goal)) || !["more", "less"].includes(delivery.counter.goalDirection) || typeof delivery.counter.color !== "string" || (delivery.counter.min != null && (typeof delivery.counter.min !== "number" || !Number.isFinite(delivery.counter.min))) || (delivery.counter.max != null && (typeof delivery.counter.max !== "number" || !Number.isFinite(delivery.counter.max)))) throw new Error("The delivered counter is malformed.");
  if (journal.includeScript && (!delivery.script || typeof delivery.script.source !== "string" || !["tallyscript", "javascript"].includes(delivery.script.language))) throw new Error("The delivered script is malformed.");
  if (journal.includeCustomization && (!delivery.customization || typeof delivery.customization !== "object" || Array.isArray(delivery.customization))) throw new Error("The delivered customization is malformed.");
  const counter = sanitize({ ...delivery.counter, id: journal.destinationId, localOnly: true });
  const script = journal.includeScript && delivery.script ? { source: delivery.script.source, language: delivery.script.language, enabled: false } : undefined;
  const customization = journal.includeCustomization && delivery.customization ? delivery.customization : undefined;
  return { counter, script, customization };
}

export function commitLocalCopyAtomically(storage: Storage, current: BundleRepositoryState, bundle: ReturnType<typeof buildLocalCopyBundle>, journal?: CopyAcceptanceJournal) {
  const scripts = { ...current.scripts, ...(bundle.script ? { [bundle.counter.id]: bundle.script } : {}) };
  const customizations = { ...current.customizations, ...(bundle.customization ? { [bundle.counter.id]: bundle.customization } : {}) };
  const active = [...current.active.filter((item) => String(item.id) !== String(bundle.counter.id)), bundle.counter];
  const next = { active, retained: current.retained, scripts, customizations };
  const safeJournal = journal ? { ...journal, stage: "persisted" as const } : null;
  const result = commitStorageAtomically(storage, { [BUNDLE_STORAGE_KEY]: JSON.stringify({ version: 1, state: next }), ...(safeJournal ? { [COPY_ACCEPTANCE_JOURNAL_KEY]: JSON.stringify(safeJournal) } : {}) });
  if (!result.ok) throw new Error("This local copy could not be saved; your existing counters are unchanged.");
  return next;
}

export function reconcileCloudWorkspace(cloud: AnyRecord, local: AnyRecord) {
  const localActive = (local.active || []).filter((item: AnyRecord) => item.localOnly).map((item: AnyRecord) => ({ ...item }));
  const localRetained = (local.retained || []).filter((item: AnyRecord) => item.localOnly).map((item: AnyRecord) => ({ ...item }));
  const localIds = new Set([...localActive, ...localRetained].map((item: AnyRecord) => String(item.id)));
  const cloudCounters = (cloud.counters || []).filter((item: AnyRecord) => !localIds.has(String(item.id)));
  const cloudFolders = Array.isArray(cloud.folders) ? cloud.folders.map((folder: AnyRecord) => ({ ...folder })) : [];
  const folders = [...cloudFolders];
  const folderIds = new Set(folders.map((folder) => String(folder.id)));
  const localFolderIds = new Map<string, string>();
  const localFolderSource = Array.isArray(local.folders) ? local.folders : [];
  const addFolderChain = (folderId: unknown) => {
    if (folderId == null || folderId === "") return null;
    const key = String(folderId); if (localFolderIds.has(key)) return localFolderIds.get(key);
    const source = localFolderSource.find((folder: AnyRecord) => String(folder.id) === key); if (!source) return null;
    const parentId = addFolderChain(source.parentId);
    const mapped = folderIds.has(key) ? `${key}-local-${crypto.randomUUID()}` : key;
    folders.push({ id: mapped, name: source.name, parentId }); folderIds.add(mapped); localFolderIds.set(key, mapped); return mapped;
  };
  for (const counter of [...localActive, ...localRetained]) counter.folderId = addFolderChain(counter.folderId);
  const scripts = { ...(cloud.scripts || {}) };
  const customizations = { ...(cloud.customizations || {}) };
  for (const item of [...localActive, ...localRetained]) { const id = String(item.id); if (local.scripts?.[id]) scripts[id] = { source: local.scripts[id].source, language: local.scripts[id].language, enabled: false }; if (local.customizations?.[id]) customizations[id] = local.customizations[id]; }
  return { counters: [...localActive, ...cloudCounters], retained: localRetained, scripts, customizations, folders };
}

export function shouldBlockCloudConflict(deviceCount: number, cloudCount: number, differs: boolean, authoritativeCopy: boolean) {
  return deviceCount > 0 && cloudCount > 0 && differs && !authoritativeCopy;
}
