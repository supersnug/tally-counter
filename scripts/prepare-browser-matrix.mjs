import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function executable(root, names) {
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!names.includes(entry.name)) continue;
    const candidate = path.join(entry.parentPath || entry.path, entry.name);
    try {
      if (fs.statSync(candidate).mode & 0o111) return candidate;
    } catch { /* ignore incomplete browser cache entries */ }
  }
  return null;
}

const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), ".cache", "ms-playwright");
const previous = path.join(os.homedir(), ".cache", "ms-playwright-previous");
const previousFirefox = executable(previous, ["firefox"]);
const previousWebKit = executable(previous, ["MiniBrowser", "minibrowser", "WebKit"]);
if (!previousFirefox || !previousWebKit) {
  throw new Error("Previous Firefox and WebKit browser evidence was not provisioned.");
}
if (!executable(cache, ["firefox"])) throw new Error("Current Firefox browser evidence was not provisioned.");
console.log(`TALLY_PREVIOUS_FIREFOX_PATH=${previousFirefox}`);
console.log(`TALLY_PREVIOUS_SAFARI_PATH=${previousWebKit}`);
