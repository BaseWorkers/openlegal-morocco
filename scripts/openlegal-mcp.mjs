#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const server = spawn(python, [resolve(root, 'mcp/server.py')], { stdio: 'inherit' });

server.on('error', (error) => {
  process.stderr.write(`OpenLegal MCP could not start ${python}: ${error.message}\n`);
  process.exitCode = 1;
});
server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
