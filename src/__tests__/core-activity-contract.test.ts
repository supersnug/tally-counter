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
import { applyCounterCommand, applyLimitEdit, splitActivityEntries } from "../features/counters/operations";

const counter = { id: "c1", name: "Counter", value: 9, start: 0, plusStep: 3, minusStep: 2, min: 0, max: 10, goals: [], goalDirection: "more", color: "#fff" };
describe("core operation and activity contract", () => {
  it("clamps and keeps retry identity", () => {
    const result = applyCounterCommand(counter, { type: "positive" }, "00000000-0000-4000-8000-000000000001", 10);
    expect(result).toMatchObject({ status: "accepted", transition: { eventId: "00000000-0000-4000-8000-000000000001", from: 9, to: 10, kind: "positive control" } });
  });
  it("rejects non-finite input and reports blocked movement unchanged", () => {
    expect(applyCounterCommand(counter, { type: "set", value: Infinity }, "00000000-0000-4000-8000-000000000002").status).toBe("rejected");
    expect(applyCounterCommand({ ...counter, value: 10 }, { type: "positive" }, "00000000-0000-4000-8000-000000000003").status).toBe("unchanged");
  });
  it("keeps unknown kinds and quarantines malformed entries", () => {
    const result = splitActivityEntries([{ eventId: "a", id: "c1", from: 1, to: 2, kind: "future", time: 1 }, { eventId: "b", id: "c1", from: 1, to: 1, kind: "reset", time: 2 }]);
    expect(result.valid).toHaveLength(1);
    expect(result.quarantine).toHaveLength(1);
  });
  it("orders limits and emits one clamp transition", () => {
    const result = applyLimitEdit({ ...counter, value: 20, start: 9, min: null, max: null }, 12, 5, "00000000-0000-4000-8000-000000000004", 4);
    expect(result).toMatchObject({ status: "accepted", counter: { min: 5, max: 12, value: 12, start: 9 }, transition: { kind: "limit-induced clamp", from: 20, to: 12 } });
  });
});
