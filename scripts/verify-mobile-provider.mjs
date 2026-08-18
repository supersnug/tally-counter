#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const config = await readFile('browserstack.yml', 'utf8');
const required = ['os: android', 'os: ios', 'deviceName:', 'browserName:', 'video: true', 'screenshots: true'];
const missing = required.filter((marker) => !config.includes(marker));
const report = { harness: 'browserstack-real-mobile', redacted: true, fixture: true, requiredPlatforms: ['android-chrome-current', 'ios-safari-current'], configValid: missing.length === 0, missing };
console.log(JSON.stringify(report));
if (missing.length) process.exitCode = 1;
