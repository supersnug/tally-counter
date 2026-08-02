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

  test("renders the landing page and counters call to action", () => {
    window.history.replaceState({}, "", "/");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /keep count.*stay on track/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start counting/i }),
    ).toHaveAttribute("href", "/counters");
  });

  test("applies a persisted dark theme to the whole landing page", () => {
    localStorage.setItem("tally-theme", "dark");
    window.history.replaceState({}, "", "/");
    const { container } = render(<App />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(container.querySelector(".landing-page")).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });

  test("renders the application 404 page for an unknown route", () => {
    window.history.replaceState({}, "", "/missing-page");
    render(<App />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /this page doesn't.*add up/i }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /new counter/i }));
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

    await user.click(screen.getByRole("button", { name: "Use dark mode" }));

    expect(localStorage.getItem("tally-theme")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
