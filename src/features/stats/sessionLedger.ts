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
import type { AnyRecord } from "../counters/model";

export type StatisticKey = "actions" | "net" | "distance" | "increments" | "decrements" | "resets" | "active" | "activeCounters" | "completedGoals";

export function buildStatisticResetBaseline(key: StatisticKey, counters: AnyRecord[], now = Date.now()) {
  if (key === "activeCounters") return counters.length;
  if (key === "completedGoals") return counters.filter((counter) => {
    const goals = Array.isArray(counter.goals) ? counter.goals : [];
    if (!goals.length) return false;
    const final = counter.goalDirection === "less" ? Math.min(...goals) : Math.max(...goals);
    return counter.goalDirection === "less" ? counter.value <= final : counter.value >= final;
  }).length;
  return now;
}

export function calculateSessionStats(ledger: AnyRecord[], counters: AnyRecord[], baselines: Partial<Record<StatisticKey, number>> = {}) {
  const since = (key: StatisticKey) => ledger.filter((entry) => entry.time > (baselines[key] || 0));
  const entries = since("actions");
  const counts = new Map<string, number>();
  for (const entry of since("active")) counts.set(String(entry.id), (counts.get(String(entry.id)) || 0) + 1);
  const leader = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    actions: entries.length,
    net: since("net").reduce((sum, entry) => sum + entry.to - entry.from, 0),
    distance: since("distance").reduce((sum, entry) => sum + Math.abs(entry.to - entry.from), 0),
    increments: since("increments").filter((entry) => entry.kind === "positive control").length,
    decrements: since("decrements").filter((entry) => entry.kind === "negative control").length,
    resets: since("resets").filter((entry) => entry.kind === "reset").length,
    mostActiveId: leader?.[0],
    mostActiveCount: leader?.[1] || 0,
    activeCounters: Math.max(0, counters.length - (baselines.activeCounters ?? baselines.active ?? 0)),
    completedGoals: Math.max(0, counters.filter((counter) => {
      const goals = Array.isArray(counter.goals) ? counter.goals : [];
      const final = counter.goalDirection === "less" ? Math.min(...goals) : Math.max(...goals);
      return goals.length > 0 && (counter.goalDirection === "less" ? counter.value <= final : counter.value >= final);
    }).length - (baselines.completedGoals || 0)),
  };
}

export function guardedPersist(key: string, value: unknown, storage: Storage = localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); return { ok: true as const }; }
  catch (error) { return { ok: false as const, error }; }
}
