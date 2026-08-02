export type AnyRecord = Record<string, any>;

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
  let min = raw.min === "" || raw.min == null ? null : Number(raw.min);
  let max = raw.max === "" || raw.max == null ? null : Number(raw.max);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const clamp = (value: unknown) =>
    Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number(value) || 0));
  return {
    ...raw,
    name: raw.name.trim() || "Untitled counter",
    value: clamp(raw.value),
    start: clamp(raw.start),
    plusStep: Math.abs(Number(raw.plusStep)) || 1,
    minusStep: Math.abs(Number(raw.minusStep)) || 1,
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
  btoa(unescape(encodeURIComponent(JSON.stringify(sanitize(counter)))));

export const decodeCounter = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  } catch {
    return null;
  }
};
