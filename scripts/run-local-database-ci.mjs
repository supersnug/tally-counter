#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const redact = (text) => text
  .replace(/(service_role|anon|access[_-]?key|password|token)["'=:\s]+[^\s,;}]+/gi, '$1=<REDACTED>')
  .replace(/eyJ[A-Za-z0-9._-]+/g, '<REDACTED>');
const run = (command, args) => new Promise((resolve) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true' } });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('close', (code, signal) => resolve({ command: [command, ...args].join(' '), code: code ?? 1, signal, output: redact(output) }));
});

await mkdir('artifacts', { recursive: true });
const steps = [
  await run('npx', ['supabase', 'start']),
  await run('npx', ['supabase', 'db', 'reset', '--local']),
  await run('npx', ['supabase', 'db', 'lint']),
  await run('npm', ['run', 'verify:local-db']),
];
const report = { harness: 'local-database-boundaries', redacted: true, steps, passed: steps.every((step) => step.code === 0) };
await writeFile('artifacts/local-database-boundaries.json', `${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
