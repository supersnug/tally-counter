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
export const DEFAULT_PREFERENCES = {
  density: "comfortable",
  columns: "auto",
  numberSize: "standard",
  showBounds: true,
  animations: true,
  defaultColor: "#ef6a47",
  trashEnabled: true,
  syncTrash: true,
} as const;

const COLORS = /^#[0-9a-f]{6}$/i;

export function normalizePreferences(raw: unknown) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    ...DEFAULT_PREFERENCES,
    density: ["compact", "comfortable", "spacious"].includes(String(value.density)) ? String(value.density) : DEFAULT_PREFERENCES.density,
    columns: ["auto", "2", "3", "4"].includes(String(value.columns)) ? String(value.columns) : DEFAULT_PREFERENCES.columns,
    numberSize: ["small", "standard", "large"].includes(String(value.numberSize)) ? String(value.numberSize) : DEFAULT_PREFERENCES.numberSize,
    showBounds: typeof value.showBounds === "boolean" ? value.showBounds : DEFAULT_PREFERENCES.showBounds,
    animations: typeof value.animations === "boolean" ? value.animations : DEFAULT_PREFERENCES.animations,
    defaultColor: typeof value.defaultColor === "string" && COLORS.test(value.defaultColor) ? value.defaultColor : DEFAULT_PREFERENCES.defaultColor,
    trashEnabled: typeof value.trashEnabled === "boolean" ? value.trashEnabled : DEFAULT_PREFERENCES.trashEnabled,
    syncTrash: typeof value.syncTrash === "boolean" ? value.syncTrash : DEFAULT_PREFERENCES.syncTrash,
  };
}

export const effectiveColumns = (desired: string, width: number) => {
  const maximum = width < 521 ? 1 : width < 901 ? 2 : 4;
  return desired === "auto" ? Math.min(3, maximum) : Math.min(Number(desired) || 3, maximum);
};
