#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const config = await readFile('browserstack.yml', 'utf8');
const required = ['browserstackLocal: true', 'forceLocal: true', 'onlyAutomate: true', 'localIdentifier:', 'os: android', 'os: ios', 'deviceName: Google Pixel 8', 'deviceName: iPhone 15', 'browserName: Chrome', 'browserName: Safari', 'video: true', 'screenshots: true'];
const missing = required.filter((marker) => !config.includes(marker));
if (config.includes('Samsung Galaxy S22') || config.includes('browserstackLocal: false')) missing.push('unsupported/disabled provider capability');
const previewUrl = process.env.TALLY_BROWSERSTACK_PREVIEW_URL || 'http://127.0.0.1:4173/';
let previewReachable = false;
try { previewReachable = (await fetch(previewUrl)).ok; } catch { previewReachable = false; }
if (!previewReachable) missing.push('reachable production preview');
const report = { harness: 'browserstack-real-mobile', redacted: true, fixture: true, requiredPlatforms: ['android-chrome-current', 'ios-safari-current'], configValid: missing.length === 0, previewUrl, previewReachable, missing };
console.log(JSON.stringify(report));
if (missing.length) process.exitCode = 1;
