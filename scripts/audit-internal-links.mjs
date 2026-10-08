import { lstat, readFile, readlink, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const excludedDirectories = new Set(['.git', 'dist', 'graphify-out', 'node_modules']);

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

function markdownTargets(markdown) {
  const withoutCode = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/(`+)[^`]*?\1/g, '');
  return [...withoutCode.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim());
}

function localTargetPath(documentPath, rawTarget, projectRoot) {
  const withoutTitle = rawTarget.replace(/^<|>$/g, '').split(/\s+['"]/, 1)[0];
  if (!withoutTitle || /^[a-z][a-z0-9+.-]*:/i.test(withoutTitle) || withoutTitle.startsWith('//')) return null;
  const pathPart = withoutTitle.split(/[?#]/, 1)[0];
  if (!pathPart) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return resolve(dirname(documentPath), pathPart);
  }
  return decoded.startsWith('/')
    ? resolve(projectRoot, decoded.slice(1))
    : resolve(dirname(documentPath), decoded);
}

function isWithinProjectRoot(projectRoot, targetPath) {
  const pathFromRoot = relative(projectRoot, targetPath);
  return pathFromRoot === ''
    || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot));
}

async function resolveWithinProjectRoot(projectRoot, targetPath, symlinkDepth = 0) {
  if (!isWithinProjectRoot(projectRoot, targetPath)) return null;
  const pathFromRoot = relative(projectRoot, targetPath);
  if (!pathFromRoot) return projectRoot;

  const segments = pathFromRoot.split(sep).filter(Boolean);
  let current = projectRoot;
  for (let index = 0; index < segments.length; index += 1) {
    const next = resolve(current, segments[index]);
    let info;
    try {
      info = await lstat(next);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        const unresolvedPath = resolve(next, ...segments.slice(index + 1));
        return isWithinProjectRoot(projectRoot, unresolvedPath) ? unresolvedPath : null;
      }
      return null;
    }

    if (info.isSymbolicLink()) {
      if (symlinkDepth >= 40) return null;
      let linkTarget;
      try {
        linkTarget = await readlink(next);
      } catch {
        return null;
      }
      const resolvedLink = isAbsolute(linkTarget)
        ? resolve(linkTarget)
        : resolve(dirname(next), linkTarget);
      const targetWithRemainder = resolve(resolvedLink, ...segments.slice(index + 1));
      return resolveWithinProjectRoot(projectRoot, targetWithRemainder, symlinkDepth + 1);
    }

    current = next;
  }
  return current;
}

export async function findBrokenMarkdownLinks(projectRoot = root) {
  const canonicalRoot = await realpath(projectRoot);
  const files = (await markdownFiles(canonicalRoot)).sort();
  const broken = [];
  for (const documentPath of files) {
    const markdown = await readFile(documentPath, 'utf8');
    for (const rawTarget of markdownTargets(markdown)) {
      const targetPath = localTargetPath(documentPath, rawTarget, canonicalRoot);
      if (!targetPath) continue;
      const containedTarget = await resolveWithinProjectRoot(canonicalRoot, targetPath);
      if (!containedTarget || !await stat(containedTarget).then(() => true, () => false)) {
        broken.push(`${relative(canonicalRoot, documentPath)}: ${rawTarget}`);
      }
    }
  }
  return broken;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const broken = await findBrokenMarkdownLinks();
  if (broken.length) {
    process.stderr.write(`Found ${broken.length} broken local Markdown link(s):\n${broken.map((entry) => `- ${entry}`).join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Internal Markdown link audit passed.\n');
  }
}
