import { describe, expect, it } from "vitest";
import { runTallyScript } from "./tallyscript";

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
  it("supports beginner-friendly commands and natural conditions", () => {
    const result = runTallyScript(
      `
        set positive step to 2
        repeat 3 times
          add
        end
        if count is at least 6
          add goal 10
        otherwise
          reset
        end
      `,
      counter(),
    );

    expect(result.counter.value).toBe(6);
    expect(result.counter.plusStep).toBe(2);
    expect(result.counter.goals).toEqual([10]);
  });

  it("supports remembered values in beginner syntax", () => {
    const result = runTallyScript(
      `
        remember amount as 4
        add amount
        if count is 4 and has maximum is false
          set maximum to 20
        end
      `,
      counter(),
    );

    expect(result.counter.value).toBe(4);
    expect(result.counter.max).toBe(20);
  });

  it("supports beginner cosmetic and Tally Super commands", () => {
    const result = runTallyScript(
      `
        set name to "Custom tally"
        set color to "#47ccef"
        move title to 12, -4
        scale goal to 1.2, 0.8
        rotate count to 5
        resize add to 160, 60
        hide minimum
        show maximum
      `,
      counter(),
    );

    expect(result.counter.name).toBe("Custom tally");
    expect(result.counter.color).toBe("#47ccef");
    expect(result.customization.parts.title).toMatchObject({ x: 12, y: -4 });
    expect(result.customization.parts.goal).toMatchObject({
      scaleX: 1.2,
      scaleY: 0.8,
    });
    expect(result.customization.parts.count.rotation).toBe(5);
    expect(result.customization.parts.add).toMatchObject({
      width: 160,
      height: 60,
    });
    expect(result.customization.parts.minimum.hidden).toBe(true);
    expect(result.customization.parts.maximum.hidden).toBe(false);
  });

  it("runs loops and conditions against counter values", () => {
    const result = runTallyScript(
      `
        set positive step to 2
        repeat 4 times
          add
        end
        if count is at least 8
          add goal 10
          set direction to more
        end
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
        set name to "Scripted"
        set color to "#47ccef"
        move title to 12, -4
        scale goal to 1.2, 0.8
        add quick setting positiveStep
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
    const result = runTallyScript("set count to 5", original);

    expect(result.counter.localOnly).toBe(true);
    expect(original.value).toBe(0);
    expect(() => runTallyScript("set local counter to true", original)).toThrow(
      "I don't understand",
    );
  });

  it("provides live read-only Tally condition variables", () => {
    const result = runTallyScript(
      `
        set count to 4
        if count is 4 and has minimum is false
          set minimum to -10
        end
        if has minimum is true and minimum is -10
          add positive step
        end
      `,
      counter(),
    );

    expect(result.counter.value).toBe(5);
    expect(result.counter.min).toBe(-10);
  });

  it("rejects general JavaScript APIs and runaway loops", () => {
    expect(() => runTallyScript('fetch "/api"', counter())).toThrow(
      "I don't understand",
    );
    expect(() =>
      runTallyScript(
        `
          while count is at least 0
            add
          end
        `,
        counter(),
      ),
    ).toThrow("Loop limit exceeded");
  });
});
