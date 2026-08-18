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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { TrashModal } from "../features/trash/TrashModal";

test("requires confirmation before permanently deleting every trashed counter", async () => {
  const user = userEvent.setup();
  const onDeleteAll = vi.fn();
  render(
    <TrashModal
      items={[{
        id: "trash-1", name: "Old tally", value: 2, start: 0,
        plusStep: 1, minusStep: 1, goals: [], goalDirection: "more",
        min: null, max: null, color: "#ef6a47", deletedAt: Date.now(),
      }]}
      showBounds
      showLocalBanner={false}
      onChange={vi.fn()}
      onEdit={vi.fn()}
      onEmbed={vi.fn()}
      onRestore={vi.fn()}
      onDelete={vi.fn()}
      onDeleteAll={onDeleteAll}
      onClose={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Delete all" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Delete all 1 counter forever?");
  expect(onDeleteAll).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Delete all forever" }));
  expect(onDeleteAll).toHaveBeenCalledOnce();
});
