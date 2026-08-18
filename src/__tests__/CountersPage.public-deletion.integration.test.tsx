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
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase.js", () => ({ supabase: null, supabaseConfigured: false }));
import { CountersPage } from "../pages/CountersPage";

const counter = {
  id: "delayed-counter",
  name: "Delayed counter",
  value: 0,
  start: 0,
  plusStep: 1,
  minusStep: 1,
  goals: [],
  goalDirection: "more",
  min: null,
  max: null,
  color: "#ef6a47",
  folderId: null,
  tags: [],
};

const preferences = {
  density: "comfortable",
  columns: "auto",
  numberSize: "standard",
  showBounds: true,
  animations: false,
  defaultColor: "#ef6a47",
  trashEnabled: true,
  syncTrash: false,
  theme: "light",
};

async function deleteAfterStartingDelayedScript(trashEnabled: boolean) {
  localStorage.setItem("tally-counters", JSON.stringify([counter]));
  localStorage.setItem("tally-preferences", JSON.stringify({ ...preferences, trashEnabled }));
  localStorage.setItem("tally-scripts", JSON.stringify({ [counter.id]: { language: "tallyscript", source: "sleep 100; add", enabled: false } }));

  render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  fireEvent.click(screen.getByTitle("Settings"));
  fireEvent.click(screen.getByRole("button", { name: "Scripting" }));
  fireEvent.click(screen.getByRole("button", { name: "Run script" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByTitle("Delete"));
  if (!trashEnabled) fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));

  await new Promise((resolve) => setTimeout(resolve, 125));
  await waitFor(() => {
    const state = JSON.parse(localStorage.getItem("tally-counter-bundle") || "{}").state;
    expect(state.active).toHaveLength(0);
    expect(state.active.some((item: { id: string }) => item.id === counter.id)).toBe(false);
    if (trashEnabled) {
      expect(state.retained).toHaveLength(1);
      expect(state.retained[0].id).toBe(counter.id);
      expect(state.retained.some((item: { id: string }) => item.id === counter.id)).toBe(true);
    } else {
      expect(state.retained).toHaveLength(0);
      expect(state.retained.some((item: { id: string }) => item.id === counter.id)).toBe(false);
    }
  });
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("CountersPage public deletion lifecycle", () => {
  it("does not recreate a counter after a delayed callback when Trash is enabled", async () => {
    await deleteAfterStartingDelayedScript(true);
  });

  it("does not recreate a counter after confirmed permanent deletion when Trash is disabled", async () => {
    await deleteAfterStartingDelayedScript(false);
  });
});
