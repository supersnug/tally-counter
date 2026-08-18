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
import { createPublicSnapshot, TRASH_LIFETIME } from "../features/counters/model";
import { BUNDLE_VERSION, createBundleRepository, eligibleCloudBundles, enterTrash, expireTrash, hydrateBundleState, permanentDelete, persistBundleState, restoreBundle, type BundleRepositoryState } from "../features/counters/bundle";

const counter = { id: "a", name: "A", value: 1, start: 0, plusStep: 1, minusStep: 1, min: null, max: null, tags: [] };

describe("atomic counter bundle lifecycle", () => {
  it("sets an exact five-day retained deadline and expires idempotently", () => {
    const deleted = enterTrash(counter, 1000);
    expect(deleted.retainedUntil).toBe(1000 + TRASH_LIFETIME);
    expect(expireTrash([deleted], deleted.retainedUntil)).toEqual([]);
    expect(expireTrash([], deleted.retainedUntil)).toEqual([]);
  });
  it("allocates a collision identity on restore and preserves the original otherwise", () => {
    expect(restoreBundle([], enterTrash(counter)).collision).toBe(false);
    const restored = restoreBundle([{ id: "a" }], enterTrash(counter));
    expect(restored.collision).toBe(true);
    expect(restored.counter.id).not.toBe("a");
  });
  it("excludes Local bundles and optionally retained bundles from cloud payloads", () => {
    expect(eligibleCloudBundles([{ ...counter, localOnly: true }], [{ ...counter, id: "b" }], false)).toEqual([]);
    expect(eligibleCloudBundles([{ ...counter, localOnly: false }], [{ ...counter, id: "b" }], true)).toHaveLength(2);
    expect(permanentDelete([{ id: "a" }, { id: "b" }], ["a"])).toEqual([{ id: "b" }]);
  });
  it("rolls back the aggregate when a member write fails after stopping invocation", () => {
    const stopped: string[] = [];
    const repository = createBundleRepository({ active: [counter], retained: [], scripts: { a: { source: "add 1" } }, customizations: { a: { parts: {} } } }, () => { throw new Error("quota"); }, (id) => stopped.push(id));
    expect(() => repository.enterTrash("a", 1000)).toThrow("quota");
    expect(repository.get().active).toEqual([counter]);
    expect(stopped).toEqual(["a"]);
  });
  it("moves linked members into retained state without leaving active map orphans", () => {
    let state: BundleRepositoryState = { active: [counter], retained: [], scripts: { a: { source: "add" } }, customizations: { a: { parts: {} } } };
    const repository = createBundleRepository(state, (next) => { state = next; });
    state = repository.enterTrash("a", 1000);
    expect(state.scripts).toEqual({});
    expect(state.customizations).toEqual({});
    expect(state.retained[0]).toMatchObject({ id: "a", script: { source: "add" }, customization: { parts: {} } });
  });
  it("hydrates legacy state, persists one versioned aggregate, and recovers malformed optional members", () => {
    const storage = new Map<string, string>();
    const fake = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } as unknown as Storage;
    const legacy = { active: [counter], retained: [], scripts: {}, customizations: {} };
    persistBundleState(fake, legacy);
    expect(JSON.parse(fake.getItem("tally-counter-bundle")!).version).toBe(BUNDLE_VERSION);
    storage.set("tally-counter-bundle", JSON.stringify({ version: BUNDLE_VERSION, state: { active: legacy.active, retained: [], scripts: null, customizations: [] } }));
    expect(hydrateBundleState(fake, legacy).active).toEqual(legacy.active);
    expect(hydrateBundleState(fake, legacy).scripts).toEqual({});
  });
  it("writes only the aggregate key for lifecycle persistence", () => {
    const writes: string[] = [];
    const storage = { getItem: () => null, setItem: (key: string) => writes.push(key), removeItem: () => {} } as unknown as Storage;
    persistBundleState(storage, { active: [counter], retained: [], scripts: {}, customizations: {} });
    expect(writes).toEqual(["tally-counter-bundle"]);
  });
  it("keeps an embed snapshot usable after its source bundle is gone", () => {
    const snapshot = createPublicSnapshot(counter);
    const source = null;
    expect(snapshot.display.name).toBe("A");
    expect(source).toBeNull();
    expect(snapshot.counting.plusStep).toBe(1);
  });
});
