import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPublicPage, renderScanMarkdown, scanRepository, scanUrl } from '../scripts/scanner.mjs';
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
  assert.equal(document.assessment.score_basis, 'evidence_collection_coverage');
  assert.equal(document.assessment.score, 50);
  assert.equal(document.assessment.readiness_score, 40);
  assert.equal(document.assessment.readiness_basis, 'open_review_work');
  assert.equal(document.assessment.readiness_penalties.finding_rules, 5);
  assert.deepEqual(document.assessment.incomplete_scopes, ['nextjs_framework']);
  assert.deepEqual(document.assessment.unscanned_optional_scopes, ['public_website']);
  assert.equal(document.assessment.status, 'human_review_required');
  assert.ok(document.findings.some(({ jurisdiction, rule_id }) => jurisdiction === 'EU' && rule_id.includes('gdpr.territorial-scope')));
  assert.ok(document.findings.length >= 2);
  const tracking = document.findings.find((finding) => finding.rule_id.endsWith('tracking.indicator'));
  assert.deepEqual(tracking.evidence.map(({ source_reference }) => source_reference.line_start), [1, 1]);
  const cookieStorage = document.findings.find(({ rule_id }) => rule_id.endsWith('cookie-storage.indicator'));
  assert.deepEqual(cookieStorage.evidence.map(({ source_reference }) => source_reference.line_start), [2]);
  for (const finding of document.findings) {
    assert.match(finding.rule_id, /^openlegal\./);
    assert.ok(['MA', 'EU'].includes(finding.jurisdiction));
    assert.equal(finding.review_status.human_review, 'pending');
    assert.ok(finding.suggested_actions.length > 0);
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
  assert.match(renderScanMarkdown(french.document, french.messages), /Analyse de confidentialité/);
  assert.equal(arabic.document.assessment.readiness_score, 70);
  assert.match(renderScanMarkdown(arabic.document, arabic.messages), /الاستعداد للمراجعة التقنية: 70\/100/);
  assert.match(renderScanMarkdown(arabic.document, arabic.messages), /تغطية جمع الأدلة: 50%/);
  assert.match(renderScanMarkdown(arabic.document, arabic.messages), /الخطوات التالية المقترحة/);
});

test('scanner detects Next.js from a local package manifest', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = true;');
  const { document } = await scanRepository(root);
  assert.equal(document.assessment.framework, 'Next.js');
  assert.equal(document.assessment.score, 100);
  assert.equal(document.assessment.readiness_score, 80);
  assert.deepEqual(await validateFindings(document), []);
});

test('combined Next.js and public-site scan returns one contract with both scopes represented', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  await writeFile(join(root, 'src', 'app.ts'), 'export const app = true;');
  const requestImpl = async (url) => ({
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: url.pathname === '/'
      ? '<html><a href="/privacy">Privacy</a><script src="https://www.google-analytics.com/a.js"></script></html>'
      : '<html><h1>Privacy Policy</h1></html>',
  });
  const { document, messages } = await scanRepository(root, { language: 'en', url: 'https://example.test/', requestImpl });
  assert.equal(document.assessment.score, 100);
  assert.equal(document.assessment.readiness_score, 60);
  assert.equal(document.assessment.readiness_penalties.finding_rules, 4, 'the local and website notice evidence shares one distinct rule penalty');
  assert.deepEqual(document.assessment.completed_scopes, ['repository', 'nextjs_framework', 'public_website']);
  assert.deepEqual(await validateFindings(document), []);
  assert.match(renderScanMarkdown(document, messages), /example\.test\/privacy/);
});

test('public URL scan fetches only same-origin HTML pages and returns sanitized evidence', async (t) => {
  const requested = [];
  const htmlByPath = {
    '/': '<html><a href="/privacy-policy">Privacy</a><a href="/_next/static/chunks/parse-cookie.js">chunk</a><a href="https://example.net/privacy">off origin</a><script src="https://www.google-analytics.com/g.js"></script></html>',
    '/privacy-policy': '<html><h1>Privacy Policy</h1><script>document.cookie = "not returned";</script></html>',
  };
  const requestImpl = async (url) => {
    requested.push(url.pathname);
    return { status: 200, headers: { 'content-type': 'text/html' }, body: htmlByPath[url.pathname] };
  };
  const result = await scanUrl('https://example.test/', { language: 'en', requestImpl });
  assert.equal(result.pages.length, 2);
  assert.deepEqual(requested, ['/', '/privacy-policy']);
  assert.ok(result.findings.some(({ rule_id }) => rule_id.endsWith('notice.presence')));
  assert.ok(result.findings.some(({ rule_id }) => rule_id.endsWith('tracking.indicator')));
  assert.ok(result.findings.some(({ rule_id }) => rule_id.endsWith('cookie-storage.indicator')));
  assert.ok(result.findings.some(({ rule_id }) => rule_id.endsWith('integration.indicator')));
  assert.ok(!JSON.stringify(result).includes('not returned'));
  assert.ok(result.limitations.some((item) => item.includes('did not execute JavaScript')));
  assert.deepEqual(result.inaccessible_pages, []);
});

test('public URL scan inspects the exact /privacy route and ignores cookie-named JavaScript assets', async () => {
  const requested = [];
  const requestImpl = async (url) => {
    requested.push(url.pathname);
    const body = url.pathname === '/'
      ? '<html><a href="/privacy">Privacy</a><a href="/_next/static/chunks/parse-cookie.js">chunk</a></html>'
      : '<html><h1>Privacy Policy</h1></html>';
    return { status: 200, headers: { 'content-type': 'text/html' }, body };
  };
  const result = await scanUrl('https://example.test/', { language: 'en', requestImpl });
  assert.deepEqual(requested, ['/', '/privacy']);
  assert.deepEqual(result.pages, ['https://example.test/', 'https://example.test/privacy']);
  assert.deepEqual(result.inaccessible_pages, []);
  assert.ok(result.findings.some(({ rule_id }) => rule_id.endsWith('notice.presence') && JSON.stringify(result).includes('example.test/privacy')));
});

test('cookie storage by itself is not classified as tracking', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
  await writeFile(join(root, 'src', 'app.ts'), 'document.cookie = "sidebar=open; path=/";');
  const { document } = await scanRepository(root);
  assert.ok(document.findings.some(({ rule_id }) => rule_id.endsWith('cookie-storage.indicator')));
  assert.ok(!document.findings.some(({ rule_id }) => rule_id.endsWith('tracking.indicator')));
});

test('unreachable privacy page report includes a sanitized path and reason', async () => {
  const htmlByPath = {
    '/': '<html><a href="/privacy">Privacy</a><a href="/_next/static/chunks/parse-cookie.js">chunk</a></html>',
  };
  const requestImpl = async (url) => ({
    status: url.pathname === '/' ? 200 : 404,
    headers: { 'content-type': 'text/html' },
    body: htmlByPath[url.pathname] ?? '<html>not found</html>',
  });
  const result = await scanUrl('https://example.test/', { language: 'en', requestImpl });
  assert.deepEqual(result.inaccessible_pages, [{ path: '/privacy', reason: 'Page returned HTTP 404' }]);
  assert.ok(result.limitations.some((item) => item.includes('/privacy: Page returned HTTP 404')));
});

test('critical findings stay prominent in the report regardless of readiness score', async (t) => {
  const root = await fixture(t);
  const { document, messages } = await scanRepository(root, { language: 'en' });
  const critical = structuredClone(document);
  critical.findings.push({ ...critical.findings[0], finding_id: 'scan-critical-example', rule_id: 'openlegal.example.critical', priority: 'critical', description: 'Synthetic critical finding.' });
  const report = renderScanMarkdown(critical, messages);
  assert.ok(report.indexOf('Critical findings requiring attention') < report.indexOf('## Findings'));
  assert.ok(report.indexOf('CRITICAL — openlegal.example.critical') < report.indexOf('### openlegal.privacy.notice.presence'));
});

test('public URL scan rejects private destinations and cross-origin redirects before another request', async () => {
  let requests = 0;
  await assert.rejects(scanUrl('https://127.0.0.1/', { language: 'en', requestImpl: async () => { requests += 1; } }), /private or reserved/);
  assert.equal(requests, 0);
  await assert.rejects(fetchPublicPage('https://example.test/', {
    requestImpl: async () => ({ status: 302, headers: { location: 'https://other.example/' }, body: '' }),
  }), /Cross-origin redirects/);
});
