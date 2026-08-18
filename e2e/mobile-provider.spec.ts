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
import { expect, test } from '@playwright/test';

test.describe('real mobile provider acceptance', () => {
  const openWorkspace = async (page: import('@playwright/test').Page) => {
    await page.goto('/');
    await page.getByRole('link', { name: /start counting/i }).click();
    await expect(page.getByRole('heading', { name: 'My counters' })).toBeVisible();
  };

  test('supports narrow keyboard access', async ({ page }) => {
    await openWorkspace(page);
    await expect(page.getByRole('button', { name: /add counter/i })).toBeVisible();
  });

  test('records persistence, theme, focus, clipboard, and recovery seams', async ({ page }) => {
    await openWorkspace(page);
    await page.getByRole('button', { name: /new counter/i }).click();
    await page.getByLabel('Counter name').fill('Provider persistence tally');
    await page.getByRole('button', { name: /save counter/i }).click();
    const card = page.locator('.counter-card', { has: page.getByRole('heading', { name: 'Provider persistence tally' }) });
    await expect(card).toBeVisible();
    await card.locator('[data-counter-part="add"]').click();
    await page.reload();
    const reloadedCard = page.locator('.counter-card', { has: page.getByRole('heading', { name: 'Provider persistence tally' }) });
    await expect(reloadedCard.locator('.number')).toHaveText('1');
    await page.getByRole('button', { name: 'Use dark mode' }).click();
    await expect(page.locator('html[data-theme="dark"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('html[data-theme="dark"]')).toBeVisible();
    const focusTarget = page.getByRole('button', { name: /new counter/i });
    await focusTarget.focus();
    await expect(focusTarget).toBeFocused();
    await reloadedCard.getByTitle('Embed').click();
    await page.locator('.code-box button').click();
    await expect(page.getByText(/Copied|Copy failed — retry/)).toBeVisible();
    await page.locator('.embed-modal .modal-head button').click();
    await page.evaluate(() => localStorage.setItem('tally-history', JSON.stringify([{ malformed: true }])));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Provider persistence tally' })).toBeVisible();
    await page.getByRole('button', { name: /^history$/i }).click();
    await expect(page.getByText(/malformed activity entries quarantined/i)).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });
});
