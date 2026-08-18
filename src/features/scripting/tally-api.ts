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
export type TallyScriptState = {
  counter: Record<string, any>;
  customization: Record<string, any>;
};
export type ScriptOperation =
  | "value.add" | "value.subtract" | "value.set" | "value.exact" | "value.jump" | "value.reset"
  | "starting.set" | "step.positive" | "step.negative"
  | "goal.add" | "goal.remove" | "goal.clear" | "direction.set"
  | "limit.minimum.set" | "limit.minimum.remove" | "limit.maximum.set" | "limit.maximum.remove"
  | "name.set" | "color.set"
  | "super.move" | "super.scale" | "super.rotate" | "super.resize" | "super.show" | "super.hide" | "super.reset"
  | "quick-setting.add" | "quick-setting.remove";
export type ScriptProposal = {
  invocationId: string;
  operationId: string;
  counterId: string | number;
  authority: "personal" | "retained" | "group";
  operation: ScriptOperation;
  path: string;
  command: string;
  args: unknown[];
};

export type TallyVariables = {
  tally_count: number;
  tally_starting_value: number;
  tally_positive_step: number;
  tally_negative_step: number;
  tally_goals: number[];
  tally_goal_count: number;
  tally_goal_direction: "more" | "less";
  tally_minimum: number | null;
  tally_maximum: number | null;
  tally_has_minimum: boolean;
  tally_has_maximum: boolean;
};

const finite = (value: unknown, label: string) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  return number;
};

const partName = (value: unknown) => {
  const name = String(value);
  if (!name) throw new Error("A Tally Super part name is required.");
  return name;
};

export function createTallyApi(
  initialCounter: Record<string, any>,
  initialCustomization: Record<string, any> = {},
  onMutation?: (proposal: Omit<ScriptProposal, "invocationId" | "operationId" | "counterId" | "authority">) => void | Promise<TallyScriptState | void>,
) {
  const counter = structuredClone(initialCounter);
  const customization = structuredClone(initialCustomization);
  customization.parts ||= {};
  customization.quickSettings ||= [];

  const updatePart = (part: unknown, changes: Record<string, any>) => {
    const key = partName(part);
    customization.parts[key] = {
      ...(customization.parts[key] || {}),
      ...changes,
    };
  };
  const removeLimit = (key: "min" | "max") => {
    counter[key] = null;
  };

  const Tally = {
    value: {
      get: () => counter.value,
      set: (value: unknown) => (counter.value = finite(value, "Value")),
      exact: (value: unknown) => (counter.value = finite(value, "Value")),
      jump: (value: unknown) => (counter.value = finite(value, "Value")),
      add: (amount: unknown = counter.plusStep) =>
        (counter.value += finite(amount, "Amount")),
      subtract: (amount: unknown = counter.minusStep) =>
        (counter.value -= finite(amount, "Amount")),
      reset: () => (counter.value = counter.start),
    },
    startingValue: {
      get: () => counter.start,
      set: (value: unknown) =>
        (counter.start = finite(value, "Starting value")),
    },
    steps: {
      positive: {
        get: () => counter.plusStep,
        set: (value: unknown) =>
          (counter.plusStep = Math.abs(finite(value, "Positive step")) || 1),
      },
      negative: {
        get: () => counter.minusStep,
        set: (value: unknown) =>
          (counter.minusStep = Math.abs(finite(value, "Negative step")) || 1),
      },
    },
    goals: {
      count: () => (Array.isArray(counter.goals) ? counter.goals.length : 0),
      has: (value: unknown) =>
        (counter.goals || []).map(Number).includes(finite(value, "Goal")),
      add: (value: unknown) => {
        const goal = finite(value, "Goal");
        counter.goals = [
          ...new Set([...(counter.goals || []).map(Number), goal]),
        ];
      },
      remove: (value: unknown) => {
        const goal = finite(value, "Goal");
        counter.goals = (counter.goals || []).filter(
          (current: unknown) => Number(current) !== goal,
        );
      },
      clear: () => (counter.goals = []),
    },
    goalDirection: {
      get: () => counter.goalDirection,
      set: (direction: unknown) => {
        if (direction !== "more" && direction !== "less")
          throw new Error('Goal direction must be "more" or "less".');
        counter.goalDirection = direction;
      },
    },
    minimum: {
      get: () => counter.min,
      set: (value: unknown) => (counter.min = finite(value, "Minimum")),
      remove: () => removeLimit("min"),
    },
    maximum: {
      get: () => counter.max,
      set: (value: unknown) => (counter.max = finite(value, "Maximum")),
      remove: () => removeLimit("max"),
    },
    reset: () => (counter.value = counter.start),
    cosmetic: {
      preferences: {
        name: {
          get: () => counter.name,
          set: (name: unknown) => (counter.name = String(name)),
        },
        color: {
          get: () => counter.color,
          set: (color: unknown) => {
            const next = String(color);
            if (!/^#[\da-f]{6}$/i.test(next))
              throw new Error("Color must use six-digit hex format.");
            counter.color = next;
          },
        },
      },
      super: {
        move: (part: unknown, x: unknown, y: unknown) =>
          updatePart(part, {
            x: finite(x, "X position"),
            y: finite(y, "Y position"),
          }),
        scale: (part: unknown, x: unknown, y: unknown = x) =>
          updatePart(part, {
            scaleX: finite(x, "Width scale"),
            scaleY: finite(y, "Height scale"),
          }),
        rotate: (part: unknown, degrees: unknown) =>
          updatePart(part, { rotation: finite(degrees, "Rotation") }),
        resize: (part: unknown, width: unknown, height: unknown) =>
          updatePart(part, {
            width: finite(width, "Width"),
            height: finite(height, "Height"),
          }),
        show: (part: unknown) => updatePart(part, { hidden: false }),
        hide: (part: unknown) => updatePart(part, { hidden: true }),
        reset: (part: unknown) => {
          customization.parts[partName(part)] = {};
        },
        quickSettings: {
          add: (setting: unknown) => {
            const key = String(setting);
            if (!customization.quickSettings.includes(key))
              customization.quickSettings.push(key);
          },
          remove: (setting: unknown) => {
            const key = String(setting);
            customization.quickSettings = customization.quickSettings.filter(
              (current: string) => current !== key,
            );
          },
        },
      },
    },
  };

  const mutators = new Set(["set", "exact", "jump", "add", "subtract", "reset", "start", "step", "addGoal", "remove", "clear", "setDirection", "setMinimum", "setMaximum", "setName", "setColor", "hide", "show", "move", "scale", "rotate", "resize"]);
  const operationFor = (path: string, command: string): ScriptOperation => {
    const normalized = path.replace(/^Tally\./, "");
    const aliases: Record<string, ScriptOperation> = {
      "value.set": "value.set", "value.exact": "value.exact", "value.jump": "value.jump", "value.add": "value.add", "value.subtract": "value.subtract", "value.reset": "value.reset", reset: "value.reset",
      "startingValue.set": "starting.set", "steps.positive.set": "step.positive", "steps.negative.set": "step.negative",
      "goals.add": "goal.add", "goals.remove": "goal.remove", "goals.clear": "goal.clear", "goalDirection.set": "direction.set",
      "minimum.set": "limit.minimum.set", "minimum.remove": "limit.minimum.remove", "maximum.set": "limit.maximum.set", "maximum.remove": "limit.maximum.remove",
      "cosmetic.preferences.name.set": "name.set", "cosmetic.preferences.color.set": "color.set",
      "cosmetic.super.move": "super.move", "cosmetic.super.scale": "super.scale", "cosmetic.super.rotate": "super.rotate", "cosmetic.super.resize": "super.resize", "cosmetic.super.show": "super.show", "cosmetic.super.hide": "super.hide", "cosmetic.super.reset": "super.reset",
      "cosmetic.super.quickSettings.add": "quick-setting.add", "cosmetic.super.quickSettings.remove": "quick-setting.remove",
    };
    const operation = aliases[normalized];
    if (!operation) throw new Error(`Unsupported script operation: ${path}.${command}`);
    return operation;
  };
  const applyAuthoritative = (state: TallyScriptState | void) => {
    if (!state) return;
    Object.keys(counter).forEach((key) => delete counter[key]);
    Object.assign(counter, structuredClone(state.counter));
    Object.keys(customization).forEach((key) => delete customization[key]);
    Object.assign(customization, structuredClone(state.customization));
  };
  const wrap = (value: any, path = "Tally"): any => {
    if (!value || typeof value !== "object") return value;
    return new Proxy(value, { get(target, key, receiver) { const member = Reflect.get(target, key, receiver); if (typeof member !== "function" || !mutators.has(String(key))) return typeof member === "object" ? wrap(member, `${path}.${String(key)}`) : member; return (...args: unknown[]) => { const result = member(...args); const proposal = { path: `${path}.${String(key)}`, command: String(key), operation: operationFor(`${path}.${String(key)}`, String(key)), args }; const published = onMutation?.(proposal); if (published && typeof (published as Promise<unknown>).then === "function") return (published as Promise<TallyScriptState | void>).then((state) => { applyAuthoritative(state); return result; }); applyAuthoritative(published as TallyScriptState | void); return result; }; } });
  };
  return {
    Tally: wrap(Tally),
    result: (): TallyScriptState => ({ counter, customization }),
    replaceState: applyAuthoritative,
    variables: (): TallyVariables => {
      const goals = Array.isArray(counter.goals)
        ? counter.goals.map(Number)
        : [];
      return {
        tally_count: Number(counter.value),
        tally_starting_value: Number(counter.start),
        tally_positive_step: Number(counter.plusStep),
        tally_negative_step: Number(counter.minusStep),
        tally_goals: goals,
        tally_goal_count: goals.length,
        tally_goal_direction:
          counter.goalDirection === "less" ? "less" : "more",
        tally_minimum: counter.min == null ? null : Number(counter.min),
        tally_maximum: counter.max == null ? null : Number(counter.max),
        tally_has_minimum: counter.min != null,
        tally_has_maximum: counter.max != null,
      };
    },
  };
}
