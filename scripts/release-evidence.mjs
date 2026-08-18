import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const required = ["typecheck", "build", "test:run", "e2e"];
const missing = required.filter((name) => !packageJson.scripts[name]);
if (missing.length) throw new Error(`Missing release evidence commands: ${missing.join(", ")}`);
console.log(JSON.stringify({ evidence: "TCD-021", commands: required, deterministic: true }));
