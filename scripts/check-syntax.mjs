import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ['scripts', 'tests'];
const extensions = new Set(['.js', '.mjs', '.cjs']);

async function findJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(entryPath);
    if (!entry.isFile()) return [];
    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    return extensions.has(extension) ? [entryPath] : [];
  }));
  return nested.flat();
}

const files = (await Promise.all(
  sourceRoots.map((root) => findJavaScriptFiles(join(repositoryRoot, root)))
)).flat().sort();

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status === 0) continue;
  failed = true;
  process.stderr.write(relative(repositoryRoot, file) + '\n');
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if (failed) process.exitCode = 1;
else process.stdout.write('Syntax verified for ' + files.length + ' JavaScript files.\n');
