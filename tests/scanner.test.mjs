import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderScanMarkdown, scanRepository } from '../scripts/scanner.mjs';
import { validateFindings } from '../scripts/findings.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'openlegal-scan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { 'posthog-js': '^1.0.0' } }));
  await writeFile(join(root, 'src', 'app.ts'), "import posthog from 'posthog-js';\ndocument.cookie = 'x=y';\n// gtag('config', 'example');\n");
  return root;
}

test('scanner emits v2 findings with rule identifiers, Morocco jurisdiction, and no source excerpts', async (t) => {
  const root = await fixture(t);
  const { document } = await scanRepository(root);
  assert.equal(document.schema_version, '2.0.0');
  assert.deepEqual(await validateFindings(document), []);
  assert.ok(document.findings.length >= 2);
  const tracking = document.findings.find((finding) => finding.rule_id.endsWith('tracking.indicator'));
  assert.deepEqual(tracking.evidence.map(({ source_reference }) => source_reference.line_start), [1, 1, 2]);
  for (const finding of document.findings) {
    assert.match(finding.rule_id, /^openlegal\./);
    assert.equal(finding.jurisdiction, 'MA');
    assert.equal(finding.review_status.human_review, 'pending');
    assert.ok(!JSON.stringify(finding).includes('document.cookie'));
  }
});

test('scanner skips secrets, dependencies, build output, lockfiles, and symbolic links', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = true;');
  await mkdir(join(root, 'node_modules', 'bad-package'), { recursive: true });
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, '.env'), 'document.cookie = secret');
  await writeFile(join(root, 'package-lock.json'), '"posthog-js"');
  await writeFile(join(root, 'node_modules', 'bad-package', 'index.js'), 'document.cookie');
  await writeFile(join(root, 'dist', 'output.js'), 'document.cookie');
  await symlink(join(root, 'src', 'app.ts'), join(root, 'linked.ts'));
  const { document, scannedFiles } = await scanRepository(root);
  assert.equal(scannedFiles, 2);
  assert.ok(!document.findings.some((item) => item.rule_id.endsWith('tracking.indicator')));
  assert.ok(document.findings.every((item) => item.evidence.every((evidence) => !['.env', 'linked.ts'].includes(evidence.source_reference.path))));
});

test('notice paths are detected while unrelated documentation examples are not tracking findings', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = true;');
  await writeFile(join(root, 'privacy-policy.md'), '# Privacy Policy\nThis page describes our practices.');
  await writeFile(join(root, 'README.md'), 'Example code: document.cookie = "x";');
  const { document } = await scanRepository(root, { language: 'fr' });
  const notice = document.findings.find((item) => item.rule_id.endsWith('notice.presence'));
  assert.match(notice.description, /confidentialité/);
  assert.ok(!document.findings.some((item) => item.rule_id.endsWith('tracking.indicator')));
});

test('scanner emits the same Findings contract across languages and renders localized Markdown', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = true;');
  const arabic = await scanRepository(root, { language: 'ar' });
  const french = await scanRepository(root, { language: 'fr' });
  assert.deepEqual(arabic.document.findings.map(({ rule_id }) => rule_id), french.document.findings.map(({ rule_id }) => rule_id));
  assert.match(arabic.document.findings[0].description, /لم يُعثر/);
  assert.match(renderScanMarkdown(arabic.document, arabic.messages), /الاختصاص/);
  assert.match(renderScanMarkdown(french.document, french.messages), /Analyse locale/);
});
