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
import { JavaScriptSandboxError, runJavaScript } from "../features/scripting/javascript";

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

describe("sandboxed JavaScript", () => {
  it("supports full JavaScript language features with the Tally API", async () => {
    const result = await runJavaScript(
      `
        class Incrementer {
          constructor(amount) { this.amount = amount; }
          run() { Tally.value.add(this.amount); }
        }
        [1, 2, 3].map((value) => new Incrementer(value)).forEach((item) => item.run());
        Tally.cosmetic.preferences.name.set(` +
        "`Total ${Tally.value.get()}`" +
        `);
      `,
      counter(),
    );

    expect(result.counter.value).toBe(6);
    expect(result.counter.name).toBe("Total 6");
    expect(result.counter.localOnly).toBe(true);
  });

  it("does not expose app or browser globals", async () => {
    const result = await runJavaScript(
      `
        if (typeof window !== "undefined") throw new Error("window leaked");
        if (typeof document !== "undefined") throw new Error("document leaked");
        if (typeof fetch !== "undefined") throw new Error("network leaked");
        Tally.value.set(4);
      `,
      counter(),
    );

    expect(result.counter.value).toBe(4);
  });

  it("exposes live counter values for JavaScript conditions", async () => {
    const result = await runJavaScript(
      `
        Tally.goals.add(10);
        Tally.value.set(7);
        if (tally_count === 7 && tally_goal_count === 1 && tally_goals.includes(10)) {
          Tally.value.add(tally_positive_step);
        }
      `,
      counter(),
    );

    expect(result.counter.value).toBe(8);
  });

  it("interrupts runaway scripts", async () => {
    await expect(
      runJavaScript("while (true) {}", counter()),
    ).rejects.toBeInstanceOf(JavaScriptSandboxError);
  });

  it("allows an infinite loop that yields and can be stopped", async () => {
    const controller = new AbortController();
    const updates: number[] = [];
    const execution = runJavaScript(
      `
        while (true) {
          Tally.value.add();
          await Tally.sleep(5);
        }
      `,
      counter(),
      {},
      {
        signal: controller.signal,
        onUpdate: (state) => updates.push(state.counter.value),
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 35));
    controller.abort();

    await expect(execution).rejects.toThrow("Script stopped");
    expect(updates.at(-1)).toBeGreaterThan(1);
  });
});
