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
import { allowlistedAnalyticsPayload } from "../lib/analytics";
import { buildLocalCopyBundle, commitLocalCopyAtomically, readCopyAcceptanceJournal, writeCopyAcceptanceJournal } from "../features/sharing/copyAcceptance";
import { createImportPlan, prepareImport } from "../features/settings/backupImport";
import { createBackup } from "../features/settings/backup";
import { guardedRead, guardedRawRead, guardedRawWrite } from "../shared/persistence/guardedStorage";
import { isCurrentSession, resolveConflict } from "../features/settings/sync";

const makeStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } as unknown as Storage;
};

const journal = {
  version: 1 as const,
  requestId: "7",
  operationId: "11111111-1111-4111-8111-111111111111",
  destinationId: "22222222-2222-4222-8222-222222222222",
  localOnly: true,
  includeScript: false,
  includeCustomization: false,
  stage: "claimed" as const,
};

const delivery = {
  state: "Pending",
  mode: "local",
  operationId: journal.operationId,
  destinationId: journal.destinationId,
  offeredScript: false,
  offeredCustomization: false,
  counter: { name: "Copied", value: 4, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" },
};

describe("repair-cycle public behavior seams", () => {
  it("rejects revoked sessions and stale acknowledgements independently", () => {
    expect(isCurrentSession({ sessionGeneration: 2, baseRevision: 4 }, 2, 4)).toBe(true);
    expect(isCurrentSession({ sessionGeneration: 1, baseRevision: 4 }, 2, 4)).toBe(false);
    expect(isCurrentSession({ sessionGeneration: 2, baseRevision: 3 }, 2, 4)).toBe(false);
  });

  it("keeps non-overlapping conflict records and applies singleton authority", () => {
    const result = resolveConflict(
      { counters: [{ id: "device", value: 1 }], folders: [], preferences: { density: "compact" }, workspace: { device: true } },
      { counters: [{ id: "cloud", value: 2 }], folders: [], preferences: { density: "spacious" }, workspace: { cloud: true } },
      "merge", 3, 3, { preferences: "device" },
    );
    expect(result.state).toBe("ready");
    expect(result.workspace.counters.map((item: { id: string }) => item.id)).toEqual(["device", "cloud"]);
    expect(result.workspace.preferences.density).toBe("compact");
  });

  it("round-trips scoped backup data while excluding history and account data", () => {
    const backup = createBackup({ counters: [{ id: "a", name: "A", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], folders: [], history: ["private"], account: { id: "private" } }, "counters", { selectedIds: ["a"] });
    const session = prepareImport(backup, "counters", "same");
    expect(session.excluded).toContain("history");
    expect(session.excluded).toContain("account/share/group/embed data");
    expect(createImportPlan({ counters: [], folders: [], trash: [], preferences: {}, superSettings: {}, scripts: {}, revision: "same" }, session).state.counters).toHaveLength(1);
  });

  it("persists a copy exactly once and rejects malformed acceptance records", () => {
    const storage = makeStorage();
    writeCopyAcceptanceJournal(storage, journal);
    expect(readCopyAcceptanceJournal(storage, "7")?.stage).toBe("claimed");
    const bundle = buildLocalCopyBundle(delivery, journal);
    const current = { active: [{ id: journal.destinationId, value: 0 }], retained: [], scripts: {}, customizations: {} };
    const first = commitLocalCopyAtomically(storage, current, bundle, journal);
    const second = commitLocalCopyAtomically(storage, first, bundle, { ...journal, stage: "persisted" });
    expect(second.active.filter((item) => item.id === journal.destinationId)).toHaveLength(1);
    storage.setItem("tally-copy-acceptance-journal", "{bad");
    expect(readCopyAcceptanceJournal(storage)).toBeNull();
  });

  it("preserves prior state across malformed, unavailable, security, and serialization storage failures", () => {
    const fallback = { records: [{ id: "safe" }] };
    const malformed = guardedRead(makeStorage({ state: "not-json" }), "state", fallback, (value): value is typeof fallback => Boolean(value && typeof value === "object" && Array.isArray((value as typeof fallback).records)));
    expect(malformed).toMatchObject({ ok: false, reason: "malformed", value: fallback });
    expect(guardedRawRead(null, "state", "safe")).toMatchObject({ ok: false, reason: "unavailable", value: "safe" });
    const security = { getItem: () => { throw Object.assign(new Error(), { name: "SecurityError" }); }, setItem: () => {}, removeItem: () => {} } as unknown as Storage;
    expect(guardedRawRead(security, "state", "safe")).toMatchObject({ ok: false, reason: "unavailable" });
    const blocked = { setItem: () => { throw new TypeError("cyclic"); }, getItem: () => null, removeItem: () => {} } as unknown as Storage;
    expect(guardedRawWrite(blocked, "state", "next", "safe")).toMatchObject({ ok: false, reason: "serialization", value: "safe" });
  });

  it("emits only route-safe embed telemetry payloads", () => {
    expect(allowlistedAnalyticsPayload("embed_view", "/embed?data=counter-secret")).toEqual({ event: "embed_view", route: "/embed" });
    expect(allowlistedAnalyticsPayload("route_view", "/counters?user=private")).toEqual({ event: "route_view", route: "/counters" });
  });
});
