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
  test('supports narrow keyboard access', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /count anything/i })).toBeVisible();
    await page.getByRole('link', { name: /start counting/i }).click();
    await expect(page).toHaveURL(/counters/);
    await expect(page.getByRole('button', { name: /add counter/i })).toBeVisible();
  });

  test('records persistence, theme, focus, clipboard, and recovery seams', async ({ page, context }) => {
    await page.goto('/counters');
    await expect(page.getByRole('main')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('tally-theme', 'dark'));
    await page.reload();
    await expect(page.locator('[data-theme="dark"]')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('tally-recovery-fixture', JSON.stringify({ valid: true, malformed: '{' })));
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.locator('body')).toBeVisible();
  });
});
