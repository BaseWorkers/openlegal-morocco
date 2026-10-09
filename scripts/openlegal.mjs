#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, loadTemplateContent, recordedReview, draftDisclaimer } from './catalog.mjs';
import { validateTemplatePackages } from './validate-template-packages.mjs';
import { renderFindingsMarkdown, validateFindings } from './findings.mjs';
import { renderScanMarkdown, scanRepository } from './scanner.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Usage:
  openlegal --help
  openlegal --version
  openlegal list [--category CATEGORY] [--language en|fr|ar]
  openlegal show TEMPLATE_ID [--language en|fr|ar]
  openlegal sources TEMPLATE_ID
  openlegal status TEMPLATE_ID
  openlegal export TEMPLATE_ID [--language en|fr|ar] [--format md|json]
  openlegal check
  openlegal scan [path] [--format json|md] [--language en|fr|ar]
  openlegal findings validate <file|->
  openlegal findings render <file|-> [--format json|md]
  openlegal changes compare SOURCE_ID --previous-sha SHA256 --current FILE [--retrieved-at ISO_TIMESTAMP]

Run openlegal --help to show this message.`;
const findingsUsage = `Usage:\n  node scripts/openlegal.mjs findings validate <file|->\n  node scripts/openlegal.mjs findings render <file|-> [--format json|md]`;
const changesUsage = `Usage:\n  node scripts/openlegal.mjs changes compare SOURCE_ID --previous-sha SHA256 --current FILE [--retrieved-at ISO_TIMESTAMP]`;

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
  if (command === '--help' || command === '-h' || command === 'help') {
    if (rest.length) throw new Error('help accepts no arguments');
    process.stdout.write(`${usage}\n`);
    return;
  }
  if (command === '--version' || command === 'version') {
    if (rest.length) throw new Error('version accepts no arguments');
    const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    process.stdout.write(`OpenLegal ${version}\n`);
    return;
  }
  if (command === 'findings') {
    const [action, inputPath, ...optionsTokens] = rest;
    if (!['validate', 'render'].includes(action) || !inputPath || inputPath.startsWith('--')) throw new Error(findingsUsage);
    const options = parseOptions(optionsTokens);
    if (Object.keys(options).some((key) => key !== 'format')) throw new Error(findingsUsage);
    if (action === 'validate' && options.format) throw new Error(findingsUsage);
    const input = inputPath === '-' ? await new Promise((resolveInput, reject) => {
      let data = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolveInput(data)); process.stdin.on('error', reject);
    }) : await readFile(resolve(inputPath), 'utf8');
    let document;
    try { document = JSON.parse(input); } catch { throw new Error('Findings input must be valid JSON'); }
    const errors = await validateFindings(document);
    if (errors.length) throw new Error(`Findings schema validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    if (action === 'validate') process.stdout.write(`${JSON.stringify({ valid: true, schema_version: document.schema_version }, null, 2)}\n`);
    else if ((options.format || 'json') === 'md') process.stdout.write(renderFindingsMarkdown(document));
    else if ((options.format || 'json') === 'json') process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
    else throw new Error('Findings format must be json or md');
    return;
  }
  if (command === 'scan') {
    let path = '.';
    let pathSeen = false;
    const optionTokens = [];
    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token.startsWith('--')) optionTokens.push(token, rest[++index]);
      else if (!pathSeen) { path = token; pathSeen = true; }
      else throw new Error('scan accepts at most one repository path');
    }
    const options = parseOptions(optionTokens);
    if (Object.keys(options).some((key) => !['format', 'language'].includes(key))) throw new Error('scan accepts only --format and --language');
    const format = options.format || 'md';
    if (!['md', 'json'].includes(format)) throw new Error('Scan format must be json or md');
    const { document, messages } = await scanRepository(path, { language: options.language || 'en' });
    const errors = await validateFindings(document);
    if (errors.length) throw new Error(`Findings schema validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.stdout.write(format === 'json' ? `${JSON.stringify(document, null, 2)}\n` : `${renderScanMarkdown(document, messages)}\n`);
    return;
  }
  if (command === 'changes') {
    const { compareSourceChange } = await import('./change-tracker.mjs');
    const [action, sourceId, ...tokens] = rest;
    if (action !== 'compare' || !sourceId || sourceId.startsWith('--')) throw new Error(changesUsage);
    const options = {};
    for (let index = 0; index < tokens.length; index += 1) {
      const key = tokens[index];
      if (!['--previous-sha', '--current', '--retrieved-at'].includes(key) || !tokens[index + 1] || tokens[index + 1].startsWith('--') || options[key]) throw new Error(changesUsage);
      options[key] = tokens[++index];
    }
    if (!options['--previous-sha'] || !options['--current']) throw new Error(changesUsage);
    const currentPath = resolve(options['--current']);
    const fileInfo = await stat(currentPath);
    if (!fileInfo.isFile() || fileInfo.size > 50 * 1024 * 1024) throw new Error('Current source copy must be a regular file no larger than 50 MiB');
    const content = await readFile(currentPath);
    const record = await compareSourceChange({
      sourceId,
      previousSha256: options['--previous-sha'],
      currentBytes: content,
      retrievedAt: options['--retrieved-at'],
    });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    return;
  }
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
