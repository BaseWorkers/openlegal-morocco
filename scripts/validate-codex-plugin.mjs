import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = join(root, 'codex-marketplace/plugins/open-legal-morocco');
try {
  await realpath(pluginRoot);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Codex plugin package is intentionally omitted from this project-only export.');
    process.exit(0);
  }
  throw error;
}
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson(join(pluginRoot, 'plugin.json'));
const compatibility = await readJson(join(pluginRoot, '.codex-plugin/plugin.json'));
const marketplace = await readJson(join(root, 'codex-marketplace/.agents/plugins/marketplace.json'));
const primarySkill = await readFile(join(root, 'skills/openlegal-morocco/SKILL.md'), 'utf8');
const packagedSkill = await readFile(join(pluginRoot, 'skills/openlegal-morocco/SKILL.md'), 'utf8');
const taxonomy = await readFile(join(root, 'schemas/control-taxonomy.json'), 'utf8');
const packagedTaxonomy = await readFile(join(pluginRoot, 'schemas/control-taxonomy.json'), 'utf8');
const findingsSchema = await readFile(join(root, 'schemas/findings.schema.json'), 'utf8');
const packagedFindingsSchema = await readFile(join(pluginRoot, 'schemas/findings.schema.json'), 'utf8');
const evaluation = await readFile(join(root, 'skills/openlegal-morocco/evaluation/README.md'), 'utf8');
const packagedEvaluation = await readFile(join(pluginRoot, 'skills/openlegal-morocco/evaluation/README.md'), 'utf8');
const evaluationCases = await readFile(join(root, 'skills/openlegal-morocco/evaluation/adversarial-cases.json'), 'utf8');
const packagedEvaluationCases = await readFile(join(pluginRoot, 'skills/openlegal-morocco/evaluation/adversarial-cases.json'), 'utf8');
const marketplaceSource = resolve(root, 'codex-marketplace', marketplace.plugins?.[0]?.source?.path || '');

if (manifest.name !== 'open-legal-morocco' || compatibility.name !== manifest.name) {
  throw new Error('Codex plugin manifests must identify open-legal-morocco.');
}
if (manifest.version !== compatibility.version || manifest.version !== marketplace.plugins?.[0]?.version) {
  throw new Error('Plugin, compatibility, and marketplace versions must match.');
}
if (manifest.skills !== './skills/' || compatibility.skills !== './skills/') {
  throw new Error('Both plugin manifests must expose the packaged skills directory.');
}
if (primarySkill !== packagedSkill) throw new Error('Packaged OpenLegal skill is out of sync with skills/.');
if (taxonomy !== packagedTaxonomy || findingsSchema !== packagedFindingsSchema) {
  throw new Error('Packaged findings contracts are out of sync with repository schemas.');
}
if (evaluation !== packagedEvaluation) throw new Error('Packaged skill evaluation guide is out of sync.');
if (evaluationCases !== packagedEvaluationCases) throw new Error('Packaged skill evaluation cases are out of sync.');
if ((await realpath(marketplaceSource)) !== (await realpath(pluginRoot))) {
  throw new Error('Local Codex marketplace source does not resolve to the plugin package.');
}
if (marketplace.plugins.length !== 1 || marketplace.plugins[0].name !== manifest.name) {
  throw new Error('Marketplace must publish exactly the validated OpenLegal plugin.');
}
if (manifest.extensions?.['com.openai']?.interface?.shortDescription?.length > 30) {
  throw new Error('Codex plugin shortDescription must be at most 30 characters.');
}

console.log(`Codex plugin package validated: ${manifest.name}@${manifest.version}`);
