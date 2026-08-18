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
export const SUPER_REQUIRED_ELEMENTS = ["title", "count", "add", "settings", "delete"] as const;
export const SUPER_ZONES = ["workspace", "top", "bottom", "stats", "settings"] as const;
const OPTIONAL = new Set(["text", "text-alt", "counter", "layout-free", "layout-row", "layout-column", "goal", "reset", "subtract"]);

export type SuperValidation = { ok: true; value: Record<string, any> } | { ok: false; reason: string };

export function validateSuperItem(raw: unknown): SuperValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "schema" };
  const item = raw as Record<string, any>;
  if (typeof item.id !== "string" || typeof item.type !== "string" || !SUPER_ZONES.includes(item.zone)) return { ok: false, reason: "schema" };
  if (!OPTIONAL.has(item.type) && !(SUPER_REQUIRED_ELEMENTS as readonly string[]).includes(item.type) && !/^stat-\d+(?:-mini)?$/.test(item.type) && item.type !== "session-actions") return { ok: false, reason: "unsupported element" };
  if (item.hidden === true && (SUPER_REQUIRED_ELEMENTS as readonly string[]).includes(item.type)) return { ok: false, reason: "required element" };
  for (const key of ["x", "y", "rotation"]) if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < -360 || item[key] > 360)) return { ok: false, reason: "bounded transform" };
  for (const key of ["scaleX", "scaleY"]) if (item[key] != null && (!Number.isFinite(item[key]) || item[key] <= 0 || item[key] > 4)) return { ok: false, reason: "positive scale" };
  if ((item.width != null || item.height != null) && item.type !== "add" && item.type !== "subtract") return { ok: false, reason: "dimensions" };
  for (const key of ["width", "height"]) if (item[key] != null && (!Number.isFinite(item[key]) || item[key] <= 0 || item[key] > 1000)) return { ok: false, reason: "positive dimensions" };
  return { ok: true, value: { ...item, ...(item.x == null ? {} : { x: Math.max(0, Math.min(100, item.x)) }), ...(item.y == null ? {} : { y: Math.max(0, Math.min(100, item.y)) }) } };
}

export function validateSuperItems(raw: unknown): Record<string, any>[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.map(validateSuperItem).filter((result): result is { ok: true; value: Record<string, any> } => result.ok).map((result) => result.value).filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
}

export function validateSuperCustomization(raw: unknown) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, any> : {};
  return { ...value, items: validateSuperItems(value.items) };
}
