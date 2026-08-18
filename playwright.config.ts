/// <reference types="node" />
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

import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://127.0.0.1:4173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /supports narrow keyboard access/,
    },

    {
      name: 'chromium-reduced-motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },

    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
    ...(process.env.TALLY_CHROME_PATH && fs.existsSync(process.env.TALLY_CHROME_PATH) ? [{ name: 'branded-chrome-current', use: { ...devices['Desktop Chrome'], executablePath: process.env.TALLY_CHROME_PATH } }] : []),
    ...(process.env.TALLY_EDGE_PATH && fs.existsSync(process.env.TALLY_EDGE_PATH) ? [{ name: 'branded-edge-current', use: { ...devices['Desktop Edge'], executablePath: process.env.TALLY_EDGE_PATH } }] : []),
    ...(process.env.TALLY_PREVIOUS_CHROME_PATH && fs.existsSync(process.env.TALLY_PREVIOUS_CHROME_PATH) ? [{ name: 'branded-chrome-previous', use: { ...devices['Desktop Chrome'], executablePath: process.env.TALLY_PREVIOUS_CHROME_PATH } }] : []),
    ...(process.env.TALLY_PREVIOUS_EDGE_PATH && fs.existsSync(process.env.TALLY_PREVIOUS_EDGE_PATH) ? [{ name: 'branded-edge-previous', use: { ...devices['Desktop Edge'], executablePath: process.env.TALLY_PREVIOUS_EDGE_PATH } }] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
