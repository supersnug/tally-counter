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
import { describe, expect, test } from "vitest";
import { createBundleRepository, enterTrash } from "../features/counters/bundle";

const counter = { id: "counter-1", name: "Bundle", value: 3, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, folderId: null, tags: [] };

describe("counter bundle lifecycle", () => {
  test("retains and restores both linked members for a collision-free identity", () => {
    let saved;
    const repo = createBundleRepository({
      active: [counter],
      retained: [],
      scripts: { "counter-1": { language: "TallyScript", source: "add 1", enabled: true } },
      customizations: { "counter-1": { hidden: { goal: true } } },
    }, (next) => { saved = next; });

    repo.enterTrash("counter-1", 100);
    expect(repo.get().retained[0]).toMatchObject({ script: { source: "add 1" }, customization: { hidden: { goal: true } } });
    repo.restore("counter-1");
    expect(repo.get().active).toEqual([counter]);
    expect(repo.get().scripts["counter-1"].enabled).toBe(false);
    expect(repo.get().customizations["counter-1"]).toEqual({ hidden: { goal: true } });
    expect(saved).toEqual(repo.get());
  });

  test("remaps linked members on successful collision restore and preserves the active collision", () => {
    const retained = { ...counter, script: { language: "JavaScript", source: "Tally.add()", enabled: true }, customization: { scale: 2 }, deletedAt: 100, retainedUntil: 200 };
    const repo = createBundleRepository({ active: [{ ...counter, name: "Active collision" }], retained: [retained], scripts: {}, customizations: {} }, () => {});
    repo.restore("counter-1");
    const restored = repo.get().active.find((item) => item.name === counter.name);
    expect(restored?.id).toMatch(/^counter-1-restored-/);
    expect(repo.get().active.find((item) => item.name === "Active collision")).toEqual({ ...counter, name: "Active collision" });
    expect(repo.get().scripts[String(restored?.id)]).toMatchObject({ source: "Tally.add()", enabled: false });
    expect(repo.get().customizations[String(restored?.id)]).toEqual({ scale: 2 });
    expect(repo.get().retained).toEqual([]);
  });

  test("rolls back a failed collision restore with the complete prior aggregate", () => {
    const retained = { ...counter, script: { source: "add 1", enabled: true }, customization: { scale: 2 }, deletedAt: 100, retainedUntil: 200 };
    const initial = { active: [{ ...counter, name: "Active collision" }], retained: [retained], scripts: {}, customizations: {} };
    const repo = createBundleRepository(initial, () => { throw new Error("quota"); });
    expect(() => repo.restore("counter-1")).toThrow("quota");
    expect(repo.get()).toEqual(initial);
  });

  test("expires and permanently deletes every linked member", () => {
    const retained = { ...counter, deletedAt: 100, retainedUntil: 200, script: { source: "add" }, customization: { scale: 2 } };
    const repo = createBundleRepository({ active: [], retained: [retained], scripts: { "counter-1": { source: "orphan" } }, customizations: { "counter-1": { old: true } } }, () => {});
    repo.expire(200);
    expect(repo.get().retained).toEqual([]);
    expect(repo.get().scripts).toEqual({});
    expect(repo.get().customizations).toEqual({});
    repo.permanentDelete(["counter-1"]);
    expect(repo.get().active).toEqual([]);
  });
});

test("enterTrash keeps linked data on the retained bundle", () => {
  const retained = enterTrash({ ...counter, script: { source: "add 1" }, customization: { scale: 2 } }, 100);
  expect(retained).toMatchObject({ script: { source: "add 1" }, customization: { scale: 2 } });
});
