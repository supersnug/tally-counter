import fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = process.env.BROWSER_MATRIX_CACHE || path.join(os.homedir(), ".cache", "tally-browser-matrix");
const FIXTURE = process.env.BROWSER_MATRIX_FIXTURE;
const METADATA_ONLY = process.argv.includes("--metadata-only");
const CHROME_METADATA = "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";
const CHROME_STABLE_METADATA = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json";
const EDGE_METADATA = "https://packages.microsoft.com/repos/edge/dists/stable/main/binary-amd64/Packages";
const BRANDED_PATH_KEYS = ["TALLY_CHROME_CURRENT_PATH", "TALLY_CHROME_PREVIOUS_PATH", "TALLY_EDGE_CURRENT_PATH", "TALLY_EDGE_PREVIOUS_PATH"];

const major = (version) => Number(String(version).split(".")[0]);
const versionOf = (value) => String(value).match(/\d+(?:\.\d+){2,3}/)?.[0] || "";
export const selectAdjacent = (versions, current = null) => {
  const ordered = versions.filter((item) => versionOf(item.version)).sort((a, b) => versionOf(b.version).localeCompare(versionOf(a.version), undefined, { numeric: true }));
  const selectedCurrent = current || ordered[0];
  const previous = ordered.find((item) => major(item.version) === major(selectedCurrent.version) - 1);
  if (!selectedCurrent || !previous || selectedCurrent.version === previous.version) throw new Error("Browser metadata did not contain adjacent release majors.");
  return { current: selectedCurrent, previous };
};

async function metadata(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Browser metadata request failed: ${response.status} ${url}`);
  return response.json();
}
async function edgeMetadata(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Browser metadata request failed: ${response.status} ${url}`);
  return response.text();
}
function parseEdgePackages(text) {
  return text.split(/\n\s*\n/).map((block) => {
    const field = (name) => block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1];
    const packageName = field("Package");
    const version = field("Version")?.replace(/-\d+$/, "");
    const filename = field("Filename");
    return packageName === "microsoft-edge-stable" && version && filename ? { version, url: `https://packages.microsoft.com/repos/edge/${filename}`, format: "deb" } : null;
  }).filter(Boolean);
}

function downloadAndExtract(url, destination) {
  const format = /\.deb(?:$|\?)/i.test(url) ? "deb" : "zip";
  const archive = `${destination}.${format}`;
  mkdirSync(path.dirname(destination));
  const download = spawnSync("curl", ["--fail", "--location", "--silent", "--show-error", url, "--output", archive], { stdio: "inherit" });
  if (download.status !== 0) throw new Error(`Could not download browser archive: ${url}`);
  const extract = format === "deb"
    ? spawnSync("dpkg-deb", ["-x", archive, destination], { stdio: "inherit" })
    : spawnSync("unzip", ["-q", "-o", archive, "-d", destination], { stdio: "inherit" });
  if (extract.status !== 0) throw new Error(`Could not extract browser archive: ${archive}`);
  return archive;
}

function mkdirSync(directory) { fs.mkdirSync(directory, { recursive: true }); }
function executable(root, names) {
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && names.includes(entry.name)) {
      const candidate = path.join(entry.parentPath || entry.path, entry.name);
      if (fs.statSync(candidate).mode & 0o111) return candidate;
    }
  }
  return "";
}
function browserVersion(executablePath) {
  const result = spawnSync(executablePath, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read browser version: ${executablePath}`);
  const version = versionOf(result.stdout);
  if (!version) throw new Error(`Browser did not report a version: ${executablePath}`);
  return version;
}
function emit(values) {
  const lines = Object.entries(values).flatMap(([key, value]) => [`${key}=${value}`, `${key.replace("PATH", "VERSION")}=${values[`${key.replace("PATH", "VERSION")}`] || ""}`]);
  const unique = [...new Set(lines.filter((line) => !line.endsWith("=")))];
  console.log(unique.join("\n"));
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${unique.join("\n")}\n`);
}

if (FIXTURE) {
  const fixture = JSON.parse(await readFile(FIXTURE, "utf8"));
  emit(fixture);
  process.exit(0);
}

const [chromeMetadata, chromeStableMetadata, edgePackages] = await Promise.all([metadata(CHROME_METADATA), metadata(CHROME_STABLE_METADATA), edgeMetadata(EDGE_METADATA)]);
const stableChrome = chromeStableMetadata.channels?.Stable;
if (!stableChrome?.version || !stableChrome.downloads?.chrome) throw new Error("Official Chrome Stable metadata is incomplete.");
const chromeCurrent = { version: stableChrome.version, url: stableChrome.downloads.chrome.find((download) => download.platform === "linux64")?.url, format: "zip" };
const chromeVersions = chromeMetadata.versions.map((item) => ({ version: item.version, url: item.downloads?.chrome?.find((download) => download.platform === "linux64")?.url, format: "zip" })).filter((item) => item.url);
const edgeReleases = parseEdgePackages(edgePackages);
const selected = { chrome: selectAdjacent(chromeVersions, chromeCurrent), edge: selectAdjacent(edgeReleases) };
for (const [brand, releases] of Object.entries(selected)) for (const release of Object.values(releases)) if (!/^https:\/\//.test(release.url) || !["zip", "deb"].includes(release.format)) throw new Error(`Invalid official ${brand} artifact metadata.`);
if (METADATA_ONLY) {
  emit({ TALLY_CHROME_CURRENT_VERSION: selected.chrome.current.version, TALLY_CHROME_CURRENT_URL: selected.chrome.current.url, TALLY_CHROME_PREVIOUS_VERSION: selected.chrome.previous.version, TALLY_CHROME_PREVIOUS_URL: selected.chrome.previous.url, TALLY_EDGE_CURRENT_VERSION: selected.edge.current.version, TALLY_EDGE_CURRENT_URL: selected.edge.current.url, TALLY_EDGE_PREVIOUS_VERSION: selected.edge.previous.version, TALLY_EDGE_PREVIOUS_URL: selected.edge.previous.url });
  process.exit(0);
}
const paths = {};
for (const [brand, releases] of Object.entries(selected)) {
  for (const [age, release] of Object.entries(releases)) {
    const destination = path.join(CACHE, `${brand}-${age}-${release.version}`);
    const expectedNames = brand === "chrome" ? ["chrome"] : ["msedge", "microsoft-edge"];
    if (!fs.existsSync(destination)) downloadAndExtract(release.url, destination);
    const executablePath = executable(destination, expectedNames);
    if (!executablePath) throw new Error(`Extracted ${brand} archive has no executable: ${destination}`);
    paths[`TALLY_${brand.toUpperCase()}_${age.toUpperCase()}_PATH`] = executablePath;
    paths[`TALLY_${brand.toUpperCase()}_${age.toUpperCase()}_VERSION`] = browserVersion(executablePath);
  }
}
const previousEngines = path.join(os.homedir(), ".cache", "ms-playwright-previous");
paths.TALLY_PREVIOUS_FIREFOX_PATH = executable(previousEngines, ["firefox"]);
paths.TALLY_PREVIOUS_SAFARI_PATH = executable(previousEngines, ["MiniBrowser", "minibrowser", "WebKit"]);
if (!paths.TALLY_PREVIOUS_FIREFOX_PATH || !paths.TALLY_PREVIOUS_SAFARI_PATH) throw new Error("Previous Firefox and WebKit browser evidence was not provisioned.");
if (major(paths.TALLY_CHROME_CURRENT_VERSION) - major(paths.TALLY_CHROME_PREVIOUS_VERSION) !== 1 || major(paths.TALLY_EDGE_CURRENT_VERSION) - major(paths.TALLY_EDGE_PREVIOUS_VERSION) !== 1) throw new Error("Current and previous branded browser majors are not adjacent.");
await mkdir(path.dirname(path.join(ROOT, ".temp", "browser-matrix.json")), { recursive: true });
await writeFile(path.join(ROOT, ".temp", "browser-matrix.json"), JSON.stringify(paths, null, 2));
emit(paths);
