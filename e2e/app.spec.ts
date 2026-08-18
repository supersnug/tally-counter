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
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("opens the counters workspace from the landing page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /start counting/i }).click();

  await expect(page).toHaveURL(/\/counters$/);
  await expect(
    page.getByRole("heading", { name: "My counters" }),
  ).toBeVisible();
});

test("creates, increments, and persists a counter", async ({ page }) => {
  await page.goto("/counters");
  await page.getByRole("button", { name: /new counter/i }).click();

  await page.getByLabel("Counter name").fill("Playwright tally");
  await page.getByLabel("Starting value").fill("5");
  await page.getByRole("button", { name: /save counter/i }).click();

  const card = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "Playwright tally" }),
  });
  await expect(card.locator(".number")).toHaveText("5");
  await card.locator('[data-counter-part="add"]').click();
  await expect(card.locator(".number")).toHaveText("6");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Playwright tally" }),
  ).toBeVisible();
  await expect(page.locator(".counter-card .number")).toHaveText("6");
});

test("runs a TallyScript from counter settings", async ({ page }) => {
  await page.goto("/counters");
  await page.getByRole("button", { name: /new counter/i }).click();
  await page.getByLabel("Counter name").fill("Scripted tally");
  await page.getByRole("button", { name: /save counter/i }).click();

  const card = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "Scripted tally" }),
  });
  await card.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await page
    .getByLabel("TallyScript code")
    .fill("repeat 3 times\n  add 2\nend");
  await page.getByRole("button", { name: /run script/i }).click();

  await expect(page.getByRole("status")).toHaveText(/script (ran|started)/i);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(card.locator(".number")).toHaveText("6");
});

test("runs full JavaScript in the counter sandbox", async ({ page }) => {
  await page.goto("/counters");
  await page.getByRole("button", { name: /new counter/i }).click();
  await page.getByLabel("Counter name").fill("JavaScript tally");
  await page.getByRole("button", { name: /save counter/i }).click();

  const card = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "JavaScript tally" }),
  });
  await card.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await page.getByRole("button", { name: "JavaScript" }).click();
  await page
    .getByLabel("JavaScript code")
    .fill(
      "class Add { constructor(n) { this.n = n; } run() { Tally.value.add(this.n); } } new Add(7).run();",
    );
  await page.getByRole("button", { name: /run script/i }).click();

  await expect(page.getByRole("status")).toHaveText(/script (ran|started)/i);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(card.locator(".number")).toHaveText("7");
});

test("runs yielding JavaScript until it is stopped or the page reloads", async ({
  page,
}) => {
  await page.goto("/counters");
  await page.getByRole("button", { name: /new counter/i }).click();
  await page.getByLabel("Counter name").fill("Background tally");
  await page.getByRole("button", { name: /save counter/i }).click();

  const card = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "Background tally" }),
  });
  await card.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await page.getByRole("button", { name: "JavaScript" }).click();
  await page
    .getByLabel("JavaScript code")
    .fill("while (true) { Tally.value.add(); await Tally.sleep(25); }");
  await page.getByRole("button", { name: /run script/i }).click();
  await expect(
    page.getByRole("button", { name: /stop script/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await expect(card.locator(".number")).not.toHaveText("0");
  const firstValue = Number(await card.locator(".number").textContent());
  await page.waitForTimeout(80);
  expect(Number(await card.locator(".number").textContent())).toBeGreaterThan(
    firstValue,
  );

  const valueBeforeReload = await page.evaluate(() => {
    const bundle = JSON.parse(localStorage.getItem("tally-counter-bundle") || "{}");
    const counters = bundle.state?.active || [];
    return counters.find((counter: { name?: string }) => counter.name === "Background tally")?.value;
  });
  expect(valueBeforeReload).toBeGreaterThan(firstValue);

  await page.reload();
  const restoredCard = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "Background tally" }),
  });
  const restoredState = await page.evaluate(() => {
    const bundle = JSON.parse(localStorage.getItem("tally-counter-bundle") || "{}");
    const counter = (bundle.state?.active || []).find(
      (item: { name?: string }) => item.name === "Background tally",
    );
    return {
      value: counter?.value,
      scriptEnabled: Boolean(bundle.state?.scripts?.[counter?.id]?.enabled),
    };
  });
  await expect(restoredCard.locator(".number")).toHaveText(
    String(restoredState.value),
  );
  await page.waitForTimeout(80);
  const settledState = await page.evaluate(() => {
    const bundle = JSON.parse(localStorage.getItem("tally-counter-bundle") || "{}");
    const counter = (bundle.state?.active || []).find(
      (item: { name?: string }) => item.name === "Background tally",
    );
    return {
      value: counter?.value,
      scriptEnabled: Boolean(bundle.state?.scripts?.[counter?.id]?.enabled),
    };
  });
  expect(settledState.value).toBe(restoredState.value);
  expect(settledState.scriptEnabled).toBe(false);
  await expect(restoredCard.locator(".number")).toHaveText(
    String(restoredState.value),
  );

  await restoredCard.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await expect(page.getByRole("button", { name: /run script/i })).toBeVisible();
});

test("runs a yielding TallyScript loop in the background", async ({ page }) => {
  await page.goto("/counters");
  await page.getByRole("button", { name: /new counter/i }).click();
  await page.getByLabel("Counter name").fill("TallyScript loop");
  await page.getByRole("button", { name: /save counter/i }).click();

  const card = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "TallyScript loop" }),
  });
  await card.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await page.getByLabel("TallyScript code").fill(
    "while true\n  sleep 25 ms\n  add\nend",
  );
  await page.getByRole("button", { name: /run script/i }).click();
  await expect(page.getByRole("button", { name: /stop script/i })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(card.locator(".number")).not.toHaveText("0");

  await card.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Scripting" }).click();
  await page.getByRole("button", { name: /stop script/i }).click();
  await expect(page.getByRole("button", { name: /run script/i })).toBeVisible();
});

test("shows Tally's 404 page for an unknown route", async ({ page }) => {
  await page.goto("/not-a-real-page");

  await expect(page.getByText("404")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /this page doesn't.*add up/i }),
  ).toBeVisible();
});

test("supports narrow keyboard access and reduced-motion semantics", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("overflow-x", "hidden");
  const start = page.getByRole("link", { name: /start counting/i }).first();
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
