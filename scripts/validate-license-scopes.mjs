import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'LICENSES/scopes.json'), 'utf8'));

assert.equal(manifest.schema_version, 1, 'unsupported license-scope manifest schema');
assert.equal(manifest.status, 'provisional', 'license scopes must remain provisional until human review');
assert.equal(typeof manifest.notice, 'string');
assert.ok(manifest.notice.length > 0);
assert.ok(Array.isArray(manifest.rules) && manifest.rules.length > 0);

const ids = new Set();
for (const rule of manifest.rules) {
  assert.equal(typeof rule.id, 'string');
  assert.ok(rule.id.length > 0);
  assert.ok(!ids.has(rule.id), `duplicate license-scope rule ID: ${rule.id}`);
  ids.add(rule.id);
  assert.ok(rule.spdx === null || rule.spdx === 'CC0-1.0' || rule.spdx === 'MIT', `${rule.id}: unsupported or missing SPDX identifier`);
  assert.ok(Array.isArray(rule.patterns) && rule.patterns.length > 0, `${rule.id}: no path patterns`);
  assert.equal(typeof rule.exceptions, 'string');
  for (const pattern of rule.patterns) {
    assert.equal(typeof pattern, 'string');
    assert.ok(pattern.length > 0 && !pattern.startsWith('/') && !pattern.includes('..'), `${rule.id}: unsafe path pattern ${pattern}`);
  }
}

function matches(pattern, path) {
  return pattern.endsWith('/**')
    ? path.startsWith(pattern.slice(0, -2))
    : path === pattern;
}

function specificity(pattern) {
  return pattern.endsWith('/**') ? pattern.length - 2 : 10000 + pattern.length;
}

export function selectLicenseScope(rules, path) {
  const matchesForPath = rules.flatMap((rule) => rule.patterns
    .filter((pattern) => matches(pattern, path))
    .map((pattern) => ({ rule, pattern, specificity: specificity(pattern) })));
  if (matchesForPath.length === 0) return null;
  const bestSpecificity = Math.max(...matchesForPath.map((match) => match.specificity));
  const best = matchesForPath.filter((match) => match.specificity === bestSpecificity);
  const scopeIds = new Set(best.map((match) => match.rule.id));
  assert.equal(scopeIds.size, 1, `${path}: equally specific license-scope rules conflict (${[...scopeIds].join(', ')})`);
  return best[0].rule;
}

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'graphify-out']);
async function collectPaths(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) paths.push(...await collectPaths(resolve(directory, entry.name), relativePath));
    } else if (!entry.isSymbolicLink() && entry.name !== '.DS_Store' && !entry.name.endsWith('.log')) {
      paths.push(relativePath);
    } else if (entry.isSymbolicLink()) {
      paths.push(relativePath);
    }
  }
  return paths;
}

const paths = (await collectPaths(root)).sort();
const uncovered = [];
const counts = new Map();

for (const path of paths) {
  const rule = selectLicenseScope(manifest.rules, path);
  if (!rule) {
    uncovered.push(path);
    continue;
  }
  counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
}

assert.deepEqual(uncovered, [], `unassigned repository paths: ${uncovered.join(', ')}`);
assert.equal(selectLicenseScope(manifest.rules, 'tests/fixtures/template-package/en.md')?.id, 'synthetic-template-fixture');
assert.equal(selectLicenseScope(manifest.rules, 'LICENSES/MIT.txt')?.spdx, null);
console.log(`License-scope map covers ${paths.length} repository paths (${[...counts].map(([id, count]) => `${id}: ${count}`).join(', ')}). Status: provisional; human ownership, source-rights, and license review remain required.`);
