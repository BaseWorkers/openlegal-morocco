import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPublicKey } from 'node:crypto';
import { validateJsonSchemaValue } from './schema-validator.mjs';
import { validateTemplateReviewPolicy } from './review-policy.mjs';
import { validateReuseRevisionPolicy, validateSourceReusePolicy } from './source-reuse-policy.mjs';
import { validateResearchClaimReviewPolicy } from './research-claim-policy.mjs';
import { normalizeSourceUrl } from './source-link-policy.mjs';
import { validateClauseCatalogReferences } from './clause-catalog-policy.mjs';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const packageManifest = await readJson('../package.json');
assert.equal(packageManifest.name, 'openlegal', 'the public package must use the OpenLegal brand');
assert.equal(packageManifest.private, undefined, 'the npm CLI package must be publishable');
assert.equal(packageManifest.license, undefined, 'the repository has separate software and legal-content license scopes; do not label the whole package with one license');
assert.deepEqual(packageManifest.bin, { openlegal: 'scripts/openlegal.mjs', 'openlegal-mcp': 'scripts/openlegal-mcp.mjs' });
for (const requiredPackagePath of ['scripts/*.mjs', 'templates/**', 'schemas/**', 'mcp/server.py', 'LICENSES/README.md']) {
  assert.ok(packageManifest.files.includes(requiredPackagePath), `npm package files must include ${requiredPackagePath}`);
}
const templateSchema = await readJson('../schemas/template.schema.json');
const variablesSchema = await readJson('../schemas/variables.schema.json');
const sourceSchema = await readJson('../schemas/source.schema.json');
const reviewSchema = await readJson('../schemas/review.schema.json');
const researchClaimSchema = await readJson('../schemas/research-claim.schema.json');
const researchReviewSchema = await readJson('../schemas/research-review.schema.json');
const clauseCatalogSchema = await readJson('../schemas/clause-catalog.schema.json');
const transitions = await readJson('../schemas/review-transitions.json');
const reviewerRegistry = await readJson('../reviews/authorized-reviewers.yaml');
const reviewRecords = await readJson('../reviews/records.json');
const researchReviewRecords = await readJson('../reviews/research-records.json');
const authorizedReviewersSchema = await readJson('../schemas/authorized-reviewers.schema.json');
for (const schema of [templateSchema, variablesSchema, sourceSchema, reviewSchema, researchClaimSchema, researchReviewSchema, clauseCatalogSchema, authorizedReviewersSchema]) {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.type, 'object');
}

const states = templateSchema.properties.status.enum;
assert.deepEqual(validateJsonSchemaValue(reviewerRegistry, authorizedReviewersSchema), []);
assert.equal(reviewRecords.schema_version, 1);
assert.ok(Array.isArray(reviewRecords.reviews));
const reviewerIds = new Set();
for (const reviewer of reviewerRegistry.authorized_legal_reviewers) {
  assert.ok(!reviewerIds.has(reviewer.id), `duplicate authorized reviewer ID ${reviewer.id}`);
  reviewerIds.add(reviewer.id);
}
const languageReviewerIds = new Set();
for (const reviewer of reviewerRegistry.authorized_language_reviewers) {
  assert.ok(!languageReviewerIds.has(reviewer.id), `duplicate authorized language reviewer ID ${reviewer.id}`);
  languageReviewerIds.add(reviewer.id);
}
const publicKeyOwners = new Map();
for (const reviewer of [...reviewerRegistry.authorized_legal_reviewers, ...reviewerRegistry.authorized_language_reviewers]) {
  if (reviewer.active) assert.ok(reviewer.signing_keys.some((key) => key.active), `active reviewer ${reviewer.id} must have an active Ed25519 signing key`);
  const keyIds = new Set();
  for (const key of reviewer.signing_keys) {
    assert.ok(!keyIds.has(key.id), `duplicate signing key ID ${key.id} for reviewer ${reviewer.id}`);
    keyIds.add(key.id);
    let publicKey;
    try {
      publicKey = createPublicKey(key.public_key_pem);
    } catch {
      assert.fail(`invalid signing public key ${key.id} for reviewer ${reviewer.id}`);
    }
    assert.equal(publicKey.asymmetricKeyType, 'ed25519', `signing public key ${key.id} for reviewer ${reviewer.id} must use Ed25519`);
    const canonicalPublicKey = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const existingOwner = publicKeyOwners.get(canonicalPublicKey);
    assert.ok(!existingOwner || existingOwner === reviewer.id, `signing public key is shared by reviewer identities ${existingOwner} and ${reviewer.id}`);
    publicKeyOwners.set(canonicalPublicKey, reviewer.id);
  }
}
const reviewIds = new Set();
for (const review of reviewRecords.reviews) {
  assert.deepEqual(validateJsonSchemaValue(review, reviewSchema));
  assert.ok(!reviewIds.has(review.id), `duplicate review record ID ${review.id}`);
  reviewIds.add(review.id);
}
assert.deepEqual(Object.keys(transitions).sort(), [...states].sort());
assert.equal(transitions.DRAFT.includes('LEGAL_REVIEWED'), false);
assert.equal(transitions.RESEARCHED.includes('LEGAL_REVIEWED'), false);

// registry.yaml intentionally uses JSON, a valid YAML subset, to keep parsing dependency-free.
const registryText = await readFile(new URL('../sources/registry.yaml', import.meta.url), 'utf8');
const registry = JSON.parse(registryText);
const moroccoMapText = await readFile(new URL('../sources/official-morocco.yaml', import.meta.url), 'utf8');
const moroccoMap = JSON.parse(moroccoMapText);
assert.equal(registry.schema_version, 1);
assert.ok(Array.isArray(registry.sources));
const sourceIds = new Set();
for (const [index, source] of registry.sources.entries()) {
  const errors = validateJsonSchemaValue(source, sourceSchema);
  assert.deepEqual(errors, [], `sources[${index}] invalid: ${errors.join('; ')}`);
  assert.deepEqual(validateSourceReusePolicy(source), [], `sources[${index}] reuse policy invalid`);
  assert.deepEqual(validateReuseRevisionPolicy(source), [], `sources[${index}] reuse revision invalid`);
  assert.ok(normalizeSourceUrl(source.url), `sources[${index}] URL must use an allowlisted HTTPS host without credentials or a nonstandard port`);
  assert.ok(!sourceIds.has(source.id), `duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
}
assert.equal(moroccoMap.schema_version, 1);
assert.ok(Array.isArray(moroccoMap.entries));
for (const [index, entry] of moroccoMap.entries.entries()) {
  assert.equal(typeof entry.source_id, 'string', `official-morocco[${index}] needs a source id`);
  assert.ok(sourceIds.has(entry.source_id), `official-morocco[${index}] refers to unknown source ${entry.source_id}`);
  assert.equal(typeof entry.topic, 'string', `official-morocco[${index}] needs a topic`);
  assert.equal(typeof entry.next_step, 'string', `official-morocco[${index}] needs a next step`);
}
const claimsText = await readFile(new URL('../research/morocco/claims.json', import.meta.url), 'utf8');
const claimRegistry = JSON.parse(claimsText);
assert.equal(claimRegistry.schema_version, 1);
assert.ok(Array.isArray(claimRegistry.claims));
assert.equal(researchReviewRecords.schema_version, 1);
assert.ok(Array.isArray(researchReviewRecords.reviews));
const researchReviewIds = new Set();
for (const [index, review] of researchReviewRecords.reviews.entries()) {
  const errors = validateJsonSchemaValue(review, researchReviewSchema);
  assert.deepEqual(errors, [], `research reviews[${index}] invalid: ${errors.join('; ')}`);
  assert.ok(!researchReviewIds.has(review.id), `duplicate research review record ID: ${review.id}`);
  researchReviewIds.add(review.id);
}
const claimIds = new Set();
for (const [index, claim] of claimRegistry.claims.entries()) {
  const errors = validateJsonSchemaValue(claim, researchClaimSchema);
  assert.deepEqual(errors, [], `claims[${index}] invalid: ${errors.join('; ')}`);
  assert.ok(!claimIds.has(claim.id), `duplicate research claim id: ${claim.id}`);
  claimIds.add(claim.id);
  for (const sourceId of claim.source_ids) assert.ok(sourceIds.has(sourceId), `claim ${claim.id} refers to unknown source ${sourceId}`);
  const reviewErrors = validateResearchClaimReviewPolicy(claim, {
    reviewRecords: researchReviewRecords.reviews,
    authorizedReviewers: reviewerRegistry.authorized_legal_reviewers,
    sourceRegistry: registry.sources
  });
  assert.deepEqual(reviewErrors, [], `claim ${claim.id} review policy invalid: ${reviewErrors.join('; ')}`);
  if (claim.evidence_status === 'source-text-checked') {
    assert.ok(claim.source_ids.some((id) => ['legislation', 'official', 'regulatory-guidance'].includes(registry.sources.find((source) => source.id === id)?.source_type)), `claim ${claim.id} needs a primary/official source`);
  }
}
for (const review of researchReviewRecords.reviews) assert.ok(claimIds.has(review.claim_id), `research review ${review.id} refers to unknown claim ${review.claim_id}`);
for (const [state, targets] of Object.entries(transitions)) {
  assert.ok(targets.every((target) => states.includes(target)), `transition from ${state} includes an unknown state`);
}
const clauseCatalog = await readJson('../clauses/catalog.yaml');
const clauseCatalogErrors = validateJsonSchemaValue(clauseCatalog, clauseCatalogSchema);
assert.deepEqual(clauseCatalogErrors, [], `clause catalog invalid: ${clauseCatalogErrors.join('; ')}`);
const templateIds = new Set();
const templateRoot = new URL('../templates/', import.meta.url);
for (const category of await readdir(templateRoot, { withFileTypes: true })) {
  if (!category.isDirectory()) continue;
  for (const packageDirectory of await readdir(new URL(`${category.name}/`, templateRoot), { withFileTypes: true })) {
    if (!packageDirectory.isDirectory()) continue;
    const metadata = await readJson(`../templates/${category.name}/${packageDirectory.name}/metadata.yaml`);
    assert.ok(!templateIds.has(metadata.id), `duplicate template id: ${metadata.id}`);
    templateIds.add(metadata.id);
  }
}
assert.deepEqual(validateClauseCatalogReferences(clauseCatalog, { sourceIds, templateIds }), []);
console.log(`Validated ${registry.sources.length} source records, ${moroccoMap.entries.length} official-source map entries, ${claimRegistry.claims.length} research claims, ${researchReviewIds.size} research review records, ${clauseCatalog.clauses.length} clause concepts, ${reviewIds.size} template review records, ${reviewerIds.size} authorized legal reviewers, ${languageReviewerIds.size} authorized language reviewers, and ${states.length} review states.`);
