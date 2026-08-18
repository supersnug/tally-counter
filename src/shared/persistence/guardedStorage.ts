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
export type GuardedResult<T> = { ok: true; value: T } | { ok: false; value: T; reason: "unavailable" | "malformed" | "quota" | "serialization"; error?: unknown };

type FailureReason = "unavailable" | "malformed" | "quota" | "serialization";
const reason = (error: unknown): FailureReason => {
  if (error instanceof SyntaxError) return "malformed";
  const name = error && typeof error === "object" ? (error as { name?: string }).name : undefined;
  if (name === "QuotaExceededError" || name === "SecurityError") return name === "QuotaExceededError" ? "quota" : "unavailable";
  return "serialization";
};

export function guardedRead<T>(storage: Storage | null | undefined, key: string, fallback: T, validate: (value: unknown) => value is T): GuardedResult<T> {
  if (!storage) return { ok: false, value: fallback, reason: "unavailable" };
  try {
    const raw = storage.getItem(key);
    if (raw == null) return { ok: true, value: fallback };
    const value = JSON.parse(raw);
    return validate(value) ? { ok: true, value } : { ok: false, value: fallback, reason: "malformed" };
  } catch (error) { return { ok: false, value: fallback, reason: reason(error) }; }
}

export function guardedWrite<T>(storage: Storage | null | undefined, key: string, next: T, previous: T, validate: (value: unknown) => value is T): GuardedResult<T> {
  if (!storage) return { ok: false, value: previous, reason: "unavailable" };
  try {
    if (!validate(next)) return { ok: false, value: previous, reason: "serialization" };
    const serialized = JSON.stringify(next);
    storage.setItem(key, serialized);
    return { ok: true, value: next };
  } catch (error) { return { ok: false, value: previous, reason: reason(error), error }; }
}

export function guardedAtomicWrite(storage: Storage | null | undefined, entries: Array<[string, string]>, previous: Array<[string, string | null]>): GuardedResult<boolean> {
  if (!storage) return { ok: false, value: false, reason: "unavailable" };
  try {
    entries.forEach(([key, value]) => storage.setItem(key, value));
    return { ok: true, value: true };
  } catch (error) {
    try { previous.forEach(([key, value]) => value == null ? storage.removeItem(key) : storage.setItem(key, value)); } catch { /* best effort rollback */ }
    return { ok: false, value: false, reason: reason(error), error };
  }
}

export function guardedRawWrite(storage: Storage | null | undefined, key: string, next: string, previous: string | null = null): GuardedResult<string> {
  if (!storage) return { ok: false, value: previous || "", reason: "unavailable" };
  try { storage.setItem(key, next); return { ok: true, value: next }; }
  catch (error) { try { previous == null ? storage.removeItem(key) : storage.setItem(key, previous); } catch {} return { ok: false, value: previous || "", reason: reason(error), error }; }
}
export function guardedRawRead(storage: Storage | null | undefined, key: string, fallback: string | null = null): GuardedResult<string | null> {
  if (!storage) return { ok: false, value: fallback, reason: "unavailable" };
  try { return { ok: true, value: storage.getItem(key) }; } catch (error) { return { ok: false, value: fallback, reason: reason(error), error }; }
}
export function guardedRemove(storage: Storage | null | undefined, key: string, previous: string | null = null): GuardedResult<boolean> {
  if (!storage) return { ok: false, value: false, reason: "unavailable" };
  try { storage.removeItem(key); return { ok: true, value: true }; } catch (error) { try { if (previous != null) storage.setItem(key, previous); } catch {} return { ok: false, value: false, reason: reason(error), error }; }
}

export const exportRecovery = (sections: Record<string, unknown>) => JSON.stringify({ format: "tally-recovery", version: 1, sections: Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value])) });
