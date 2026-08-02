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
  await page.getByRole("button", { name: "Done" }).click();
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
  await page.getByRole("button", { name: "Done" }).click();
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
  await page.getByRole("button", { name: "Done" }).click();

  await expect(card.locator(".number")).not.toHaveText("0");
  const firstValue = Number(await card.locator(".number").textContent());
  await page.waitForTimeout(80);
  expect(Number(await card.locator(".number").textContent())).toBeGreaterThan(
    firstValue,
  );

  await page.reload();
  const restoredCard = page.locator(".counter-card", {
    has: page.getByRole("heading", { name: "Background tally" }),
  });
  const restoredValue = Number(
    await restoredCard.locator(".number").textContent(),
  );
  await page.waitForTimeout(80);
  expect(Number(await restoredCard.locator(".number").textContent())).toBe(
    restoredValue,
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
  await page.getByRole("button", { name: "Done" }).click();
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
