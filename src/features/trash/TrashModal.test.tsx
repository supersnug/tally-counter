import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { TrashModal } from "./TrashModal";

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
