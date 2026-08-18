import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const license = readFileSync("LICENSE", "utf8");
const readme = readFileSync("README.md", "utf8");
const licenseHash = createHash("sha256").update(license).digest("hex");

const SOURCE_ROOTS = ["src", "scripts", "e2e", "supabase/functions", "supabase/migrations"];
const ROOT_SOURCE_FILES = ["generate-sitemap.js", "vite.config.js", "playwright.config.ts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".sql"]);
const sourceFiles = [];
function collect(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) collect(path);
    else if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) sourceFiles.push(path);
  }
}
for (const directory of SOURCE_ROOTS) collect(directory);
sourceFiles.push(...ROOT_SOURCE_FILES);

if (packageJson.license !== "AGPL-3.0-only" || lockfile.packages[""].license !== "AGPL-3.0-only") {
  throw new Error("Package metadata must declare AGPL-3.0-only.");
}
if (licenseHash !== "0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0") {
  throw new Error("LICENSE is not the complete canonical GNU AGPL version 3 text.");
}
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const firstCode = text.startsWith("#!") ? text.indexOf("\n") + 1 : 0;
  const headerStart = text.indexOf("/*\n * This file is part of Tally.", firstCode);
  const validHeader = file.endsWith(".sql")
    ? text.startsWith("-- This file is part of Tally.\n--\n-- Copyright (C) 2026 Tally contributors")
    : headerStart >= firstCode && headerStart <= firstCode + 300;
  if (!validHeader) {
    throw new Error(`Missing AGPL source notice: ${relative(".", file)}`);
  }
  const notice = text.slice(validHeader ? (file.endsWith(".sql") ? 0 : headerStart) : 0, 1200);
  for (const required of [
    "This file is part of Tally.",
    "Tally is free software: you can redistribute it and/or modify",
    "published by the Free Software Foundation, version 3 of the",
    "along with Tally.",
  ]) {
    if (!notice.includes(required)) throw new Error(`Incomplete Tally notice: ${relative(".", file)}`);
  }
  if (notice.includes("This program") || notice.includes("or any later version")) {
    throw new Error(`Outdated source notice: ${relative(".", file)}`);
  }
}
if (!readme.includes("GNU Affero General Public License, version 3 only (AGPL-3.0-only)")) {
  throw new Error("README license claim is inconsistent.");
}
console.log(`AGPL-3.0-only identity, canonical root text, metadata, README claim, and ${sourceFiles.length} source headers verified.`);
