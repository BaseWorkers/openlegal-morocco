import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceFiles = [
  'scripts/export-template.mjs',
  'scripts/generator-runtime.mjs',
  'scripts/generator-core.mjs',
  'scripts/generator-policy.mjs',
  'scripts/docx-export.mjs',
  'scripts/markdown-renderer.mjs',
  'scripts/validate-template-packages.mjs',
  'scripts/schema-validator.mjs',
  'scripts/review-policy.mjs',
  'scripts/review-signatures.mjs',
  'scripts/template-package-utils.mjs',
  'scripts/translation-parity.mjs',
  'scripts/changelog-policy.mjs',
  'scripts/template-source-use-policy.mjs',
  'scripts/source-reuse-policy.mjs',
  'scripts/build-site.mjs',
  'scripts/catalog.mjs',
  'scripts/markdown-renderer.mjs'
];
const reviewedNodeModules = new Set([
  'node:assert/strict',
  'node:child_process',
  'node:crypto',
  'node:fs',
  'node:fs/promises',
  'node:os',
  'node:path',
  'node:url',
  'node:util'
]);
const forbiddenApis = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection|localStorage|sessionStorage|indexedDB|BroadcastChannel|navigator\.sendBeacon|navigator\.serviceWorker|document\.cookie)\b|\b(?:eval|Function)\s*\(|\bprocess\.binding\s*\(/;
const scannedFiles = new Set(sourceFiles);
const importPattern = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;
const writeApis = /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|writev|writevSync|mkdir|mkdirSync|mkdtemp|mkdtempSync|rename|renameSync|unlink|unlinkSync|rm|rmSync|copyFile|copyFileSync|open|openSync)\s*\(/;

for (const path of sourceFiles) {
  const absolutePath = join(root, path);
  const source = await readFile(absolutePath, 'utf8');
  assert.doesNotMatch(source, forbiddenApis, `${path} must not send generator inputs over a network or persist them in browser storage`);
  assert.doesNotMatch(source, /\bimport\s*\(|\brequire\s*\(|\bcreateRequire\b/, `${path} must use statically reviewable imports`);

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier.startsWith('.')) {
      const importedPath = relative(root, resolve(dirname(absolutePath), specifier)).split(/[\\/]/).join('/');
      assert.ok(scannedFiles.has(importedPath), `${path} imports ${importedPath}, which is missing from the privacy audit coverage`);
    } else {
      assert.ok(reviewedNodeModules.has(specifier), `${path} imports unreviewed external module ${specifier}`);
    }
  }

  if (!['scripts/export-template.mjs', 'scripts/build-site.mjs'].includes(path)) {
    assert.doesNotMatch(source, writeApis, `${path} must not write or persist generator values`);
  }
}

const exporter = await readFile(join(root, 'scripts/export-template.mjs'), 'utf8');
assert.match(exporter, /for await \(const chunk of process\.stdin\)/, 'generator values must be read from standard input');
assert.match(exporter, /MAX_INPUT_BYTES\s*=\s*1024\s*\*\s*1024/, 'generator JSON input must have a 1 MiB size limit');
assert.match(exporter, /totalBytes\s*>\s*MAX_INPUT_BYTES/, 'oversized input must be rejected before buffering');
assert.match(exporter, /new TextDecoder\('utf-8', \{ fatal: true \}\)\.decode\(Buffer\.concat\(chunks\)\)/, 'generator JSON input must reject malformed UTF-8');
assert.match(exporter, /writeFile\(path, contents, \{ flag: 'wx' \}\)/, 'exports must not overwrite existing files');
assert.match(exporter, /copyFile\(pdfPath, outputPath, fsConstants\.COPYFILE_EXCL\)/, 'PDF exports must not overwrite existing files');
assert.match(exporter, /mkdtemp\(join\(tmpdir\(\), 'olm-export-'\)\)/, 'PDF conversion must use a temporary directory');
assert.match(exporter, /finally\s*\{\s*await rm\(temporaryDirectory, \{ recursive: true, force: true \}\)/, 'temporary conversion files must be removed');
assert.match(exporter, /`-env:UserInstallation=\$\{officeProfile\}`/, 'LibreOffice must use a temporary profile');
assert.doesNotMatch(exporter, /shell:\s*true/, 'PDF conversion must not invoke a shell');

const siteBuilder = await readFile(join(root, 'scripts/build-site.mjs'), 'utf8');
assert.match(siteBuilder, /outputDirectory = resolve\(root, 'dist\/site'\)/, 'static site output must default to ignored local build artifacts');
assert.match(siteBuilder, /writeFile\(resolve\(outputDirectory, 'robots\.txt'\)/, 'site metadata must be written inside the configured output directory');
assert.match(siteBuilder, /copyFile\(resolve\(root, 'site\/assets\/site\.css'\), resolve\(outputDirectory, 'assets\/site\.css'\)/, 'only repository-owned static assets may be copied to site output');
assert.doesNotMatch(siteBuilder, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|document\.cookie)\b/, 'site generation and local search must not send or persist user search data');

console.log(`Generator privacy audit passed: ${sourceFiles.length} exporter, validator, and static-site modules are covered; imports are local or allowlisted Node built-ins; static builds write local repository-derived artifacts only; no network/browser-storage APIs; stdin JSON is capped at 1 MiB and malformed UTF-8 is rejected; PDF conversion uses and removes isolated temporary files.`);
