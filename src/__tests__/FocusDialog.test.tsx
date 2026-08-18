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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusDialog } from "../shared/components/FocusDialog";

describe("FocusDialog", () => {
  it("focuses, traps Tab, closes on Escape, and restores its invoker", () => {
    const onClose = vi.fn();
    const invoker = document.createElement("button");
    document.body.append(invoker); invoker.focus();
    const { unmount } = render(<FocusDialog title="Confirm" onClose={onClose}><button>First</button><button>Last</button></FocusDialog>);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "First" }), { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Last" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    unmount(); expect(invoker).toHaveFocus(); invoker.remove();
  });
});
