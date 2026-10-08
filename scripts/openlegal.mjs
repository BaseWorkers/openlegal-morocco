#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, loadTemplateContent, recordedReview, draftDisclaimer } from './catalog.mjs';
import { validateTemplatePackages } from './validate-template-packages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Usage:
  node scripts/openlegal.mjs list [--category CATEGORY] [--language en|fr|ar]
  node scripts/openlegal.mjs show TEMPLATE_ID [--language en|fr|ar]
  node scripts/openlegal.mjs sources TEMPLATE_ID
  node scripts/openlegal.mjs status TEMPLATE_ID
  node scripts/openlegal.mjs export TEMPLATE_ID [--language en|fr|ar] [--format md|json]
  node scripts/openlegal.mjs check`;

function parseOptions(tokens) {
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const key = tokens[index];
    if (!['--category', '--language', '--format'].includes(key) || !tokens[index + 1] || tokens[index + 1].startsWith('--')) {
      throw new Error(`Invalid option: ${key}`);
    }
    if (options[key.slice(2)]) throw new Error(`Duplicate option: ${key}`);
    options[key.slice(2)] = tokens[index + 1];
    index += 1;
  }
  if (options.language && !['en', 'fr', 'ar'].includes(options.language)) throw new Error('Language must be en, fr, or ar');
  return options;
}

function findTemplate(catalog, id) {
  const template = catalog.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template ID: ${id}`);
  return template;
}

async function main(args) {
  const [command, ...rest] = args;
  if (!command) throw new Error(usage);
  if (command === 'check') {
    if (rest.length) throw new Error(usage);
    const count = await validateTemplatePackages();
    process.stdout.write(`${JSON.stringify({ data: { valid: true, template_packages: count }, disclaimer: draftDisclaimer }, null, 2)}\n`);
    return;
  }
  if (!['list', 'show', 'sources', 'status', 'export'].includes(command)) throw new Error(usage);
  const id = command === 'list' ? null : rest.shift();
  if (command !== 'list' && (!id || id.startsWith('--'))) throw new Error(usage);
  const options = parseOptions(rest);
  if (command === 'sources' && Object.keys(options).length) throw new Error('sources accepts only a template ID');
  if (command === 'status' && Object.keys(options).length) throw new Error('status accepts only a template ID');
  if (command === 'list' && options.format) throw new Error('list does not accept --format');

  const catalog = await loadCatalog(root);
  if (command === 'list') {
    const items = catalog.filter((item) => (!options.category || item.metadata.category.includes(options.category))
      && (!options.language || item.metadata.languages.includes(options.language)))
      .map(({ id: templateId, metadata }) => ({
        id: templateId,
        title: metadata.title,
        categories: metadata.category,
        languages: metadata.languages,
        version: metadata.version,
        review: recordedReview(metadata),
      }));
    process.stdout.write(`${JSON.stringify({ data: items, disclaimer: draftDisclaimer }, null, 2)}\n`);
    return;
  }

  const template = findTemplate(catalog, id);
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify({ data: { id, version: template.metadata.version, review: recordedReview(template.metadata) }, disclaimer: draftDisclaimer }, null, 2)}\n`);
    return;
  }
  if (command === 'sources') {
    process.stdout.write(`${JSON.stringify({ data: { id, version: template.metadata.version, sources: template.sources }, disclaimer: draftDisclaimer }, null, 2)}\n`);
    return;
  }
  const language = options.language || 'en';
  const content = await loadTemplateContent(template, language);
  const digest = createHash('sha256').update(content).digest('hex');
  const repositoryRef = process.env.GITHUB_SHA || 'working-tree';
  if (command === 'show') {
    process.stdout.write(`${JSON.stringify({
      data: { id, language, version: template.metadata.version, review: recordedReview(template.metadata), sha256: digest, content },
      disclaimer: draftDisclaimer,
    }, null, 2)}\n`);
    return;
  }
  const format = options.format || 'md';
  if (!['md', 'json'].includes(format)) throw new Error('Export format must be md or json');
  const header = `> DRAFT — NOT LEGALLY REVIEWED\n> Template: ${id} · Version: ${template.metadata.version} · Language: ${language}\n> Repository ref: ${repositoryRef}\n> Sources: ${template.sources.source_ids.join(', ') || 'none declared'}\n> SHA-256: ${digest}\n> ${draftDisclaimer}\n\n`;
  const output = format === 'md' ? `${header}${content}` : `${JSON.stringify({
    template_id: id,
    version: template.metadata.version,
    language,
    repository_ref: repositoryRef,
    sources: template.sources,
    sha256: digest,
    review: recordedReview(template.metadata),
    content,
    disclaimer: draftDisclaimer,
  }, null, 2)}\n`;
  const outputPath = resolve(root, 'dist', 'exports', `${id}.${language}.${format}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ data: { path: outputPath, sha256: createHash('sha256').update(output).digest('hex') }, disclaimer: draftDisclaimer }, null, 2)}\n`);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n${error.message === usage ? '' : `\n${usage}\n`}`);
  process.exitCode = 1;
}
