import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'graphify-out']);
const ignoredFiles = new Set([
  'ROADMAP.md',
  'sources/audit-external-links-2026-10-08.md',
  'reviews/policy/license-and-disclaimer-audit.md'
]);
const ambiguousLinkLabels = new Set(['here', 'click here', 'read more', 'more', 'link']);

function withoutCodeBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const visible = [];
  let fence = null;
  let fenceLine = null;
  for (const [index, line] of lines.entries()) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      const current = marker[1][0];
      if (fence === null) {
        fence = { character: current, length: marker[1].length };
        fenceLine = index + 1;
      } else if (fence.character === current && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = null;
        fenceLine = null;
      }
      continue;
    }
    if (fence === null) visible.push(line);
  }
  return { lines: visible, unclosedFenceLine: fenceLine };
}

export function auditMarkdownAccessibility(markdown, filename = '<markdown>') {
  const errors = [];
  const { lines, unclosedFenceLine } = withoutCodeBlocks(markdown);
  if (unclosedFenceLine !== null) errors.push(`${filename}:${unclosedFenceLine}: fenced code block is not closed; remaining Markdown could not be audited`);
  let previousHeadingLevel = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const heading = line.match(/^\s{0,3}(#{1,6})(?:\s+|$)/);
    const content = line.replace(/(`+)(.*?)\1/g, '');
    if (heading) {
      const level = heading[1].length;
      if (previousHeadingLevel && level > previousHeadingLevel + 1) {
        errors.push(`${filename}:${lineNumber}: heading level skips from h${previousHeadingLevel} to h${level}`);
      }
      previousHeadingLevel = level;
    }

    for (const image of content.matchAll(/!\[([^\]]*)\]\((?:<[^>]*>|[^)]*)(?:\s+["'][^"']*["'])?\)/g)) {
      if (!image[1].trim()) errors.push(`${filename}:${lineNumber}: image has empty alternative text`);
    }
    for (const image of content.matchAll(/<img\b([^>]*)>/gi)) {
      const alt = image[1].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      if (!alt || !(alt[1] ?? alt[2] ?? alt[3] ?? '').trim()) {
        errors.push(`${filename}:${lineNumber}: HTML image has missing or empty alternative text`);
      }
    }
    for (const link of content.matchAll(/(?<!!)\[([^\]]+)\]\((?:<[^>]*>|[^)]*)(?:\s+["'][^"']*["'])?\)/g)) {
      if (ambiguousLinkLabels.has(link[1].trim().toLowerCase())) {
        errors.push(`${filename}:${lineNumber}: link label "${link[1].trim()}" is ambiguous`);
      }
    }
    for (const link of content.matchAll(/<a\b[^>]*>(.*?)<\/a>/gi)) {
      const label = link[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
      if (ambiguousLinkLabels.has(label)) errors.push(`${filename}:${lineNumber}: HTML link label "${label}" is ambiguous`);
    }
  }
  return errors;
}

async function collectMarkdown(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const rel = relative(root, path).split(sep).join('/');
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await walk(path);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && !ignoredFiles.has(rel)) {
        files.push(path);
      }
    }
  }
  await walk(root);
  return files;
}

async function main() {
  const root = resolve(process.argv[2] ?? repositoryRoot);
  const files = await collectMarkdown(root);
  const errors = [];
  for (const path of files) {
    errors.push(...auditMarkdownAccessibility(await readFile(path, 'utf8'), relative(root, path).split(sep).join('/')));
  }
  if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Markdown accessibility audit passed for ${files.length} files: heading hierarchy, image alternative text, and link labels.\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
