import fs from "node:fs";

const config = fs.readFileSync("playwright.config.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/release-evidence.yml", "utf8");
const preparation = fs.readFileSync("scripts/prepare-browser-matrix.mjs", "utf8");
const fixtureExports = JSON.parse(fs.readFileSync("scripts/browser-matrix.fixture.json", "utf8"));
const metadataFixture = JSON.parse(fs.readFileSync("scripts/browser-matrix-metadata.fixture.json", "utf8"));
const projects = ["branded-chrome-current", "branded-edge-current", "branded-chrome-previous", "branded-edge-previous"];
const paths = ["TALLY_CHROME_CURRENT_PATH", "TALLY_EDGE_CURRENT_PATH", "TALLY_CHROME_PREVIOUS_PATH", "TALLY_EDGE_PREVIOUS_PATH"];
for (const project of projects) if (!config.includes(`name: \"${project}\"`) || !workflow.includes(`--project=${project}`)) throw new Error(`Missing branded project invocation: ${project}`);
for (const variable of paths) if (!config.includes(variable) || !preparation.includes(variable)) throw new Error(`Missing branded provisioning path: ${variable}`);
for (const value of ["last-known-good-versions-with-downloads.json", "known-good-versions-with-downloads.json", "packages.microsoft.com/repos/edge", "curl", "unzip", "dpkg-deb", "--metadata-only", "adjacent release majors"]) if (!preparation.includes(value)) throw new Error(`Missing deterministic provisioning evidence: ${value}`);
if (!/^ {4}steps:\n(?: {6}- .+\n)+/m.test(workflow) || /^ {7}- /m.test(workflow)) throw new Error("Release workflow has invalid step indentation.");
if (!workflow.includes("node scripts/prepare-browser-matrix.mjs") || !workflow.includes("npm run e2e")) throw new Error("Release workflow is missing executable preparation or E2E steps.");
const fixture = metadataFixture;
const select = (versions, current = null) => {
  const ordered = versions.filter((item) => item.version && item.url).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  const selectedCurrent = current || ordered[0];
  const previous = ordered.find((item) => Number(item.version.split(".")[0]) === Number(selectedCurrent.version.split(".")[0]) - 1);
  if (!selectedCurrent || !previous || selectedCurrent.version === previous.version) throw new Error("Fixture selection did not reject same/non-adjacent versions.");
  return { current: selectedCurrent, previous };
};
const chromeCurrent = { version: fixture.chromeStable.version, url: fixture.chromeStable.downloads.chrome.find((item) => item.platform === "linux64")?.url };
const chrome = select(fixture.chromeKnownGood.map((item) => ({ version: item.version, url: item.downloads.chrome.find((download) => download.platform === "linux64")?.url })), chromeCurrent);
if (!chrome.current.url || !chrome.previous.url) throw new Error("Fixture Chrome selection accepted an empty artifact.");
const edge = select(fixture.edgeStable.map((item) => ({ version: item.Version, url: item.Artifacts.find((artifact) => /\.(?:deb|zip)$/.test(artifact.Location))?.Location })));
if (!edge.current.url.endsWith(".deb") || !edge.previous.url.endsWith(".zip")) throw new Error("Fixture Edge selection did not exercise DEB and ZIP branches.");
for (const variable of [...paths, "TALLY_CHROME_CURRENT_VERSION", "TALLY_CHROME_PREVIOUS_VERSION", "TALLY_EDGE_CURRENT_VERSION", "TALLY_EDGE_PREVIOUS_VERSION"]) if (!fixtureExports[variable]) throw new Error(`Fixture is missing executable/version export: ${variable}`);
for (const brand of ["CHROME", "EDGE"]) {
  const current = fixtureExports[`TALLY_${brand}_CURRENT_VERSION`];
  const previous = fixtureExports[`TALLY_${brand}_PREVIOUS_VERSION`];
  if (Number(current.split(".")[0]) - Number(previous.split(".")[0]) !== 1) throw new Error(`${brand} fixture versions are not adjacent release majors.`);
}
if (process.env.CI) {
  for (const variable of [...paths, "TALLY_CHROME_CURRENT_VERSION", "TALLY_CHROME_PREVIOUS_VERSION", "TALLY_EDGE_CURRENT_VERSION", "TALLY_EDGE_PREVIOUS_VERSION"]) {
    if (!process.env[variable]) throw new Error(`Missing CI browser evidence: ${variable}`);
    if (variable.endsWith("PATH") && !fs.existsSync(process.env[variable])) throw new Error(`Missing CI browser executable: ${variable}`);
  }
}
console.log("Branded Chrome/Edge provisioning, adjacent-version fixture, project invocation, and CI evidence gate verified.");
