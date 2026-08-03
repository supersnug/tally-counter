import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SuperEditorPane } from "./TallySuper";

test("removes individual Settings and Stats elements from the editor pane", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const value = {
    items: [
      { id: "settings-text", zone: "settings", type: "text", text: "Settings note" },
      { id: "stats-value", zone: "stats", type: "session-actions", label: "Session actions" },
      { id: "workspace-text", zone: "workspace", type: "text", text: "Workspace note" },
    ],
  };

  render(<SuperEditorPane counters={[]} value={value} onChange={onChange} onClose={() => {}} />);
  await user.click(screen.getByRole("button", { name: /remove settings note from settings menu/i }));

  expect(onChange).toHaveBeenCalledWith({
    ...value,
    items: [value.items[1], value.items[2]],
  });
  expect(screen.getByRole("button", { name: /remove session actions from stats menu/i })).toBeVisible();
});
