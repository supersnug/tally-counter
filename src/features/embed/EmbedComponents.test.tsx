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
import { afterEach, expect, test, vi } from "vitest";
import { EmbedBuilder, EmbeddedCounter } from "./EmbedComponents";

const source = { name: 'A"><img src=x onerror=alert(1)>', value: 2, start: 0, plusStep: 2, minusStep: 1, goals: [], goalDirection: "more", min: 0, max: 5, color: "#ef6a47", secret: "never-public" };

afterEach(() => vi.restoreAllMocks());

test("renders one safe iframe and excludes sentinels from decoded markup", () => {
  render(<EmbedBuilder counter={source} onClose={vi.fn()} />);
  const code = screen.getByText(/<iframe/).textContent!;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = code;
  const iframe = wrapper.querySelector("iframe")!;
  expect(wrapper.querySelectorAll("iframe")).toHaveLength(1);
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
  const payload = JSON.parse(decodeURIComponent(escape(atob(new URL(iframe.src).searchParams.get("data")!))));
  expect(payload).toEqual({ format: "tally-counter-snapshot", version: 1, display: { name: source.name, value: 2, start: 0, color: "#ef6a47" }, counting: { plusStep: 2, minusStep: 1, min: 0, max: 5 }, goals: { values: [], direction: "more" }, options: { watermark: true, compact: false, reset: true, settings: false, theme: "auto" } });
  expect(code).not.toContain("never-public");
  expect(wrapper.querySelector("img")).toBeNull();
});

test("retains markup after clipboard rejection without claiming copied", async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  render(<EmbedBuilder counter={{ ...source, name: "Safe" }} onClose={vi.fn()} />);
  const code = screen.getByText(/<iframe/).textContent!;
  fireEvent.click(screen.getAllByRole("button").find((button) => button.textContent?.includes("Copy"))!);
  await screen.findByText(/Copy failed/);
  expect(screen.getByText(code)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
});

test("preview controls are source-independent and option changes reset encoded current", () => {
  const original = { ...source };
  render(<EmbedBuilder counter={source} onClose={vi.fn()} />);
  const before = screen.getByText(/<iframe/).textContent;
  fireEvent.click(screen.getAllByRole("button").find((button) => button.textContent?.trim() === "2")!);
  expect(screen.getByText("4")).toBeInTheDocument();
  expect(source).toEqual(original);
  expect(screen.getByText(/<iframe/).textContent).toBe(before);
  fireEvent.click(screen.getByLabelText("Compact size"));
  expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /reset/i }));
  expect(screen.getAllByText("0").length).toBeGreaterThan(0);
});

test("embedded details contains exactly the four rule fields", () => {
  render(<EmbeddedCounter initial={{ ...source, embedOptions: { watermark: false, compact: false, reset: true, settings: true, theme: "light" } }} params={new URLSearchParams()} />);
  fireEvent.click(screen.getByTitle("Counter details"));
  expect(screen.getByText("− step")).toBeInTheDocument();
  expect(screen.getByText("+ step")).toBeInTheDocument();
  expect(screen.getByText("Minimum")).toBeInTheDocument();
  expect(screen.getByText("Maximum")).toBeInTheDocument();
  expect(screen.getByText("Minimum").closest(".embed-details")?.children).toHaveLength(4);
});
