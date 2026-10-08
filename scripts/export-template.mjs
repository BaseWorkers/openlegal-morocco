import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createDocxBytes, createPlainText } from './docx-export.mjs';
import { renderGeneratedHtml, renderGeneratedMarkdown } from './generator-runtime.mjs';
import { validateTemplatePackages } from './validate-template-packages.mjs';

const execFileAsync = promisify(execFile);
const allowedFormats = new Set(['md', 'txt', 'html', 'docx', 'pdf']);
const MAX_INPUT_BYTES = 1024 * 1024;

export function standaloneHtml(template, language, markdown) {
  return renderGeneratedHtml(template, language, markdown);
}

async function readStdin() {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_INPUT_BYTES) throw new Error(`Generator JSON input exceeds ${MAX_INPUT_BYTES} bytes`);
    chunks.push(chunk);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

async function writeNewFile(path, contents) {
  await writeFile(path, contents, { flag: 'wx' });
}

export async function exportPdf(template, language, markdown, outputPath) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'olm-export-'));
  const docxPath = join(temporaryDirectory, 'document.docx');
  const officeProfile = pathToFileURL(join(temporaryDirectory, 'office-profile')).href;
  try {
    await writeFile(docxPath, createDocxBytes(template, language, markdown));
    try {
      await execFileAsync('soffice', ['--headless', `-env:UserInstallation=${officeProfile}`, '--convert-to', 'pdf', '--outdir', temporaryDirectory, docxPath], { shell: false, timeout: 120_000 });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await execFileAsync('libreoffice', ['--headless', `-env:UserInstallation=${officeProfile}`, '--convert-to', 'pdf', '--outdir', temporaryDirectory, docxPath], { shell: false, timeout: 120_000 });
    }
    const pdfPath = join(temporaryDirectory, 'document.pdf');
    await copyFile(pdfPath, outputPath, fsConstants.COPYFILE_EXCL);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function exportTemplate({ templateDirectory, language, format, outputPath, values }) {
  if (!allowedFormats.has(format)) throw new Error(`Unsupported format ${format}; choose md, txt, html, docx, or pdf`);
  const templatesRoot = await realpath(new URL('../templates/', import.meta.url));
  const packageDirectory = await realpath(resolve(templateDirectory));
  const relativePackagePath = relative(templatesRoot, packageDirectory);
  if (!relativePackagePath || relativePackagePath.startsWith('..') || isAbsolute(relativePackagePath)) {
    throw new Error('Template directory must refer to a package inside this repository’s templates directory');
  }
  await validateTemplatePackages();
  const metadata = JSON.parse(await readFile(join(packageDirectory, 'metadata.yaml'), 'utf8'));
  const variableDocument = JSON.parse(await readFile(join(packageDirectory, 'variables.schema.json'), 'utf8'));
  const packageSources = JSON.parse(await readFile(join(packageDirectory, 'sources.yaml'), 'utf8'));
  const registry = JSON.parse(await readFile(new URL('../sources/registry.yaml', import.meta.url), 'utf8'));
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  const sources = packageSources.source_uses.map((sourceUse) => ({ ...sourceById.get(sourceUse.source_id), ...sourceUse }));
  const contents = Object.fromEntries(await Promise.all(metadata.languages.map(async (availableLanguage) => [
    availableLanguage,
    await readFile(join(packageDirectory, `${availableLanguage}.md`), 'utf8')
  ])));
  const template = { metadata };
  const generatedTemplate = { metadata, variables: variableDocument.variables, sources, contents };
  const markdown = renderGeneratedMarkdown(generatedTemplate, language, values);
  const targetPath = resolve(outputPath);
  if (format === 'md') await writeNewFile(targetPath, markdown);
  else if (format === 'txt') await writeNewFile(targetPath, createPlainText(template, language, markdown));
  else if (format === 'html') await writeNewFile(targetPath, standaloneHtml(template, language, markdown));
  else if (format === 'docx') await writeNewFile(targetPath, createDocxBytes(template, language, markdown));
  else await exportPdf(template, language, markdown, targetPath);
  return targetPath;
}

function parseArguments(args) {
  const [templateDirectory, language, format, outputPath, ...unexpected] = args;
  if (unexpected.length || !templateDirectory || !['en', 'fr', 'ar'].includes(language) || !format || !outputPath) {
    throw new Error('Usage: npm run export -- <template-directory> <en|fr|ar> <md|txt|html|docx|pdf> <output-path> < values.json');
  }
  if (extname(outputPath).toLowerCase() !== `.${format}`) throw new Error(`Output path must end in .${format}`);
  return { templateDirectory, language, format, outputPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const values = JSON.parse(await readStdin());
    const output = await exportTemplate({ ...options, values });
    process.stderr.write(`Wrote ${basename(output)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
