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
import { sanitize, type AnyRecord } from "./model";
import { validateSuperCustomization } from "../tally-super/validator";
import type { ScriptProposal } from "../scripting/tally-api";

export const ACTION_KINDS = ["positive control", "negative control", "reset", "direct value entry", "jump", "limit-induced clamp", "script-published change", "undo", "redo"] as const;
export type CounterCommand = { type: "positive" } | { type: "negative" } | { type: "set"; value: number } | { type: "reset" } | { type: "jump"; value: number };
export type OperationResult =
  | { status: "accepted"; counter: AnyRecord; customization?: AnyRecord; transition?: AnyRecord }
  | { status: "unchanged"; counter: AnyRecord; customization?: AnyRecord }
  | { status: "rejected"; counter: AnyRecord; customization?: AnyRecord; reason: string };

export const SCRIPT_ELEMENTS = new Set(["title", "count", "add", "settings", "delete", "subtract", "reset", "embed", "goal-bar", "minimum-indicator", "maximum-indicator", "positiveStep", "negativeStep", "minimum", "maximum", "color", "goalDirection"]);
export const SCRIPT_COMMANDS = new Set(["add", "subtract", "set", "start", "reset", "jump", "step", "goal", "direction", "limit", "name", "color"]);

export function validateScriptRecord(raw: AnyRecord) {
  const language = raw?.language;
  if (!["tallyscript", "javascript"].includes(language)) throw new Error("Script language is invalid.");
  return { language, source: typeof raw.source === "string" ? raw.source : "", enabled: false };
}

export function normalizeScriptRecords(raw: unknown) {
  const normalized: AnyRecord = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return normalized;
  for (const [id, value] of Object.entries(raw as AnyRecord)) {
    try { normalized[id] = validateScriptRecord(value as AnyRecord); } catch { /* invalid records are quarantined */ }
  }
  return normalized;
}

export function applyScriptProposal(rawCounter: AnyRecord, proposal: Partial<ScriptProposal> & { invocationId: string; operationId: string; command?: string; value?: unknown }, currentInvocationId: string, rawCustomization: AnyRecord = {}): OperationResult {
  const counter = sanitize(rawCounter);
  if (!proposal?.invocationId || proposal.invocationId !== currentInvocationId) return { status: "rejected", counter, reason: "Stale script invocation." };
  const operation = proposal.operation;
  if (!operation) return { status: "rejected", counter, reason: "A typed script operation is required." };
  const args = proposal.args || [];
  const exactArity: Record<string, number | [number, number]> = { "value.add": [0, 1], "value.subtract": [0, 1], "value.set": 1, "value.exact": 1, "value.jump": 1, "value.reset": 0, "starting.set": 1, "step.positive": 1, "step.negative": 1, "goal.add": 1, "goal.remove": 1, "goal.clear": 0, "direction.set": 1, "limit.minimum.set": 1, "limit.minimum.remove": 0, "limit.maximum.set": 1, "limit.maximum.remove": 0, "name.set": 1, "color.set": 1, "quick-setting.add": 1, "quick-setting.remove": 1, "super.hide": 1, "super.show": 1, "super.reset": 1, "super.move": 3, "super.scale": 3, "super.rotate": 2, "super.resize": 3 };
  const arity = exactArity[operation];
  if (arity == null || (Array.isArray(arity) ? (args.length < arity[0] || args.length > arity[1]) : args.length !== arity)) return { status: "rejected", counter, reason: "Invalid script operation argument count." };
  const finiteArg = (index: number, label: string) => { const value = Number(args[index]); if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`); return value; };
  let customization: AnyRecord | undefined;
  const next = sanitize(counter);
  try {
    switch (operation) {
      case "value.add": case "value.subtract": { if (args.length > 1) throw new Error("An amount is required at most once."); const amount = args.length ? Math.abs(finiteArg(0, "Amount")) : operation === "value.add" ? next.plusStep : next.minusStep; next.value += operation === "value.add" ? amount : -amount; break; }
      case "value.set": case "value.exact": case "value.jump": next.value = finiteArg(0, "Value"); break;
      case "value.reset": next.value = next.start; break;
      case "starting.set": next.start = finiteArg(0, "Starting value"); break;
      case "step.positive": next.plusStep = Math.abs(finiteArg(0, "Step")) || 1; break;
      case "step.negative": next.minusStep = Math.abs(finiteArg(0, "Step")) || 1; break;
      case "limit.minimum.set": next.min = finiteArg(0, "Minimum"); break;
      case "limit.minimum.remove": if (args.length) throw new Error("Removing a minimum takes no arguments."); next.min = null; break;
      case "limit.maximum.set": next.max = finiteArg(0, "Maximum"); break;
      case "limit.maximum.remove": if (args.length) throw new Error("Removing a maximum takes no arguments."); next.max = null; break;
      case "goal.add": case "goal.remove": { const goal = finiteArg(0, "Goal"); const goals = Array.isArray(next.goals) ? next.goals.map(Number) : []; next.goals = operation === "goal.add" ? [...new Set([...goals, goal])] : goals.filter((item) => item !== goal); break; }
      case "goal.clear": if (args.length) throw new Error("Clearing goals takes no arguments."); next.goals = []; break;
      case "direction.set": if (args[0] !== "more" && args[0] !== "less") throw new Error("Goal direction is invalid."); next.goalDirection = args[0]; break;
      case "name.set": if (typeof args[0] !== "string" || !args[0].trim()) throw new Error("Name must be nonblank."); next.name = args[0].trim(); break;
      case "color.set": if (typeof args[0] !== "string" || !/^#[\da-f]{6}$/i.test(args[0])) throw new Error("Color must be six-digit hex."); next.color = args[0]; break;
      case "quick-setting.add": case "quick-setting.remove": { customization = structuredClone(rawCustomization); const allowed = new Set(["positiveStep", "negativeStep", "minimum", "maximum", "color", "goalDirection"]); const key = args[0]; if (typeof key !== "string" || !allowed.has(key)) throw new Error("Unsupported quick setting."); const settings = Array.isArray(customization.quickSettings) ? customization.quickSettings : []; customization.quickSettings = operation === "quick-setting.add" ? [...new Set([...settings, key])] : settings.filter((item: string) => item !== key); break; }
      case "super.hide": case "super.show": case "super.reset": case "super.move": case "super.scale": case "super.rotate": case "super.resize": { customization = structuredClone(rawCustomization); customization.parts ||= {}; const allowed = new Set(["title", "count", "add", "settings", "delete", "subtract", "reset", "embed", "goal-bar", "minimum-indicator", "maximum-indicator", "positiveStep", "negativeStep", "minimum", "maximum", "color", "goalDirection"]); const part = args[0]; if (typeof part !== "string" || !allowed.has(part)) throw new Error("Unsupported Tally Super element."); if (operation === "super.hide" && ["title", "count", "add", "settings", "delete"].includes(part)) throw new Error("Required Tally Super elements cannot be hidden."); const values = args.slice(1).map((_, index) => finiteArg(index + 1, "Transform")); if (operation === "super.resize" && !["add", "subtract"].includes(part)) throw new Error("Only add and subtract accept dimensions."); if (["super.scale", "super.resize"].includes(operation) && values.some((value) => value <= 0)) throw new Error("Scale and dimensions must be positive."); const current = customization.parts[part] || {}; if (operation === "super.reset") customization.parts[part] = {}; else if (operation === "super.hide" || operation === "super.show") customization.parts[part] = { ...current, hidden: operation === "super.hide" }; else if (operation === "super.move") customization.parts[part] = { ...current, x: values[0], y: values[1] }; else if (operation === "super.scale") customization.parts[part] = { ...current, scaleX: values[0], scaleY: values[1] }; else if (operation === "super.rotate") customization.parts[part] = { ...current, rotation: values[0] }; else customization.parts[part] = { ...current, width: values[0], height: values[1] }; break; }
      default: throw new Error("Unsupported script operation.");
    }
  } catch (error) { return { status: "rejected", counter, reason: error instanceof Error ? error.message : "Invalid script operation." }; }
  if (next.min != null && next.max != null && next.min > next.max) [next.min, next.max] = [next.max, next.min];
  next.value = clamp(next.value, next); next.start = clamp(next.start, next);
  const counterChanged = JSON.stringify(next) !== JSON.stringify(counter);
  const customizationChanged = customization != null && JSON.stringify(customization) !== JSON.stringify(rawCustomization);
  if (customization?.uiCustomizations) customization.uiCustomizations = validateSuperCustomization(customization.uiCustomizations);
  if (!counterChanged && !customizationChanged) return { status: "unchanged", counter: next, customization };
  return { status: "accepted", counter: next, customization, ...(next.value !== counter.value ? { transition: { eventId: proposal.operationId, counterId: counter.id, id: counter.id, from: counter.value, to: next.value, kind: "script-published change", time: Date.now(), operationId: proposal.operationId } } : {}) };
}

const clamp = (value: number, counter: AnyRecord) => Math.max(counter.min ?? -Infinity, Math.min(counter.max ?? Infinity, value));

export function applyLimitEdit(rawCounter: AnyRecord, minimum: unknown, maximum: unknown, operationId: string = crypto.randomUUID(), now = Date.now()): OperationResult {
  const counter = sanitize(rawCounter);
  const min = minimum === "" || minimum == null ? null : Number(minimum);
  const max = maximum === "" || maximum == null ? null : Number(maximum);
  if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max))) return { status: "rejected", counter, reason: "Limits must be finite." };
  const orderedMin = min != null && max != null ? Math.min(min, max) : min;
  const orderedMax = min != null && max != null ? Math.max(min, max) : max;
  const next = sanitize({ ...counter, min: orderedMin, max: orderedMax });
  if (next.value === counter.value) return { status: "unchanged", counter: next };
  return { status: "accepted", counter: next, transition: { eventId: operationId, id: counter.id, counterId: counter.id, from: counter.value, to: next.value, kind: "limit-induced clamp", time: now } };
}

export function applyCounterCommand(rawCounter: AnyRecord, command: CounterCommand, operationId: string = crypto.randomUUID(), now = Date.now()): OperationResult {
  const counter = sanitize(rawCounter);
  let requested: number;
  let kind: (typeof ACTION_KINDS)[number];
  if (command.type === "positive") { requested = counter.value + counter.plusStep; kind = "positive control"; }
  else if (command.type === "negative") { requested = counter.value - counter.minusStep; kind = "negative control"; }
  else if (command.type === "reset") { requested = counter.start; kind = "reset"; }
  else { requested = command.value; kind = command.type === "jump" ? "jump" : "direct value entry"; }
  if (!Number.isFinite(requested)) return { status: "rejected", counter, reason: "Value must be finite." };
  const value = clamp(requested, counter);
  if (value === counter.value) return { status: "unchanged", counter };
  return { status: "accepted", counter: { ...counter, value }, transition: { eventId: operationId, counterId: counter.id, id: counter.id, from: counter.value, to: value, kind, time: now } };
}

export function splitActivityEntries(raw: unknown) {
  const valid: AnyRecord[] = [], quarantine: AnyRecord[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const value = entry as AnyRecord;
    const good = value && typeof value === "object" && !Array.isArray(value) && value.eventId != null && value.id != null && Number.isFinite(value.from) && Number.isFinite(value.to) && value.from !== value.to && Number.isFinite(value.time) && typeof value.kind === "string" && value.kind.length > 0;
    if (good && !valid.some((candidate) => candidate.eventId === value.eventId)) valid.push(value);
    else quarantine.push(value);
  }
  return { valid, quarantine };
}

export function appendActivityEntry(history: AnyRecord[], entry: AnyRecord) {
  return [...history, entry];
}

export function readActivityPartitions(storage: Storage) {
  const read = (key: string) => { try { return JSON.parse(storage.getItem(key) || "null"); } catch { return null; } };
  const result = splitActivityEntries(read("tally-history"));
  const persisted = read("tally-history-quarantine");
  const quarantine = [...result.quarantine, ...(Array.isArray(persisted) ? persisted : [])];
  const unique = <T extends AnyRecord>(entries: T[]) => entries.filter((entry, index, all) => entry.eventId == null || all.findIndex((candidate) => candidate.eventId === entry.eventId) === index);
  return { valid: unique(result.valid), quarantine: unique(quarantine) };
}
