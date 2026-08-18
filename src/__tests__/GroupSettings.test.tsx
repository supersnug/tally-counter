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
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroupSettings } from "../features/groups/SharedGroups";

describe("group account settings", () => {
  afterEach(cleanup);

  it("renders safely before any groups have loaded", () => {
    render(<GroupSettings session={{ user: { id: "user-1" } }} />);

    expect(screen.getByPlaceholderText("New group name")).toBeVisible();
    expect(screen.getByRole("button", { name: /create group/i })).toBeVisible();
  });
});
