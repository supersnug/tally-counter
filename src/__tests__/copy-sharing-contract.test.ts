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
import { copySourceId } from "../features/sharing/CopySharing";

describe("Counter Copy source contract", () => {
  it("preserves numeric persisted identities as text", () => {
    expect(copySourceId({ id: 42 })).toBe("42");
  });

  it("preserves string identities without coercing their value", () => {
    expect(copySourceId({ id: "legacy-counter" })).toBe("legacy-counter");
  });
});
