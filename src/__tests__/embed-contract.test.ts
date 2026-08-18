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
import { COLORS, createPublicSnapshot, decodeCounterResult, encodeCounter } from "../features/counters/model";

const counter = { name: "Public", value: 2, start: 0, plusStep: 1, minusStep: 1, goals: [5], goalDirection: "more", min: null, max: 10, color: COLORS[0], secret: "remove" };

describe("public snapshot contract", () => {
  it("projects only the public display, counting, goals, and options fields", () => {
    const snapshot = createPublicSnapshot({ ...counter, embedOptions: { compact: true, watermark: false, reset: false, settings: true, theme: "dark" } });
    expect(snapshot).toEqual({ format: "tally-counter-snapshot", version: 1, display: { name: "Public", value: 2, start: 0, color: COLORS[0] }, counting: { plusStep: 1, minusStep: 1, min: null, max: 10 }, goals: { values: [5], direction: "more" }, options: { compact: true, watermark: false, reset: false, settings: true, theme: "dark" } });
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });

  it("categorizes malformed, truncated, version, schema, and numeric payloads", () => {
    expect(decodeCounterResult(null)).toMatchObject({ ok: false, reason: "missing" });
    expect(decodeCounterResult("bad")).toMatchObject({ ok: false });
    expect(decodeCounterResult(encodeCounter(counter).slice(0, -3))).toMatchObject({ ok: false, reason: "truncated" });
    const snapshot = createPublicSnapshot(counter);
    expect(decodeCounterResult(btoa(JSON.stringify({ ...snapshot, version: 9 })))).toMatchObject({ ok: false, reason: "version" });
    expect(decodeCounterResult(btoa(JSON.stringify({ ...snapshot, options: null })))).toMatchObject({ ok: false, reason: "schema" });
    expect(decodeCounterResult(btoa(JSON.stringify({ ...snapshot, display: { ...snapshot.display, value: NaN } })))).toMatchObject({ ok: false, reason: "numeric" });
  });

  it("rejects unsupported source colors before markup generation", () => {
    expect(() => createPublicSnapshot({ ...counter, color: "\"><script>" })).toThrow();
    expect(createPublicSnapshot({ ...counter, name: "" }).display.name).toBe("Untitled counter");
    expect(decodeCounterResult(btoa(JSON.stringify({ ...createPublicSnapshot(counter), display: { ...createPublicSnapshot(counter).display, color: "#123456" } })))).toMatchObject({ ok: false, reason: "schema" });
  });
});
