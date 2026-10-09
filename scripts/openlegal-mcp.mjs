#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const child = spawn(executable, [resolve(root, 'mcp/server.py')], { stdio: 'inherit' });
child.on('error', (error) => {
  process.stderr.write(`OpenLegal MCP could not start Python (use PYTHON to set its path): ${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
