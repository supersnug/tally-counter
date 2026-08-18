#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const config = await readFile('browserstack.yml', 'utf8');
const required = ['browserstackLocal: true', 'forceLocal: true', 'onlyAutomate: true', 'localIdentifier:', 'os: android', 'os: ios', 'deviceName: Google Pixel 8', 'deviceName: iPhone 15', 'browserName: Chrome', 'browserName: Safari', 'video: true', 'screenshots: true'];
const missing = required.filter((marker) => !config.includes(marker));
if (config.includes('Samsung Galaxy S22') || config.includes('browserstackLocal: false')) missing.push('unsupported/disabled provider capability');
const remoteBase = process.env.TALLY_BROWSERSTACK_REMOTE_BASE_URL || 'http://bs-local.com:4173';
if (!remoteBase.startsWith('http://bs-local.com:')) missing.push('BrowserStack bs-local remote base URL');
const viteConfig = await readFile('vite.config.js', 'utf8');
if (!viteConfig.includes('allowedHosts') || !viteConfig.includes('bs-local.com')) missing.push('narrow Vite preview allowed host');
if (config.includes('localhost:4173')) missing.push('localhost remote route');
const spec = await readFile('e2e/mobile-provider.spec.ts', 'utf8');
for (const shallow of ['tally-recovery-fixture', "getByRole('main')", "grantPermissions(['clipboard-read', 'clipboard-write'])"]) if (spec.includes(shallow)) missing.push(`shallow mobile fixture: ${shallow}`);
for (const meaningful of ['Provider persistence tally', 'html[data-theme="dark"]', 'toBeFocused', 'Copy failed', 'malformed activity entries quarantined']) if (!spec.includes(meaningful)) missing.push(`missing public seam: ${meaningful}`);
const previewUrl = process.env.TALLY_BROWSERSTACK_PREVIEW_URL || 'http://127.0.0.1:4173/';
let previewReachable = false;
try { previewReachable = (await fetch(previewUrl)).ok; } catch { previewReachable = false; }
if (!previewReachable) missing.push('reachable production preview');
const report = { harness: 'browserstack-real-mobile', redacted: true, fixture: true, requiredPlatforms: ['android-chrome-current', 'ios-safari-current'], configValid: missing.length === 0, previewUrl, previewReachable, missing };
console.log(JSON.stringify(report));
if (missing.length) process.exitCode = 1;
