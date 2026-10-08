import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { validateJsonSchemaValue } from './schema-validator.mjs';
import { digestReviewableContent, resolveReviewSourceRecords, validateTemplateReviewPolicy } from './review-policy.mjs';
import { findTemplateVariables, hasUnmatchedTemplateBraces, reviewableMetadata } from './template-package-utils.mjs';
import { validateGeneratorVariablePolicy } from './generator-policy.mjs';
import { compareTranslationStructure } from './translation-parity.mjs';
import { validateTemplateChangelog } from './changelog-policy.mjs';
import { validateTemplateLawCitationPolicy, validateTemplateNoteClaimPolicy, validateTemplateSourceClaimPolicy, validateTemplateSourceUsePolicy } from './template-source-use-policy.mjs';
import { validateReuseRevisionPolicy } from './source-reuse-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const templateSchema = await readJson('schemas/template.schema.json');
const variablesSchema = await readJson('schemas/variables.schema.json');
const templateSourcesSchema = await readJson('schemas/template-sources.schema.json');
const sourceRegistry = await readJson('sources/registry.yaml');
const claimRegistry = (await readJson('research/morocco/claims.json')).claims;
const authorizedReviewers = (await readJson('reviews/authorized-reviewers.yaml')).authorized_legal_reviewers;
const authorizedLanguageReviewers = (await readJson('reviews/authorized-reviewers.yaml')).authorized_language_reviewers;
const reviewRecords = (await readJson('reviews/records.json')).reviews;

async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relative(root, fullPath)} must not be a symbolic link`);
    if (entry.isDirectory()) results.push(...await walk(fullPath));
    else if (!entry.isFile()) throw new Error(`${relative(root, fullPath)} must be a regular file or directory`);
    else if (entry.name === 'metadata.yaml') results.push(fullPath);
  }
  return results;
}

function sectionIds(markdown) {
  return [...markdown.matchAll(/^<!-- section: ([a-z0-9-]+) -->$/gm)].map((match) => match[1]);
}

export async function validateTemplatePackages(templatesRoot = join(root, 'templates'), registry = sourceRegistry) {
  const templatesRootInfo = await lstat(templatesRoot);
  assert.ok(templatesRootInfo.isDirectory(), `${relative(root, templatesRoot)} must be a real directory`);
  const reuseRevisionErrors = registry.sources.flatMap((source) => validateReuseRevisionPolicy(source).map((error) => `${source.id}: ${error}`));
  assert.deepEqual(reuseRevisionErrors, [], 'source registry reuse revisions invalid');
  const sourceIds = new Set(registry.sources.map((source) => source.id));
  const templateMetadataFiles = await walk(templatesRoot);
  const templateIds = new Set();
  for (const metadataFile of templateMetadataFiles) {
    const packageDir = metadataFile.slice(0, -'/metadata.yaml'.length);
    const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
    const relativePackage = relative(root, packageDir);
    const metadataErrors = validateJsonSchemaValue(metadata, templateSchema);
    assert.deepEqual(metadataErrors, [], `${relativePackage}/metadata.yaml invalid: ${metadataErrors.join('; ')}`);
    assert.deepEqual(Object.keys(metadata.title).sort(), [...metadata.languages].sort(), `${relativePackage}/metadata.yaml title translations must match declared languages`);
    assert.deepEqual(Object.keys(metadata.language_review).sort(), [...metadata.languages].sort(), `${relativePackage}/metadata.yaml language review states must match declared languages`);
    assert.deepEqual(Object.keys(metadata.language_review_records ?? {}).sort(), [...metadata.languages].sort(), `${relativePackage}/metadata.yaml language review record IDs must match declared languages`);
    assert.ok(!templateIds.has(metadata.id), `duplicate template ID ${metadata.id}`);
    templateIds.add(metadata.id);

    const variablePath = join(packageDir, 'variables.schema.json');
    const sourcesPath = join(packageDir, 'sources.yaml');
    const variables = JSON.parse(await readFile(variablePath, 'utf8'));
    const sources = JSON.parse(await readFile(sourcesPath, 'utf8'));
    const variableErrors = validateJsonSchemaValue(variables, variablesSchema);
    assert.deepEqual(variableErrors, [], `${relativePackage}/variables.schema.json invalid: ${variableErrors.join('; ')}`);
    const generatorErrors = validateGeneratorVariablePolicy(variables.variables, { allowBlocked: !metadata.generator_enabled });
    assert.deepEqual(generatorErrors, [], `${relativePackage}/variables.schema.json generator input policy invalid: ${generatorErrors.join('; ')}`);
    if (metadata.generator_enabled) {
      assert.equal(metadata.status, 'RELEASED', `${metadata.id} cannot enable generation before RELEASED status`);
      assert.equal(metadata.legal_review.status, 'reviewed', `${metadata.id} cannot enable generation without legal review`);
      for (const language of metadata.languages) assert.equal(metadata.language_review[language], 'reviewed', `${metadata.id} cannot enable generation for unreviewed language ${language}`);
    }
    const templateSourceErrors = validateJsonSchemaValue(sources, templateSourcesSchema);
    assert.deepEqual(templateSourceErrors, [], `${relativePackage}/sources.yaml invalid: ${templateSourceErrors.join('; ')}`);
    for (const sourceId of sources.source_ids) assert.ok(sourceIds.has(sourceId), `${metadata.id} references unknown source ${sourceId}`);
    assert.deepEqual(validateTemplateSourceUsePolicy(sources, registry.sources), [], `${relativePackage}/sources.yaml reuse policy invalid`);
    assert.deepEqual(validateTemplateSourceClaimPolicy(sources, claimRegistry), [], `${relativePackage}/sources.yaml research-claim mapping invalid`);
    const notes = await readFile(join(packageDir, 'notes.md'), 'utf8');
    assert.deepEqual(validateTemplateNoteClaimPolicy(sources, notes, claimRegistry), [], `${relativePackage}/notes.md cited research claims lack source mappings`);
    const reviewableSources = resolveReviewSourceRecords(sources.source_ids, registry.sources);

    const allowedVariables = new Set(variables.variables.map((variable) => variable.name));
    const reviewableFiles = {};
    for (const language of ['en', 'fr', 'ar']) {
      const languagePath = join(packageDir, `${language}.md`);
      const languageInfo = await lstat(languagePath).then((info) => info, (error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      assert.equal(languageInfo?.isFile() ?? false, metadata.languages.includes(language), `${relativePackage}/${language}.md presence must match metadata.languages and use a regular file`);
    }
    let referenceLanguage;
    const variablesByLanguage = new Map();
    const languageTexts = new Map();
    for (const language of metadata.languages) {
      const languagePath = join(packageDir, `${language}.md`);
      const text = await readFile(languagePath, 'utf8');
      assert.ok(text.trim().length > 0, `${relativePackage}/${language}.md must not be empty`);
      const sections = sectionIds(text);
      assert.ok(sections.length > 0, `${relativePackage}/${language}.md must declare section IDs`);
      assert.equal(new Set(sections).size, sections.length, `${relativePackage}/${language}.md contains duplicate section IDs`);
      if (referenceLanguage === undefined) referenceLanguage = language;
      languageTexts.set(language, text);
      const usedVariables = [...new Set(findTemplateVariables(text))].sort();
      variablesByLanguage.set(language, usedVariables);
      reviewableFiles[`${language}.md`] = text;
      assert.equal(hasUnmatchedTemplateBraces(text), false, `${relativePackage}/${language}.md contains malformed variable braces`);
      for (const variable of findTemplateVariables(text)) {
        assert.match(variable, /^[a-z][a-z0-9_]*$/, `${relativePackage}/${language}.md contains invalid variable name {{${variable}}}`);
        assert.ok(allowedVariables.has(variable), `${relativePackage}/${language}.md uses undeclared variable {{${variable}}}`);
      }
    }
    const expectedVariables = variablesByLanguage.get(metadata.languages[0]);
    for (const language of metadata.languages.slice(1)) {
      assert.deepEqual(variablesByLanguage.get(language), expectedVariables, `${relativePackage}/${language}.md variable set differs from other languages`);
      assert.deepEqual(compareTranslationStructure(languageTexts.get(metadata.languages[0]), languageTexts.get(language)), [], `${relativePackage}/${language}.md translation structure differs from ${metadata.languages[0]}`);
    }
    assert.deepEqual(
      validateTemplateLawCitationPolicy(Object.fromEntries(languageTexts), sources, claimRegistry),
      [],
      `${relativePackage} legal-instrument citation provenance invalid`
    );
    reviewableFiles['variables.schema.json'] = await readFile(variablePath, 'utf8');
    reviewableFiles['sources.yaml'] = await readFile(sourcesPath, 'utf8');
    reviewableFiles['source-records.json'] = `${JSON.stringify(reviewableSources, null, 2)}\n`;
    reviewableFiles['notes.md'] = notes;
    reviewableFiles['metadata.json'] = reviewableMetadata(metadata);
    const changelog = await readFile(join(packageDir, 'CHANGELOG.md'), 'utf8');
    assert.deepEqual(validateTemplateChangelog(metadata, changelog), [], `${relativePackage}/CHANGELOG.md invalid`);
    reviewableFiles['CHANGELOG.md'] = changelog;
    const contentDigest = digestReviewableContent(reviewableFiles);
    const reviewErrors = validateTemplateReviewPolicy(metadata, { authorizedReviewers, authorizedLanguageReviewers, reviewRecords, currentContentDigest: contentDigest });
    assert.deepEqual(reviewErrors, [], `${relativePackage} review state invalid: ${reviewErrors.join('; ')}`);
  }
  return templateMetadataFiles.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await validateTemplatePackages();
  console.log(`Validated ${count} template packages.`);
}
