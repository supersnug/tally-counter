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
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SyncConflictModal } from "../shared/components/SettingsControls";

describe("live sync conflict choices", () => {
  it("renders exact choices and requires singleton decisions before merge", () => {
    const onChoose = vi.fn();
    render(<SyncConflictModal deviceCount={2} cloudCount={3} onChoose={onChoose} singletonChoices={{ preferences: "device", workspace: "device", folders: "device" }} />);
    expect(screen.getByText("Keep device version")).toBeInTheDocument();
    expect(screen.getByText("Use cloud version")).toBeInTheDocument();
    const merge = screen.getByText("Merge both").closest("button")!;
    expect(merge).not.toBeDisabled();
    fireEvent.click(merge);
    expect(onChoose).toHaveBeenCalledWith("merge");
  });
  it("keeps cancel outside the resolver choices", () => {
    const onChoose = vi.fn();
    render(<SyncConflictModal deviceCount={1} cloudCount={1} onChoose={onChoose} />);
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });
});
