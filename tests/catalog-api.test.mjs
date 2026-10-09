import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { buildStaticApi } from '../scripts/build-static-api.mjs';
import { loadCatalog, loadTemplateContent, recordedReview } from '../scripts/catalog.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL('../scripts/openlegal.mjs', import.meta.url));

test('shared catalogue exposes all packages and recorded draft status', async () => {
  const catalog = await loadCatalog(root);
  assert.equal(catalog.length, 14);
  assert.ok(catalog.every((item) => item.metadata.status === 'DRAFT'));
  assert.equal(recordedReview(catalog[0].metadata).verified, false);
});

test('static API generation is traceable and never asserts verification', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'olm-api-test-'));
  try {
    const result = await buildStaticApi({ outputDirectory, repositoryRef: 'test-revision' });
    assert.equal(result.templateCount, 14);
    const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
    const findingsSchema = JSON.parse(await readFile(join(outputDirectory, 'findings.schema.json'), 'utf8'));
    const controlTaxonomy = JSON.parse(await readFile(join(outputDirectory, 'control-taxonomy.json'), 'utf8'));
    const catalog = JSON.parse(await readFile(join(outputDirectory, 'templates.json'), 'utf8'));
    const template = JSON.parse(await readFile(join(outputDirectory, 'templates/privacy-policy.json'), 'utf8'));
    const sources = JSON.parse(await readFile(join(outputDirectory, 'templates/privacy-policy/sources.json'), 'utf8'));
    assert.equal(manifest.repository_ref, 'test-revision');
    assert.equal(manifest.verified, false);
    assert.equal(findingsSchema.$id, 'https://github.com/BaseWorkers/openlegal-morocco/schemas/findings/1.0.0');
    const currentSchema = JSON.parse(await readFile(join(outputDirectory, '..', 'v2', 'findings.schema.json'), 'utf8'));
    assert.equal(currentSchema.$id, 'https://github.com/BaseWorkers/openlegal-morocco/schemas/findings/2.0.0');
    assert.equal(controlTaxonomy.controls.length, 10);
    assert.equal(catalog.provenance.repository_ref, 'test-revision');
    assert.equal(template.review.status, 'DRAFT');
    assert.equal(template.review.verified, false);
    assert.ok(template.provenance.content_sha256.en);
    assert.ok(sources.data.sources.length);
    assert.match(template.disclaimer, /not legal advice/);

    const sourceRegistry = JSON.parse(await readFile(join(root, 'sources/registry.yaml'), 'utf8'));
    const sourceIds = new Set(sourceRegistry.sources.map(({ id }) => id));
    const templateIds = new Set();
    for (const packageInfo of await loadCatalog(root)) {
      assert.ok(!templateIds.has(packageInfo.id), `duplicate public API template id: ${packageInfo.id}`);
      templateIds.add(packageInfo.id);
      const record = JSON.parse(await readFile(join(outputDirectory, 'templates', `${packageInfo.id}.json`), 'utf8'));
      const sourceRecord = JSON.parse(await readFile(join(outputDirectory, 'templates', packageInfo.id, 'sources.json'), 'utf8'));
      assert.equal(record.provenance.repository_ref, 'test-revision');
      assert.equal(record.review.status, packageInfo.metadata.status);
      assert.deepEqual(record.data.metadata, packageInfo.metadata);
      assert.deepEqual(record.data.sources, packageInfo.sources);
      for (const language of packageInfo.metadata.languages) {
        const content = await loadTemplateContent(packageInfo, language);
        assert.equal(record.data.contents[language], content, `${packageInfo.id}/${language} API content must match the source package`);
        assert.equal(record.provenance.content_sha256[language], createHash('sha256').update(content).digest('hex'));
      }
      assert.deepEqual(sourceRecord.data.declarations, packageInfo.sources);
      assert.deepEqual(sourceRecord.data.sources.map(({ id }) => id), packageInfo.sources.source_ids);
      assert.ok(sourceRecord.data.sources.every(({ id }) => sourceIds.has(id)), `${packageInfo.id} API sources must resolve to the registry`);
      assert.equal(sourceRecord.provenance.repository_ref, 'test-revision');
    }
    assert.equal(templateIds.size, catalog.data.length);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('catalogue refuses symbolic-link metadata and sources', async (t) => {
  for (const filename of ['metadata.yaml', 'sources.yaml']) {
    await t.test(filename, async (tcase) => {
      const fixture = await mkdtemp(join(tmpdir(), 'olm-catalog-link-'));
      try {
        const packagePath = join(fixture, 'templates', 'privacy', 'privacy-policy');
        await mkdir(packagePath, { recursive: true });
        const metadata = { id: 'privacy-policy', languages: ['en'] };
        const source = { source_ids: [], source_uses: [] };
        const externalFile = join(fixture, 'outside.json');
        await writeFile(externalFile, JSON.stringify(filename === 'metadata.yaml' ? metadata : source));
        await writeFile(join(packagePath, filename === 'metadata.yaml' ? 'sources.yaml' : 'metadata.yaml'), JSON.stringify(filename === 'metadata.yaml' ? source : metadata));
        try {
          await symlink(externalFile, join(packagePath, filename));
        } catch (error) {
          if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return tcase.skip('symlink creation is unavailable');
          throw error;
        }
        await assert.rejects(loadCatalog(fixture), /Refusing non-regular package file/);
      } finally {
        await rm(fixture, { recursive: true, force: true });
      }
    });
  }
});

test('CLI exports drafts with a watermark and refuses to overwrite', async () => {
  const outputDirectory = join(root, 'dist', 'exports');
  const outputPath = join(outputDirectory, 'privacy-policy.en.md');
  await rm(outputPath, { force: true });
  try {
    await execFileAsync(process.execPath, [cli, 'export', 'privacy-policy', '--language', 'en', '--format', 'md'], { cwd: root });
    const output = await readFile(outputPath, 'utf8');
    assert.match(output, /^> DRAFT — NOT LEGALLY REVIEWED/m);
    assert.match(output, /Version: 0\.1\.3/);
    assert.match(output, /Repository ref:/);
    assert.match(output, /Sources: cndp-loi-09-08/);
    assert.match(output, /not legal advice or compliance certification/);
    await assert.rejects(execFileAsync(process.execPath, [cli, 'export', 'privacy-policy', '--language', 'en'], { cwd: root }));
  } finally {
    await rm(outputPath, { force: true });
  }
});
