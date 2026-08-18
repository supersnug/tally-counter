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
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { CountersPage } from "../pages/CountersPage";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("confirm", () => true);
  localStorage.setItem("tally-counters", JSON.stringify([{ id: 1, name: "One", value: 0, start: 0, plusStep: 1, minusStep: 1, tags: [], folderId: null }]));
  localStorage.setItem("tally-folders", JSON.stringify([{ id: "a", name: "Alpha", parentId: null }, { id: "b", name: "Beta", parentId: "a" }]));
});

describe("explicit folder keyboard contract", () => {
  it("opens and renames a folder from its accessible tile", async () => {
    const user = userEvent.setup();
    render(<CountersPage theme="light" onThemeChange={() => {}} />);
    const tile = screen.getAllByRole("button").find((element) => element.classList.contains("folder-tile"))!;
    tile.focus();
    await user.keyboard("r");
    const input = screen.getByLabelText("Folder name");
    await user.clear(input);
    await user.type(input, "Renamed");
    await user.click(screen.getAllByRole("button").find((button) => button.textContent?.trim() === "Rename folder")!);
    expect(screen.getByText("Renamed")).toBeInTheDocument();
  });

  it("supports keyboard folder deletion and keeps counters at root", async () => {
    const user = userEvent.setup();
    render(<CountersPage theme="light" onThemeChange={() => {}} />);
    const tile = screen.getAllByRole("button").find((element) => element.classList.contains("folder-tile"))!;
    tile.focus();
    await user.keyboard("{Delete}");
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
  });
});
