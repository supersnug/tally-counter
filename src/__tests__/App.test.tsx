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
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { encodeCounter } from "../features/counters/model";

const telemetry = vi.hoisted(() => ({ analytics: vi.fn(), speed: vi.fn() }));
vi.mock("@vercel/analytics/react", () => ({ Analytics: telemetry.analytics }));
vi.mock("@vercel/speed-insights/react", () => ({
  SpeedInsights: telemetry.speed,
}));

describe("Tally routes", () => {
  beforeEach(() => {
    localStorage.clear();
    telemetry.analytics.mockClear();
    telemetry.speed.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the landing page and counters call to action", async () => {
    window.history.replaceState({}, "", "/");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /keep count.*stay on track/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start counting/i }),
    ).toHaveAttribute("href", "/counters");
    expect(
      screen.getByRole("heading", {
        name: /simple when you want it.*capable when you need it/i,
      }),
    ).toBeInTheDocument();
    const comparison = screen.getByRole("region", {
      name: /tally counter app feature comparison/i,
    });
    expect(comparison).toHaveTextContent("No subscription");
    expect(comparison).toHaveTextContent("Online Tally Counter");
    expect(comparison).toHaveTextContent("Thing Count");
    expect(comparison).toHaveTextContent("Tally: Counter & Score");
    expect(comparison.querySelectorAll("tbody tr")).toHaveLength(13);
  });

  test("embed route does not initialize telemetry or write theme storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    window.history.replaceState({}, "", `/embed?data=${encodeURIComponent(encodeCounter({ name: "Embed", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }))}`);
    render(<App />);
    expect(await screen.findByRole("main")).toHaveClass("embed-page");
    expect(telemetry.analytics).not.toHaveBeenCalled();
    expect(telemetry.speed).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  test("applies a persisted dark theme to the whole landing page", async () => {
    localStorage.setItem("tally-theme", "dark");
    window.history.replaceState({}, "", "/");
    const { container } = render(<App />);

    await screen.findByRole("heading", { name: /keep count.*stay on track/i });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(container.querySelector(".landing-page")).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });

  test("renders the application 404 page for an unknown route", async () => {
    window.history.replaceState({}, "", "/missing-page");
    render(<App />);

    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /this page doesn't.*add up/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to my counters/i }),
    ).toHaveAttribute("href", "/counters");
  });

  test("renders the MDX guide route with collapsible sections", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide");
    render(<App />);

    expect(
      await screen.findByRole(
        "heading",
        { name: /count simply.*build further when you need to/i },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Scripting", { selector: "summary" }));
    expect(screen.getByRole("link", { name: "TallyScript language" })).toHaveAttribute(
      "href",
      "/guide/scripting/tallyscript",
    );
  });

  test("opens the active category on a detailed guide page", async () => {
    window.history.replaceState({}, "", "/guide/accounts/sync");
    render(<App />);

    expect(await screen.findByRole("heading", { name: /keep devices synchronized/i })).toBeInTheDocument();
    expect(screen.getByText("Accounts & sync", { selector: "summary" }).closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Sync and conflicts" })).toHaveClass("active");
  });

  test("renders the developer guide separately from user documentation", async () => {
    window.history.replaceState({}, "", "/developers/scripting");
    render(<App />);

    expect(await screen.findByRole("heading", { name: /maintain two scripting runtimes/i })).toBeInTheDocument();
    expect(screen.getByText("Feature internals", { selector: "summary" }).closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: /^User Guide/ })).toHaveAttribute("href", "/guide");
  });

  test("renders detailed database guidance in the Dev Guide", async () => {
    window.history.replaceState({}, "", "/developers/database");
    render(<App />);

    expect(await screen.findByRole("heading", { name: /treat grants and rls as separate layers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Policy shapes" })).toBeInTheDocument();
    expect(screen.getByText("Online features", { selector: "summary" }).closest("details")).toHaveAttribute("open");
  });

  test("navigates between guide areas without reloading the app", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide");
    render(<App />);

    await user.click(await screen.findByRole("link", { name: /open the dev guide/i }));

    expect(window.location.pathname).toBe("/developers");
    expect(await screen.findByRole("heading", { name: /build and maintain tally/i })).toBeInTheDocument();
  });

  test("renders the detailed TallyScript reference", async () => {
    window.history.replaceState({}, "", "/guide/scripting/tallyscript");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /complete guide to tallyscript/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Remembered variables" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Remembered variables" }),
    ).toHaveAttribute("href", "#remembered-variables");
  });

  test("renders an interactive tutorial counter", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/counters");
    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: /use your first counter/i }),
    ).toBeInTheDocument();
    await user.click(
      container.querySelector(".guide-live-example .count-button.positive"),
    );
    expect(
      container.querySelector(".guide-live-example .number"),
    ).toHaveTextContent("1");
  });

  test("runs the simulated account and sync tutorial", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/account");
    render(<App />);

    expect(await screen.findByLabelText("Tutorial email or username")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Tutorial password")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: /simulate sign in/i }));
    expect(screen.getByText(/choose which counters to synchronize/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /merge both/i }));
    expect(screen.getByText(/signed in and synchronized/i)).toBeInTheDocument();
  });

  test("updates a live feature tutorial preview", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/embeds");
    render(<App />);

    await user.selectOptions(await screen.findByLabelText("Embed theme"), "dark");
    expect(document.querySelector(".embed-preview")).toHaveClass("theme-dark");
  });

  test("opens the real linked-data options from the backup tutorial", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/backups");
    render(<App />);

    const exports = await screen.findAllByRole("button", { name: /export/i });
    await user.click(exports[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /include linked data/i })).toBeInTheDocument();
    expect(screen.getByText("Include scripts")).toBeInTheDocument();
  });

  test("opens the production copy form from the sharing tutorial counter", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/sharing");
    render(<App />);

    await user.click(await screen.findByTitle("Send a copy"));
    expect(screen.getByRole("heading", { name: /share “team tally”/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient email or username/i)).toBeInTheDocument();
  });

  test("opens the actual Tally Super toolbox from its tutorial", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/super");
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /start editor/i }));
    expect(screen.getByText(/drag an element from the toolbox/i)).toBeInTheDocument();
    expect(screen.getByText("Tally text")).toBeInTheDocument();
  });

  test("uses the real local and Trash states in the storage tutorial", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/guide/tutorial/trash-local");
    render(<App />);

    await user.click(await screen.findByRole("checkbox", { name: /local counter/i }));
    expect(screen.getByText("Local counter", { selector: ".local-counter-banner" })).toBeInTheDocument();
    await user.click(screen.getByTitle("Delete"));
    expect(screen.getByText("4 days 23 hours")).toBeInTheDocument();
    expect(screen.queryByText("Local counter", { selector: ".local-counter-banner" })).not.toBeInTheDocument();
    await user.click(screen.getByTitle("Delete"));
    expect(screen.getByRole("alertdialog", { name: /delete “practice tally” forever/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /restore/i }));
    expect(screen.getByText("Local counter", { selector: ".local-counter-banner" })).toBeInTheDocument();
  });
});

describe("counter creation", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/counters");
  });

  afterEach(() => {
    cleanup();
  });

  test("creates a counter with its chosen starting value", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /new counter/i }));
    await user.clear(screen.getByLabelText("Counter name"));
    await user.type(screen.getByLabelText("Counter name"), "Test tally");
    await user.clear(screen.getByLabelText("Starting value"));
    await user.type(screen.getByLabelText("Starting value"), "7");
    await user.click(screen.getByRole("button", { name: /save counter/i }));

    expect(screen.getByRole("heading", { name: "Test tally" })).toBeVisible();
    expect(screen.getByText("7", { selector: ".number" })).toBeVisible();
    expect(screen.getByText("1", { selector: ".summary strong" })).toBeVisible();
  });

  test("persists theme changes from the counters page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Use dark mode" }));

    expect(localStorage.getItem("tally-theme")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  test("organizes counters with folders and tags and filters them", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /new folder/i }));
    await user.type(screen.getByLabelText("Folder name"), "Health");
    await user.click(screen.getByRole("button", { name: /create folder/i }));
    await user.click(await screen.findByRole("button", { name: /new counter/i }));
    await user.type(screen.getByLabelText("Counter name"), "Water glasses");
    await user.selectOptions(screen.getByLabelText("Folder"), "Health");
    await user.type(screen.getByLabelText(/^Tags/), "daily, hydration");
    await user.click(screen.getByRole("button", { name: /save counter/i }));

    await user.click(screen.getByRole("button", { name: /Health.*1 counter/i }));
    expect(screen.getByText("hydration", { selector: ".counter-organizers span" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /new folder/i }));
    await user.type(screen.getByLabelText("Folder name"), "Daily");
    await user.click(screen.getByRole("button", { name: /create folder/i }));
    const nestedFolder = screen.getByRole("button", { name: /Daily.*0 counters/i });
    const transferValues = new Map<string, string>();
    const transfer = {
      effectAllowed: "",
      setData(type, value) { transferValues.set(type, value); },
      getData(type) { return transferValues.get(type) || ""; },
    };
    fireEvent.dragStart(document.querySelector(".counter-card")!, { dataTransfer: transfer });
    fireEvent.dragOver(nestedFolder, { dataTransfer: transfer });
    fireEvent.drop(nestedFolder, { dataTransfer: transfer });
    await user.click(nestedFolder);
    expect(screen.getByRole("heading", { name: "Water glasses" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Search counters" }), "missing");
    expect(screen.getByText("No counters found")).toBeVisible();
    await user.clear(screen.getByRole("textbox", { name: "Search counters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by tag" }), "hydration");
    expect(screen.getByRole("heading", { name: "Water glasses" })).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by tag" }), "all");
    await user.click(screen.getByRole("button", { name: "Health" }));
    await user.click(screen.getByRole("button", { name: /new folder/i }));
    await user.type(screen.getByLabelText("Folder name"), "Archive");
    await user.click(screen.getByRole("button", { name: /create folder/i }));
    const dailyFolder = screen.getByRole("button", { name: /Daily.*1 counter/i });
    const archiveFolder = screen.getByRole("button", { name: /Archive.*0 counters/i });
    const folderTransferValues = new Map<string, string>();
    const folderTransfer = {
      effectAllowed: "",
      setData(type, value) { folderTransferValues.set(type, value); },
      getData(type) { return folderTransferValues.get(type) || ""; },
    };
    fireEvent.dragStart(dailyFolder, { dataTransfer: folderTransfer });
    fireEvent.dragOver(archiveFolder, { dataTransfer: folderTransfer });
    fireEvent.drop(archiveFolder, { dataTransfer: folderTransfer });
    await user.click(archiveFolder);
    await user.click(screen.getByRole("button", { name: /Daily.*1 counter/i }));
    expect(screen.getByRole("heading", { name: "Water glasses" })).toBeVisible();
  });

  test("persists value history and can undo the latest action", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(await screen.findByRole("button", { name: /new counter/i }));
    await user.type(screen.getByLabelText("Counter name"), "Undo tally");
    await user.click(screen.getByRole("button", { name: /save counter/i }));

    await user.click(container.querySelector(".count-button.positive")!);
    expect(screen.getByText("1", { selector: ".number" })).toBeVisible();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("tally-history") || "[]")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /^history$/i }));
    expect(screen.getByRole("img", { name: /value history for undo tally/i })).toBeVisible();
    await user.click(container.querySelector(".history-actions-head button")!);
    expect(screen.getByText("0", { selector: ".number" })).toBeVisible();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("tally-history") || "[]")).toHaveLength(2));
    const afterUndo = JSON.parse(localStorage.getItem("tally-history") || "[]");
    expect(afterUndo[0].eventId).toBeDefined();
    expect(afterUndo.some((entry) => entry.kind === "undo")).toBe(true);
    expect(afterUndo.some((entry) => entry.kind !== "undo" && entry.from === 0 && entry.to === 1)).toBe(true);
    await user.click(container.querySelectorAll(".history-actions-head button")[1]);
    expect(screen.getByText("1", { selector: ".number" })).toBeVisible();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("tally-history") || "[]")).toHaveLength(3));
    const afterRedo = JSON.parse(localStorage.getItem("tally-history") || "[]");
    expect(afterRedo.filter((entry) => entry.kind === "undo")).toHaveLength(1);
    expect(afterRedo.filter((entry) => entry.kind === "redo")).toHaveLength(1);
    expect(afterRedo.map((entry) => entry.eventId)).toEqual(expect.arrayContaining(afterUndo.map((entry) => entry.eventId)));
  });
});
