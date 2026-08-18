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
import { describe, expect, it } from "vitest";
import { runTallyScript } from "../features/scripting/tallyscript";

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
  it("supports beginner-friendly commands and natural conditions", async () => {
    const result = await runTallyScript(
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

  it("supports remembered values in beginner syntax", async () => {
    const result = await runTallyScript(
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

  it("supports beginner cosmetic and Tally Super commands", async () => {
    const result = await runTallyScript(
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

  it("runs loops and conditions against counter values", async () => {
    const result = await runTallyScript(
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

  it("updates preferences and Tally Super customization", async () => {
    const result = await runTallyScript(
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

  it("does not expose the local counter setting", async () => {
    const original = counter();
    const result = await runTallyScript("set count to 5", original);

    expect(result.counter.localOnly).toBe(true);
    expect(original.value).toBe(0);
    await expect(runTallyScript("set local counter to true", original)).rejects.toThrow(
      "I don't understand",
    );
  });

  it("provides live read-only Tally condition variables", async () => {
    const result = await runTallyScript(
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

  it("rejects general JavaScript APIs and runaway loops", async () => {
    await expect(runTallyScript('fetch "/api"', counter())).rejects.toThrow(
      "I don't understand",
    );
    await expect(
      runTallyScript(
        `
          while count is at least 0
            add
          end
        `,
        counter(),
      ),
    ).rejects.toThrow("Loop limit exceeded");
  });

  it("supports yielding continuous loops and cancellation", async () => {
    const controller = new AbortController();
    const updates: number[] = [];
    const execution = runTallyScript(
      `
        while true
          sleep 5 ms
          add
        end
      `,
      counter(),
      {},
      {
        signal: controller.signal,
        onUpdate: (state) => {
          updates.push(state.counter.value);
          if (state.counter.value >= 3) controller.abort();
        },
      },
    );

    await expect(execution).rejects.toThrow("Script stopped");
    expect(updates.some((value) => value >= 3)).toBe(true);
  });
});
