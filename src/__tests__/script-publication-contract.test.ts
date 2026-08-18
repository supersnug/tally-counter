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
import { applyScriptProposal, SCRIPT_ELEMENTS, validateScriptRecord } from "../features/counters/operations";

const counter = { id: "c", name: "C", value: 1, start: 0, plusStep: 1, minusStep: 1, min: null, max: null, tags: [] };
describe("authoritative script publication", () => {
  it("publishes finite source-ordered operations and rejects stale/no-op proposals", () => {
    expect(applyScriptProposal(counter, { invocationId: "i", operationId: "o", operation: "value.add", args: [], command: "add" }, "i").status).toBe("accepted");
    expect(applyScriptProposal(counter, { invocationId: "old", operationId: "o", operation: "value.add", args: [], command: "add" }, "i").status).toBe("rejected");
    expect(applyScriptProposal(counter, { invocationId: "i", operationId: "o", operation: "value.set", args: ["x"], command: "set", value: "x" }, "i").status).toBe("rejected");
  });
  it("validates transfer language and forces stopped records", () => {
    expect(validateScriptRecord({ language: "javascript", source: "x", enabled: true }).enabled).toBe(false);
    expect(() => validateScriptRecord({ language: "python" })).toThrow(/language/i);
    expect(SCRIPT_ELEMENTS.has("title")).toBe(true);
  });
  it("applies canonical metadata and Super/quick operations without value activity", () => {
    const metadata = applyScriptProposal(counter, { invocationId: "i", operationId: "n", operation: "name.set", args: ["Renamed"], command: "setName" }, "i");
    expect(metadata.status).toBe("accepted");
    expect("transition" in metadata ? metadata.transition : undefined).toBeUndefined();
    const hidden = applyScriptProposal(counter, { invocationId: "i", operationId: "h", operation: "super.hide", args: ["goal-bar"], command: "hide" }, "i", {});
    expect(hidden.status).toBe("accepted");
    expect(applyScriptProposal(counter, { invocationId: "i", operationId: "q", operation: "quick-setting.add", args: ["invalid"], command: "quickSettingAdd" }, "i").status).toBe("rejected");
  });
  it("keeps bounded no-ops unchanged without creating customization shape", () => {
    const result = applyScriptProposal(counter, { invocationId: "i", operationId: "noop", operation: "value.set", args: [1], command: "set" }, "i", {});
    expect(result.status).toBe("unchanged");
    expect("customization" in result ? result.customization : undefined).toEqual(undefined);
  });
  it("rejects extra arguments with the DB-equivalent arity and exposes canonical elements", () => {
    expect(applyScriptProposal(counter, { invocationId: "i", operationId: "extra", operation: "value.reset", args: [1], command: "reset" }, "i").status).toBe("rejected");
    expect([...SCRIPT_ELEMENTS]).toEqual(expect.arrayContaining(["goal-bar", "minimum-indicator", "maximum-indicator", "positiveStep", "negativeStep", "goalDirection"]));
    expect(SCRIPT_ELEMENTS.has("goal")).toBe(false);
  });
});
