import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const languages = new Set(['en', 'fr', 'ar']);

export async function loadCatalog(root = resolve(fileURLToPath(new URL('..', import.meta.url)))) {
  const templatesRoot = resolve(root, 'templates');
  const canonicalTemplatesRoot = await realpath(templatesRoot);
  const categoryEntries = await readdir(templatesRoot, { withFileTypes: true });
  const catalog = [];
  for (const categoryEntry of categoryEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!categoryEntry.isDirectory() || categoryEntry.isSymbolicLink()) continue;
    const categoryPath = resolve(templatesRoot, categoryEntry.name);
    for (const packageEntry of (await readdir(categoryPath, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!packageEntry.isDirectory() || packageEntry.isSymbolicLink()) continue;
      const packagePath = resolve(categoryPath, packageEntry.name);
      const relativePath = relative(templatesRoot, packagePath);
      if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Template package path escaped the templates directory');
      const metadata = await readPackageJson(packagePath, 'metadata.yaml', canonicalTemplatesRoot);
      const sources = await readPackageJson(packagePath, 'sources.yaml', canonicalTemplatesRoot);
      if (typeof metadata.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.id) || !Array.isArray(metadata.languages) || !metadata.languages.every((language) => languages.has(language))) {
        throw new Error(`Invalid catalogue metadata in ${relativePath}`);
      }
      catalog.push({ id: metadata.id, category: categoryEntry.name, packagePath, metadata, sources });
    }
  }
  const ids = catalog.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate template IDs found in the catalogue');
  return catalog;
}

async function readPackageJson(packagePath, filename, canonicalRoot) {
  const path = resolve(packagePath, filename);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Refusing non-regular package file: ${filename}`);
  const canonicalPath = await realpath(path);
  const relativePath = relative(canonicalRoot, canonicalPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error(`Package file escaped templates: ${filename}`);
  return JSON.parse(await readFile(canonicalPath, 'utf8'));
}

export async function loadTemplateContent(template, language) {
  if (!template.metadata.languages.includes(language)) throw new Error(`Language ${language} is unavailable for ${template.id}`);
  const path = resolve(template.packagePath, `${language}.md`);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Refusing non-regular template content');
  const canonicalPath = await realpath(path);
  const relativePath = relative(await realpath(template.packagePath), canonicalPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Template content escaped its package');
  return readFile(canonicalPath, 'utf8');
}

export function recordedReview(metadata) {
  return {
    status: metadata.status,
    legal_review: metadata.legal_review,
    language_review: metadata.language_review,
    verified: false,
  };
}

export const draftDisclaimer = 'Discussion drafts only; not legal advice or compliance certification.';
