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
import { exportRecovery, guardedAtomicWrite, guardedRead, guardedWrite } from "../shared/persistence/guardedStorage";

const valid = (value: unknown): value is { records: Array<{ id: string }> } => Boolean(value && typeof value === "object" && Array.isArray((value as any).records));
const storage = (values: Record<string, string> = {}) => ({ ...values, getItem(key: string) { return this[key] ?? null; }, setItem(key: string, value: string) { this[key] = value; }, removeItem(key: string) { delete this[key]; } }) as unknown as Storage & Record<string, string>;

describe("guarded persistence", () => {
  it("quarantines malformed JSON without replacing valid in-memory authority", () => {
    const result = guardedRead(storage({ section: "{" }), "section", { records: [{ id: "valid" }] }, valid);
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: "malformed", value: { records: [{ id: "valid" }] } }));
  });
  it("keeps prior authority on quota/security/serialization failures and reports retry state", () => {
    const previous = { records: [{ id: "old" }] };
    const failing = storage() as any; failing.setItem = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
    expect(guardedWrite(failing, "section", { records: [{ id: "new" }] }, previous, valid)).toMatchObject({ ok: false, value: previous, reason: "quota" });
    expect(guardedWrite(storage(), "section", { records: [{ id: "new" }] }, previous, (() => false) as unknown as (value: unknown) => value is { records: Array<{ id: string }> })).toMatchObject({ ok: false, value: previous });
  });
  it("rolls back atomic lifecycle writes and creates a safe recovery export", () => {
    const target = storage({ one: "old", two: "old" });
    const original = target.setItem.bind(target); let calls = 0; target.setItem = (key, value) => { calls += 1; if (calls === 2) throw new Error("quota"); original(key, value); };
    expect(guardedAtomicWrite(target, [["one", "new"], ["two", "new"]], [["one", "old"], ["two", "old"]])).toMatchObject({ ok: false });
    expect(target.getItem("one")).toBe("old");
    expect(exportRecovery({ records: [{ id: "safe" }], telemetry: undefined })).toContain("tally-recovery");
  });
});
