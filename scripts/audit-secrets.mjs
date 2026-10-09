import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxFileBytes = 20 * 1024 * 1024;
const credentialPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['stripe-live-secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/i],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
];

export function findCredentialRuleIds(text) {
  return credentialPatterns.filter(([, pattern]) => pattern.test(text)).map(([rule]) => rule);
}

function repositoryFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output.toString('utf8').split('\0').filter(Boolean);
  } catch (error) {
    if (!String(error.stderr || '').includes('not a git repository')) throw error;
    return walkExportTree(root);
  }
}

async function walkExportTree(directory, relativeDirectory = '') {
  const paths = [];
  const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'graphify-out', '__pycache__']);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...await walkExportTree(resolve(directory, entry.name), relativePath));
    else if (entry.isFile() && entry.name !== '.DS_Store' && !entry.name.endsWith('.log') && !/\.py[cod]$/.test(entry.name)) paths.push(relativePath);
  }
  return paths.sort();
}

export async function auditRepositorySecrets() {
  const findings = [];
  let scanned = 0;
  for (const repositoryPath of await repositoryFiles()) {
    const absolutePath = resolve(root, repositoryPath);
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) throw new Error(`Refusing to follow symbolic link during secrets audit: ${repositoryPath}`);
    if (!info.isFile()) continue;
    if (info.size > maxFileBytes) throw new Error(`File exceeds the secrets audit size limit: ${repositoryPath}`);
    const content = await readFile(absolutePath);
    if (content.includes(0)) continue;
    scanned += 1;
    for (const rule of findCredentialRuleIds(content.toString('utf8'))) {
      findings.push({ path: relative(root, absolutePath).split('\\').join('/'), rule });
    }
  }
  return { scanned, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditRepositorySecrets();
    for (const finding of result.findings) process.stderr.write(`Potential ${finding.rule} in ${finding.path}. Remove it or replace it with a synthetic value.\n`);
    if (result.findings.length) {
      process.stderr.write(`Secrets audit found ${result.findings.length} high-signal credential pattern(s) across ${result.scanned} text files.\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`Secrets audit passed: ${result.scanned} tracked project files checked for high-signal credential patterns. This is not a complete secrets or personal-data detector.\n`);
    }
  } catch (error) {
    process.stderr.write(`Secrets audit could not complete: ${error.message}\n`);
    process.exitCode = 1;
  }
}
