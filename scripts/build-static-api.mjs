import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog, loadTemplateContent, recordedReview, draftDisclaimer } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function buildStaticApi({ outputDirectory = resolve(root, 'dist/api/v1'), versionedSchemaDirectory, repositoryRef = process.env.GITHUB_SHA || 'working-tree' } = {}) {
  versionedSchemaDirectory ??= resolve(dirname(outputDirectory), 'v2');
  const catalog = await loadCatalog(root);
  const registry = JSON.parse(await readFile(resolve(root, 'sources/registry.yaml'), 'utf8'));
  const registryById = new Map(registry.sources.map((source) => [source.id, source]));
  const manifest = {
    api_version: 'v1',
    repository_ref: repositoryRef,
    templates: catalog.map(({ id, metadata }) => ({ id, version: metadata.version, status: metadata.status, languages: metadata.languages })),
    verified: false,
    disclaimer: draftDisclaimer,
  };
  const index = await Promise.all(catalog.map(async (template) => ({
    id: template.id,
    category: template.category,
    title: template.metadata.title,
    languages: template.metadata.languages,
    version: template.metadata.version,
    review: recordedReview(template.metadata),
    template_sha256: Object.fromEntries(await Promise.all(template.metadata.languages.map(async (language) => [language, sha256(await loadTemplateContent(template, language))]))),
  })));
  await writeJson(resolve(outputDirectory, 'manifest.json'), manifest);
  await writeJson(resolve(outputDirectory, 'findings.schema.json'), JSON.parse(await readFile(resolve(root, 'schemas/findings-v1.schema.json'), 'utf8')));
  await writeJson(resolve(outputDirectory, 'control-taxonomy.json'), JSON.parse(await readFile(resolve(root, 'schemas/control-taxonomy.json'), 'utf8')));
  await writeJson(resolve(versionedSchemaDirectory, 'findings.schema.json'), JSON.parse(await readFile(resolve(root, 'schemas/findings.schema.json'), 'utf8')));
  await writeJson(resolve(versionedSchemaDirectory, 'control-taxonomy.json'), JSON.parse(await readFile(resolve(root, 'schemas/control-taxonomy.json'), 'utf8')));
  await writeJson(resolve(outputDirectory, 'templates.json'), { data: index, provenance: { repository_ref: repositoryRef }, disclaimer: draftDisclaimer });

  for (const template of catalog) {
    const contents = Object.fromEntries(await Promise.all(template.metadata.languages.map(async (language) => [language, await loadTemplateContent(template, language)])));
    const record = {
      data: { metadata: template.metadata, sources: template.sources, contents },
      provenance: {
        repository_ref: repositoryRef,
        content_sha256: Object.fromEntries(Object.entries(contents).map(([language, content]) => [language, sha256(content)])),
      },
      review: recordedReview(template.metadata),
      disclaimer: draftDisclaimer,
    };
    await writeJson(resolve(outputDirectory, 'templates', `${template.id}.json`), record);
    const sourceRecords = template.sources.source_ids.map((sourceId) => registryById.get(sourceId) ?? { id: sourceId, unavailable: true });
    await writeJson(resolve(outputDirectory, 'templates', template.id, 'sources.json'), {
      data: { template_id: template.id, declarations: template.sources, sources: sourceRecords },
      provenance: { repository_ref: repositoryRef },
      review: recordedReview(template.metadata),
      disclaimer: draftDisclaimer,
    });
  }
  return { templateCount: catalog.length, outputDirectory, repositoryRef };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await buildStaticApi();
    process.stdout.write(`Generated ${result.templateCount} template API records at ${result.outputDirectory} for ${result.repositoryRef}.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
