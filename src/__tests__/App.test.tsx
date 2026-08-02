import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("@vercel/analytics/react", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/react", () => ({
  SpeedInsights: () => null,
}));

describe("Tally routes", () => {
  beforeEach(() => {
    localStorage.clear();
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
});
