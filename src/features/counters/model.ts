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
export type AnyRecord = Record<string, any>;
export const PUBLIC_SNAPSHOT_FORMAT = "tally-counter-snapshot";
export const PUBLIC_SNAPSHOT_VERSION = 1;
export const EMBED_OPTION_DEFAULTS = {
  watermark: true,
  compact: false,
  reset: true,
  settings: false,
  theme: "auto",
} as const;

export const COLORS = [
  "#ef6a47",
  "#2f7e70",
  "#4e65a8",
  "#d59c2e",
  "#9b5f85",
  "#63705b",
];
export const EMBED_ORIGIN = "https://tally.sarulean.com";
export const TRASH_LIFETIME = 5 * 24 * 60 * 60 * 1000;
export const REMOVED_SUPER_TYPES = new Set([
  "counters-grid",
  "top-bar-copy",
  "bottom-bar-copy",
]);

export const COUNTER_SUPER_PARTS: [string, string, boolean, boolean][] = [
  ["embed", "Embed button", true, true],
  ["reset", "Reset button", true, true],
  ["settings", "Settings button", false, true],
  ["delete", "Delete button", false, true],
  ["title", "Counter title", false, false],
  ["count", "Count", false, false],
  ["goal", "Goal bar", true, false],
  ["add", "Add button", false, false],
  ["subtract", "Subtract button", true, false],
  ["minimum", "Minimum indicator", true, false],
  ["maximum", "Maximum indicator", true, false],
  ["quick-plusStep", "Quick setting · Positive step", true, false],
  ["quick-minusStep", "Quick setting · Negative step", true, false],
  ["quick-min", "Quick setting · Minimum", true, false],
  ["quick-max", "Quick setting · Maximum", true, false],
  ["quick-color", "Quick setting · Color", true, false],
  ["quick-goalDirection", "Quick setting · Goal direction", true, false],
];

export const starter = [
  {
    id: 1,
    name: "Morning laps",
    value: 18,
    start: 0,
    plusStep: 1,
    minusStep: 1,
    goals: [10, 20, 25],
    goalDirection: "more",
    min: 0,
    max: 30,
    color: COLORS[1],
  },
  {
    id: 2,
    name: "Inventory balance",
    value: -12,
    start: 0,
    plusStep: 5,
    minusStep: 3,
    goals: [-10, -20],
    goalDirection: "less",
    min: -30,
    max: 50,
    color: COLORS[0],
  },
  {
    id: 3,
    name: "Ideas captured",
    value: 42,
    start: 0,
    plusStep: 1,
    minusStep: 1,
    goals: [10, 25, 40],
    goalDirection: "more",
    min: null,
    max: null,
    color: COLORS[2],
  },
];

export const getGoals = (counter: AnyRecord): number[] => {
  const values: unknown[] = Array.isArray(counter.goals)
    ? counter.goals
    : counter.goal == null || counter.goal === ""
      ? []
      : [counter.goal];
  const direction =
    counter.goalDirection ||
    (Number(counter.goal) < Number(counter.start) ? "less" : "more");
  return [...new Set(values.map(Number).filter(Number.isFinite))].sort(
    (a, b) => (direction === "less" ? b - a : a - b),
  );
};

export const sanitize = (raw: AnyRecord): AnyRecord => {
  const finiteOrNull = (value: unknown) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  let min = finiteOrNull(raw.min);
  let max = finiteOrNull(raw.max);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const finite = (value: unknown, fallback: number) => {
    const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value: unknown, fallback = 0) =>
    Math.max(min ?? -Infinity, Math.min(max ?? Infinity, finite(value, fallback)));
  return {
    ...raw,
    name: typeof raw.name === "string" ? raw.name.trim() || "Untitled counter" : "Untitled counter",
    folderId: raw.folderId == null || raw.folderId === "" ? null : String(raw.folderId),
    tags: Array.isArray(raw.tags)
      ? [...new Set(raw.tags.map((tag) => String(tag).trim()).filter(Boolean))]
      : [],
    value: clamp(raw.value),
    start: clamp(raw.start),
    plusStep: Math.max(1, Math.abs(finite(raw.plusStep, 1))),
    minusStep: Math.max(1, Math.abs(finite(raw.minusStep, 1))),
    goals: getGoals(raw),
    goalDirection: raw.goalDirection === "less" ? "less" : "more",
    min,
    max,
  };
};

const counterSignature = (raw: AnyRecord) => {
  const counter = sanitize(raw);
  return [
    String(counter.id),
    counter.name,
    counter.value,
    counter.start,
    counter.plusStep,
    counter.minusStep,
    counter.goals,
    counter.goalDirection,
    counter.min,
    counter.max,
    counter.color,
    counter.folderId,
    counter.tags,
  ];
};

export const countersEqual = (first: AnyRecord[], second: AnyRecord[]) =>
  JSON.stringify(first.map(counterSignature)) ===
  JSON.stringify(second.map(counterSignature));

export const normalizeSuperSettings = (raw: AnyRecord) => {
  const uiCustomizations =
    raw?.uiCustomizations &&
    typeof raw.uiCustomizations === "object" &&
    !Array.isArray(raw.uiCustomizations)
      ? raw.uiCustomizations
      : {};
  return {
    ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
    counterCustomizations:
      raw?.counterCustomizations &&
      typeof raw.counterCustomizations === "object" &&
      !Array.isArray(raw.counterCustomizations)
        ? raw.counterCustomizations
        : {},
    uiCustomizations: {
      ...uiCustomizations,
      items: (Array.isArray(uiCustomizations.items)
        ? uiCustomizations.items
        : []
      ).filter((item) => !REMOVED_SUPER_TYPES.has(item.type)),
    },
  };
};

export const encodeCounter = (counter: AnyRecord) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(createPublicSnapshot(counter)))));

export type SnapshotDecodeResult =
  | { ok: true; value: AnyRecord }
  | { ok: false; reason: "missing" | "malformed" | "truncated" | "version" | "schema" | "numeric" };

export const decodeCounter = (value: string | null) => {
  const result = decodeCounterResult(value);
  return result.ok ? result.value : null;
};

export const decodeCounterResult = (value: string | null): SnapshotDecodeResult => {
  if (!value) return { ok: false, reason: "missing" };
  try {
    let decoded: string;
    try { decoded = decodeURIComponent(escape(atob(value))); } catch { return { ok: false, reason: "truncated" }; }
    return decodePublicSnapshotResult(JSON.parse(decoded));
  } catch {
    return { ok: false, reason: "malformed" };
  }
};

export const createPublicSnapshot = (counter: AnyRecord) => {
  if (!counter || typeof counter !== "object" || typeof counter.name !== "string" || (counter.color != null && !COLORS.includes(counter.color))) {
    throw new Error("This counter cannot be published as a public snapshot.");
  }
  for (const key of ["value", "start", "plusStep", "minusStep"]) if (!Number.isFinite(counter[key])) throw new Error("This counter has incomplete numeric settings.");
  const clean = sanitize({ ...counter, color: counter.color ?? COLORS[0] });
  const sourceOptions = counter.embedOptions && typeof counter.embedOptions === "object" ? counter.embedOptions : {};
  return {
    format: PUBLIC_SNAPSHOT_FORMAT,
    version: PUBLIC_SNAPSHOT_VERSION,
    display: { name: clean.name, value: clean.value, start: clean.start, color: clean.color },
    counting: {
      plusStep: clean.plusStep,
      minusStep: clean.minusStep,
      min: clean.min,
      max: clean.max,
    },
    goals: { values: clean.goals, direction: clean.goalDirection },
    options: {
      watermark: sourceOptions.watermark !== false,
      compact: sourceOptions.compact === true,
      reset: sourceOptions.reset !== false,
      settings: sourceOptions.settings === true,
      theme: sourceOptions.theme === "light" || sourceOptions.theme === "dark" ? sourceOptions.theme : "auto",
    },
  };
};

export const decodePublicSnapshotResult = (raw: unknown): SnapshotDecodeResult => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "schema" };
  const value = raw as AnyRecord;
  if (value.format !== PUBLIC_SNAPSHOT_FORMAT || value.version !== PUBLIC_SNAPSHOT_VERSION) return { ok: false, reason: "version" };
  const display = value.display;
  const counting = value.counting;
  const goals = value.goals;
  if (!display || !counting || !goals || typeof display !== "object" || typeof counting !== "object" || typeof goals !== "object") return { ok: false, reason: "schema" };
  if (typeof display.name !== "string" || typeof display.color !== "string" || !COLORS.includes(display.color)) return { ok: false, reason: "schema" };
  if (!Number.isFinite(display.value) || !Number.isFinite(display.start)) return { ok: false, reason: "numeric" };
  if (!Number.isFinite(counting.plusStep) || !Number.isFinite(counting.minusStep) || (counting.min !== null && !Number.isFinite(counting.min)) || (counting.max !== null && !Number.isFinite(counting.max))) return { ok: false, reason: "numeric" };
  if (!Array.isArray(goals.values) || goals.values.some((entry: unknown) => !Number.isFinite(entry)) || (goals.direction !== "more" && goals.direction !== "less")) return { ok: false, reason: "schema" };
  const options = value.options;
  if (!options || typeof options !== "object" || typeof options.watermark !== "boolean" || typeof options.compact !== "boolean" || typeof options.reset !== "boolean" || typeof options.settings !== "boolean" || !["auto", "light", "dark"].includes(options.theme)) return { ok: false, reason: "schema" };
  const counter = sanitize({
    name: display.name,
    value: display.value,
    start: display.start,
    color: display.color,
    plusStep: counting.plusStep,
    minusStep: counting.minusStep,
    min: counting.min,
    max: counting.max,
    goals: goals.values,
    goalDirection: goals.direction,
  });
  return { ok: true, value: { ...counter, embedOptions: { ...options } } };
};

export const decodePublicSnapshot = (raw: unknown): AnyRecord | null => {
  const result = decodePublicSnapshotResult(raw);
  return result.ok ? result.value : null;
};
