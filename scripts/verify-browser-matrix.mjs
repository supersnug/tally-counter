import fs from "node:fs";

const config = fs.readFileSync("playwright.config.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/release-evidence.yml", "utf8");
for (const value of [
  'name: "firefox-previous"',
  'name: "safari-previous"',
  "TALLY_PREVIOUS_FIREFOX_PATH",
  "TALLY_PREVIOUS_SAFARI_PATH",
]) if (!config.includes(value)) throw new Error(`Missing browser config evidence: ${value}`);
for (const value of [
  "playwright@1.61.0 install",
  "prepare-browser-matrix.mjs",
  "--project=firefox-previous",
  "--project=safari-previous",
]) if (!workflow.includes(value)) throw new Error(`Missing release provisioning evidence: ${value}`);
console.log("Browser matrix configuration and release provisioning verified.");
