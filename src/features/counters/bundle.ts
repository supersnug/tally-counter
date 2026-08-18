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
import { sanitize, TRASH_LIFETIME, type AnyRecord } from "./model";
import { validateSuperCustomization } from "../tally-super/validator";

export type CounterBundle = { core: AnyRecord; script?: AnyRecord; customization?: AnyRecord; retainedUntil?: number; deletedAt?: number };
export type BundleRepositoryState = { active: AnyRecord[]; retained: AnyRecord[]; scripts: AnyRecord; customizations: AnyRecord };
export const BUNDLE_STORAGE_KEY = "tally-counter-bundle";
export const BUNDLE_VERSION = 1;

export function hydrateBundleState(storage: Storage, legacy: BundleRepositoryState): BundleRepositoryState {
  try {
    const raw = JSON.parse(storage.getItem(BUNDLE_STORAGE_KEY) || "null");
    if (raw?.version !== BUNDLE_VERSION || !raw.state || !Array.isArray(raw.state.active) || !Array.isArray(raw.state.retained)) return legacy;
    const existingQuarantine = (() => { try { const value = JSON.parse(storage.getItem("tally-counter-bundle-quarantine") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } })();
    const quarantine: AnyRecord[] = [...existingQuarantine];
    const isPlainMap = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
    const validate = (records: unknown[], retained: boolean) => records.flatMap((record) => {
      try {
        if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Bundle record is not an object.");
        const value = record as AnyRecord;
        if (value.id == null || (typeof value.id !== "string" && typeof value.id !== "number") || typeof value.name !== "string" || !value.name.trim() || !Number.isFinite(Number(value.value)) || !Number.isFinite(Number(value.start)) || !Number.isFinite(Number(value.plusStep)) || !Number.isFinite(Number(value.minusStep)) || !Array.isArray(value.goals) || value.goals.some((goal: unknown) => !Number.isFinite(Number(goal))) || !["more", "less"].includes(value.goalDirection) || (value.min != null && !Number.isFinite(Number(value.min))) || (value.max != null && !Number.isFinite(Number(value.max))) || typeof value.color !== "string" || !/^#[\da-f]{6}$/i.test(value.color)) throw new Error("Bundle record fields are invalid.");
        const counter = sanitize(record as AnyRecord);
        if (retained && (!Number.isFinite(value.deletedAt) || !Number.isFinite(value.retainedUntil))) throw new Error("Retained metadata is invalid.");
        return [{ ...counter, ...(retained ? { deletedAt: value.deletedAt, retainedUntil: value.retainedUntil } : {}) }];
      } catch { quarantine.push(record as AnyRecord); return []; }
    });
    const active = validate(raw.state.active, false);
    const retained = validate(raw.state.retained, true);
    const owners = new Set([...active, ...retained].map((record: AnyRecord) => String(record.id)));
    const scripts = isPlainMap(raw.state.scripts) ? Object.fromEntries(Object.entries(raw.state.scripts).filter(([id]) => owners.has(id))) : {};
    const customizations = isPlainMap(raw.state.customizations) ? Object.fromEntries(Object.entries(raw.state.customizations).filter(([id]) => owners.has(id))) : {};
    if (quarantine.length > existingQuarantine.length) { try { storage.setItem("tally-counter-bundle-quarantine", JSON.stringify(quarantine)); } catch { /* valid records remain usable when quarantine storage is unavailable */ } }
    return { active, retained, scripts, customizations };
  } catch { return legacy; }
}

export function persistBundleState(storage: Storage, state: BundleRepositoryState) {
  const previous = storage.getItem(BUNDLE_STORAGE_KEY);
  try { storage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify({ version: BUNDLE_VERSION, state })); }
  catch (error) { try { previous == null ? storage.removeItem(BUNDLE_STORAGE_KEY) : storage.setItem(BUNDLE_STORAGE_KEY, previous); } catch {} throw error; }
}

export function createBundleRepository(initial: BundleRepositoryState, persist: (next: BundleRepositoryState) => void, invoke = (_id: string) => {}) {
  let state = initial;
  const transact = (operation: (current: BundleRepositoryState) => BundleRepositoryState, ids: string[] = []) => {
    const previous = state;
    ids.forEach(invoke);
    const next = operation(previous);
    try { persist(next); state = next; return next; } catch (error) { state = previous; throw error; }
  };
  return {
    get: () => state,
    enterTrash: (id: string, now = Date.now()) => transact((current) => {
      const source = current.active.find((item) => String(item.id) === id); if (!source) return current;
      const bundle = enterTrash({ ...source, script: current.scripts[id], customization: current.customizations[id] }, now);
      const scripts = { ...current.scripts }; delete scripts[id];
      const customizations = { ...current.customizations }; delete customizations[id];
      return { ...current, active: current.active.filter((item) => String(item.id) !== id), retained: [bundle, ...current.retained], scripts, customizations };
    }, [id]),
    restore: (id: string) => transact((current) => {
      const retained = current.retained.find((item) => String(item.id) === id);
      if (!retained) return current;
      const restored = restoreBundle(current.active, retained).counter;
      const newId = String(restored.id);
      const scripts = { ...current.scripts };
      const customizations = { ...current.customizations };
      const script = retained.script || scripts[id];
      const customization = retained.customization || customizations[id];
      delete scripts[id];
      delete customizations[id];
      if (script) scripts[newId] = { ...script, enabled: false };
      if (customization) customizations[newId] = customization;
      const { script: _script, customization: _customization, ...core } = restored;
      return { ...current, active: [...current.active, core], retained: current.retained.filter((item) => String(item.id) !== id), scripts, customizations };
    }, [id]),
    expire: (now = Date.now()) => transact((current) => {
      const expired = current.retained.filter((item) => Number(item.retainedUntil || Number(item.deletedAt) + TRASH_LIFETIME) <= now);
      const ids = new Set(expired.map((item) => String(item.id)));
      const scripts = { ...current.scripts };
      const customizations = { ...current.customizations };
      ids.forEach((expiredId) => { delete scripts[expiredId]; delete customizations[expiredId]; });
      return { ...current, retained: current.retained.filter((item) => !ids.has(String(item.id))), scripts, customizations };
    }),
    permanentDelete: (ids: string[]) => transact((current) => {
      const wanted = new Set(ids); const scripts = { ...current.scripts }; const customizations = { ...current.customizations };
      ids.forEach((id) => { delete scripts[id]; delete customizations[id]; });
      return { active: permanentDelete(current.active, wanted), retained: permanentDelete(current.retained, wanted), scripts, customizations };
    }, ids),
  };
}

export const bundleFromCounter = (counter: AnyRecord): CounterBundle => ({
  core: sanitize(counter),
  ...(counter.script ? { script: counter.script } : {}),
  ...(counter.customization ? { customization: counter.customization.uiCustomizations ? { ...counter.customization, uiCustomizations: validateSuperCustomization(counter.customization.uiCustomizations) } : counter.customization } : {}),
  ...(counter.deletedAt != null ? { deletedAt: Number(counter.deletedAt), retainedUntil: Number(counter.retainedUntil || Number(counter.deletedAt) + TRASH_LIFETIME) } : {}),
});

export const bundleToCounter = (bundle: CounterBundle) => ({ ...bundle.core, ...(bundle.deletedAt != null ? { deletedAt: bundle.deletedAt, retainedUntil: bundle.retainedUntil } : {}) });

export function enterTrash(counter: AnyRecord, now = Date.now()) {
  const deletedAt = now;
  return {
    ...bundleToCounter({ ...bundleFromCounter(counter), deletedAt, retainedUntil: deletedAt + TRASH_LIFETIME }),
    ...(counter.script ? { script: counter.script } : {}),
    ...(counter.customization ? { customization: counter.customization } : {}),
  };
}

export function expireTrash(items: AnyRecord[], now = Date.now()) {
  return items.filter((item) => Number(item.retainedUntil || Number(item.deletedAt) + TRASH_LIFETIME) > now);
}

export function restoreBundle(items: AnyRecord[], counter: AnyRecord) {
  const { deletedAt, retainedUntil, ...restored } = counter;
  if (!items.some((item) => String(item.id) === String(restored.id))) return { counter: restored, collision: false };
  const id = `${restored.id}-restored-${crypto.randomUUID()}`;
  return { counter: { ...restored, id }, collision: true };
}

export function permanentDelete(items: AnyRecord[], ids: Iterable<string>) {
  const wanted = new Set([...ids].map(String));
  return items.filter((item) => !wanted.has(String(item.id)));
}

export function eligibleCloudBundles(active: AnyRecord[], retained: AnyRecord[], syncTrash: boolean) {
  return [...active.filter((item) => !item.localOnly), ...(syncTrash ? retained.filter((item) => !item.localOnly) : [])].map(sanitize);
}

export function convertToLocal(counter: AnyRecord) { return { ...counter, localOnly: true }; }
