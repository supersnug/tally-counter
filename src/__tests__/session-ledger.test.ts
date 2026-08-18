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
import { calculateSessionStats, guardedPersist } from "../features/stats/sessionLedger";

describe("independent session statistics ledger", () => {
  it("counts generic movement while keeping control counts specific", () => {
    const ledger = [
      { id: "a", from: 0, to: 2, kind: "future", time: 1 },
      { id: "a", from: 2, to: 3, kind: "positive control", time: 2 },
      { id: "b", from: 4, to: 2, kind: "negative control", time: 3 },
    ];
    expect(calculateSessionStats(ledger, [{ id: "a", goals: [], value: 3 }, { id: "b", goals: [], value: 2 }])).toMatchObject({ actions: 3, net: 1, distance: 5, increments: 1, decrements: 1, activeCounters: 2 });
  });
  it("keeps each baseline independent", () => {
    const stats = calculateSessionStats([{ id: "a", from: 0, to: 1, kind: "positive control", time: 5 }], [{ id: "a", goals: [], value: 1 }], { actions: 5 });
    expect(stats.actions).toBe(0);
    expect(stats.net).toBe(1);
  });
  it("reports persistence failure without replacing prior state", () => {
    const storage = { setItem: () => { throw new Error("quota"); } } as unknown as Storage;
    expect(guardedPersist("history", [], storage).ok).toBe(false);
  });
});
