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
import { expect, test, vi } from "vitest";

vi.mock("../lib/supabase.js", () => ({ supabase: null, supabaseConfigured: false }));
import { CountersPage } from "../pages/CountersPage";

test("no-session brand navigation persists stopped scripts before navigating", async () => {
  localStorage.setItem("tally-scripts", JSON.stringify({ one: { enabled: true, language: "tallyscript", source: "" } }));
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} />);
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  expect(JSON.parse(localStorage.getItem("tally-scripts") || "{}").one.enabled).toBe(false);
  await vi.waitFor(() => expect(navigateTo).toHaveBeenCalled());
});
