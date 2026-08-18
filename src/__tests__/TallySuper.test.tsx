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
import { SuperEditorPane } from "../features/tally-super/TallySuper";
import { validateSuperCustomization, validateSuperItem } from "../features/tally-super/validator";
import { persistCustomization } from "../features/tally-super/persistence";
import { CounterCard } from "../features/counters/CounterCard";

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

test("validates the element table, required visibility, transforms, dimensions, zones, and duplicate order", () => {
  expect(validateSuperItem({ id: "title", type: "title", zone: "workspace", hidden: true }).ok).toBe(false);
  const bounded = validateSuperItem({ id: "text", type: "text", zone: "workspace", x: 120, y: -1, scaleX: 2 });
  expect(bounded.ok && bounded.value).toEqual(expect.objectContaining({ x: 100, y: 0 }));
  expect(validateSuperItem({ id: "text", type: "text", zone: "workspace", width: 20 }).ok).toBe(false);
  expect(validateSuperItem({ id: "add", type: "add", zone: "workspace", width: 20, height: 30, scaleX: 1 }).ok).toBe(true);
  expect(validateSuperItem({ id: "bad", type: "text", zone: "unknown" }).ok).toBe(false);
  expect(validateSuperCustomization({ items: [{ id: "x", type: "text", zone: "workspace" }, { id: "x", type: "text", zone: "workspace" }, { id: "old", type: "obsolete", zone: "workspace" }] }).items).toHaveLength(1);
});

test("failed customization persistence keeps the prior authority and reports recovery", () => {
  const previous = { items: [{ id: "one", type: "text", zone: "workspace" }] };
  const result = persistCustomization(previous, { items: [] }, () => { throw new Error("quota"); });
  expect(result).toEqual(expect.objectContaining({ ok: false, recovered: true, value: previous }));
});

test("malformed hidden required parts still render", () => {
  render(<CounterCard counter={{ id: "c", name: "Visible", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }} index={0} showBounds customization={{ parts: { title: { hidden: true }, count: { hidden: true }, add: { hidden: true }, settings: { hidden: true }, delete: { hidden: true } } }} onChange={() => {}} onReset={() => {}} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("Visible")).toBeVisible();
  expect(screen.getByText("1")).toBeVisible();
  expect(document.querySelector('[data-counter-part="add"]')).toBeVisible();
  expect(document.querySelector('[data-counter-part="settings"]')).toBeVisible();
  expect(document.querySelector('[data-counter-part="delete"]')).toBeVisible();
});
