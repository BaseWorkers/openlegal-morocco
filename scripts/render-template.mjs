import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateTemplatePackages } from './validate-template-packages.mjs';
import { renderTemplateText } from './generator-core.mjs';
export { escapeMarkdownValue, validateInputValues } from './generator-core.mjs';

export async function renderTemplate(templateDirectory, language, values) {
  const packageDirectory = resolve(templateDirectory);
  await validateTemplatePackages(packageDirectory);
  const metadata = JSON.parse(await readFile(join(packageDirectory, 'metadata.yaml'), 'utf8'));
  if (!metadata.languages.includes(language)) throw new Error(`Language ${language} is not available for ${metadata.id}`);
  if (metadata.status !== 'RELEASED' || metadata.legal_review?.status !== 'reviewed' || metadata.language_review?.[language] !== 'reviewed' || metadata.generator_enabled !== true) {
    throw new Error(`Generation is disabled for ${metadata.id}: it must be released, legally reviewed, language reviewed for ${language}, and explicitly enabled`);
  }

  const variableDocument = JSON.parse(await readFile(join(packageDirectory, 'variables.schema.json'), 'utf8'));
  const markdown = await readFile(join(packageDirectory, `${language}.md`), 'utf8');
  return renderTemplateText(markdown, variableDocument.variables, values);
}
