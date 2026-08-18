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
import { createInvocationRegistry } from "../features/scripting/runtime";

describe("automation invocation runtime", () => {
  it("allows one active invocation per counter and ignores stale callbacks", () => {
    const registry = createInvocationRegistry();
    const first = registry.start("counter");
    const second = registry.start("counter");
    expect(first.controller.signal.aborted).toBe(true);
    expect(registry.isCurrent(first)).toBe(false);
    expect(registry.isCurrent(second)).toBe(true);
  });
  it("stops and removes invocation state", () => {
    const registry = createInvocationRegistry();
    const invocation = registry.start("counter");
    registry.stop("counter");
    expect(invocation.controller.signal.aborted).toBe(true);
    expect(registry.active.has("counter")).toBe(false);
  });
  it("invalidates delayed proposals before a bundle leaves active state", () => {
    const registry = createInvocationRegistry();
    const invocation = registry.start("counter-1");
    registry.stop("counter-1");
    expect(invocation.controller.signal.aborted).toBe(true);
    expect(registry.isCurrent(invocation)).toBe(false);
    expect(registry.active.has("counter-1")).toBe(false);
  });
});
