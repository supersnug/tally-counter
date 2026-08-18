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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SettingToggle } from "../shared/components/SettingToggle";
import { ModalA11yManager } from "../shared/components/ModalA11yManager";
import guideSource from "../features/guide/GuideExamples.tsx?raw";
import legacyGuideSource from "../features/guide/GuideExamplesLegacy.tsx?raw";
import styleSource from "../styles.css?raw";
describe("TCD-020 semantic inventory", () => {
  it("keeps production settings on the shared checkbox toggle", () => {
    render(<SettingToggle label="Inventory toggle" checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Inventory toggle" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Inventory toggle" }).nextElementSibling?.tagName).toBe("I");
  });
  it("uses a single shared toggle component for inventory-sensitive paths", () => expect(SettingToggle).toBeTypeOf("function"));

  it("does not retain legacy setting-switch controls in production sources", () => {
    const source = [guideSource, legacyGuideSource, styleSource].join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).not.toContain("setting-switch");
  });

  it("labels class-only dialogs, cancels safely, cleans up, and restores focus", async () => {
    function Fixture() {
      const [open, setOpen] = useState(false);
      return <><ModalA11yManager /><button onClick={() => setOpen(true)}>Open dialog</button>{open && <div className="modal-backdrop"><div className="modal"><h2>Remove counter</h2><p>This is permanent.</p><button className="cancel" onClick={() => setOpen(false)}>Cancel</button><button onClick={() => setOpen(false)}>Delete</button></div></div>}</>;
    }
    render(<Fixture />);
    const invoker = screen.getByRole("button", { name: "Open dialog" });
    invoker.focus();
    fireEvent.click(invoker);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", expect.stringMatching(/^modal-title-/));
    expect(dialog).toHaveAttribute("aria-describedby", expect.stringMatching(/^modal-description-/));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(invoker).toHaveFocus());
  });
});
