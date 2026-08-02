import { describe, expect, it } from "vitest";
import { runTallyScript, TallyScriptError } from "./tallyscript";

const counter = () => ({
  id: "counter-1",
  name: "Example",
  value: 0,
  start: 0,
  plusStep: 1,
  minusStep: 1,
  goals: [],
  goalDirection: "more",
  min: null,
  max: null,
  color: "#2f7e70",
  localOnly: true,
});

describe("TallyScript", () => {
  it("runs loops and conditions against counter values", () => {
    const result = runTallyScript(
      `
        Tally.steps.positive.set(2);
        for (let i = 0; i < 4; i++) {
          Tally.value.add();
        }
        if (Tally.value.get() >= 8) {
          Tally.goals.add(10);
          Tally.goalDirection.set("more");
        }
      `,
      counter(),
    );

    expect(result.counter.value).toBe(8);
    expect(result.counter.plusStep).toBe(2);
    expect(result.counter.goals).toEqual([10]);
  });

  it("updates preferences and Tally Super customization", () => {
    const result = runTallyScript(
      `
        Tally.cosmetic.preferences.name.set("Scripted");
        Tally.cosmetic.preferences.color.set("#47ccef");
        Tally.cosmetic.super.move("title", 12, -4);
        Tally.cosmetic.super.scale("goal", 1.2, 0.8);
        Tally.cosmetic.super.quickSettings.add("positiveStep");
      `,
      counter(),
    );

    expect(result.counter.name).toBe("Scripted");
    expect(result.counter.color).toBe("#47ccef");
    expect(result.customization.parts.title).toMatchObject({ x: 12, y: -4 });
    expect(result.customization.parts.goal).toMatchObject({
      scaleX: 1.2,
      scaleY: 0.8,
    });
    expect(result.customization.quickSettings).toEqual(["positiveStep"]);
  });

  it("does not expose the local counter setting", () => {
    const original = counter();
    const result = runTallyScript("Tally.value.set(5);", original);

    expect(result.counter.localOnly).toBe(true);
    expect(original.value).toBe(0);
    expect(() =>
      runTallyScript("Tally.localOnly.set(false);", original),
    ).toThrow(TallyScriptError);
  });

  it("provides live read-only Tally condition variables", () => {
    const result = runTallyScript(
      `
        Tally.value.set(4);
        if (tally_count === 4 && !tally_has_minimum) {
          Tally.minimum.set(-10);
        }
        if (tally_has_minimum && tally_minimum === -10) {
          Tally.value.add(tally_positive_step);
        }
      `,
      counter(),
    );

    expect(result.counter.value).toBe(5);
    expect(result.counter.min).toBe(-10);
    expect(() => runTallyScript("let tally_count = 10;", counter())).toThrow(
      "read-only Tally variable",
    );
  });

  it("rejects general JavaScript APIs and runaway loops", () => {
    expect(() => runTallyScript('fetch("/api");', counter())).toThrow(
      "Scripts may only call Tally functions",
    );
    expect(() => runTallyScript("while (true) {}", counter())).toThrow(
      "Loop limit exceeded",
    );
  });
});
