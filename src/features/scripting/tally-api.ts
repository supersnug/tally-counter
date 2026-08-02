export type TallyScriptState = {
  counter: Record<string, any>;
  customization: Record<string, any>;
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

  return {
    Tally,
    result: (): TallyScriptState => ({ counter, customization }),
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
