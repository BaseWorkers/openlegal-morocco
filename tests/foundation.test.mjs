import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJsonSchemaValue } from '../scripts/schema-validator.mjs';
import { digestReviewableContent, validateTemplateReviewPolicy } from '../scripts/review-policy.mjs';
import { findTemplateVariables, hasUnmatchedTemplateBraces, reviewableMetadata } from '../scripts/template-package-utils.mjs';
import { validateTemplatePackages } from '../scripts/validate-template-packages.mjs';
import { escapeMarkdownValue, renderTemplate, validateInputValues } from '../scripts/render-template.mjs';
import { validateGeneratorVariablePolicy } from '../scripts/generator-policy.mjs';
import { renderMarkdownToHtml } from '../scripts/markdown-renderer.mjs';
import { createDocxBytes, createDocxXmlParts, createPlainText } from '../scripts/docx-export.mjs';
import { exportTemplate, standaloneHtml } from '../scripts/export-template.mjs';
import { isInternalMarkdownDocument } from '../scripts/project-export-policy.mjs';
import { renderGeneratedMarkdown } from '../scripts/generator-runtime.mjs';
import { buildReviewPackets } from '../scripts/build-review-packets.mjs';
import { validateSourceReusePolicy } from '../scripts/source-reuse-policy.mjs';
import { compareTranslationStructure } from '../scripts/translation-parity.mjs';
import { validateTemplateChangelog } from '../scripts/changelog-policy.mjs';
import { validateTemplateLawCitationPolicy, validateTemplateNoteClaimPolicy, validateTemplateSourceClaimPolicy, validateTemplateSourceUsePolicy } from '../scripts/template-source-use-policy.mjs';
import { classifySourceLinkStatus, isAllowedSourceLinkTarget, normalizeSourceUrl } from '../scripts/source-link-policy.mjs';
import { isPublicSourceAddress } from '../scripts/source-link-network.mjs';
import { findBrokenMarkdownLinks } from '../scripts/audit-internal-links.mjs';
import { auditMarkdownAccessibility } from '../scripts/audit-markdown-accessibility.mjs';
import { validateNewTemplateStatus, validateReviewStatusTransition } from '../scripts/audit-review-transitions.mjs';
import { reviewSigningPayload, verifyReviewSignature } from '../scripts/review-signatures.mjs';
import { digestResearchClaim, validateResearchClaimReviewPolicy } from '../scripts/research-claim-policy.mjs';
import { signReviewRecord as signReviewRecordWithCli } from '../scripts/sign-review-record.mjs';
import { validateClauseCatalogReferences } from '../scripts/clause-catalog-policy.mjs';

const readJson = (path) => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
const execFileAsync = promisify(execFile);

function makeSigningReviewer(id = 'reviewer-1', keyId = 'reviewer-key-1') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    reviewer: {
      id,
      active: true,
      authorized_at: '2026-10-01',
      signing_keys: [{ id: keyId, active: true, public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }) }]
    }
  };
}

function signReviewRecord(record, keyId, privateKey) {
  return {
    ...record,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: sign(null, reviewSigningPayload(record), privateKey).toString('base64')
    }
  };
}

test('internal Markdown link audit reports broken local targets and ignores external URLs and code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'olm-markdown-links-'));
  try {
    await mkdir(join(root, 'folder'));
    await writeFile(join(root, 'present.md'), '# Existing target\n');
    await writeFile(join(root, 'index.md'), [
      '[file](present.md)',
      '[directory](folder/)',
      '[external](https://example.org/page)',
      '[fragment](#section)',
      '[missing](missing.md)',
      '```md',
      '[example](not-a-real-file.md)',
      '```',
      '`[inline example](also-not-a-file.md)`'
    ].join('\n'));

    assert.deepEqual(await findBrokenMarkdownLinks(root), ['index.md: missing.md']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Markdown accessibility audit flags skipped headings, unlabeled images, and ambiguous links while ignoring code', () => {
  const markdown = [
    '# Page',
    '### Skipped level',
    '![ ](image.png)',
    '<img src="diagram.svg">',
    '[click here](details.md)',
    '`[here](inline-example.md)`',
    '````md',
    '##### Example inside a code fence',
    '![ ](example.png)',
    '[here](example.md)',
    '``` not a closing fence because it is shorter',
    '~~~~md',
    '[link](tilde-example.md)',
    '~~~~',
    '````'
  ].join('\n');
  const errors = auditMarkdownAccessibility(markdown, 'page.md');
  assert.equal(errors.length, 4);
  assert.ok(errors.some((error) => error.includes('heading level skips')));
  assert.ok(errors.some((error) => error.includes('empty alternative text')));
  assert.ok(errors.some((error) => error.includes('missing or empty alternative text')));
  assert.ok(errors.some((error) => error.includes('link label "click here" is ambiguous')));
});

test('Markdown accessibility audit rejects an unclosed fenced code block rather than silently skipping the remainder', () => {
  const errors = auditMarkdownAccessibility('# Page\n```md\n![ ](image.png)\n', 'unfinished.md');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unfinished\.md:2: fenced code block is not closed/);
});

test('template review states include pending and reviewed with explicit review record fields', async () => {
  const template = await readJson('../schemas/template.schema.json');
  const review = await readJson('../schemas/review.schema.json');
  assert.ok(template.properties.status.enum.includes('LEGAL_REVIEW_PENDING'));
  assert.ok(template.properties.status.enum.includes('LEGAL_REVIEWED'));
  assert.ok(review.required.includes('template_version'));
  assert.ok(review.required.includes('reviewer_id'));
});

test('review status transitions reject skipped stages and prevent imported approvals on new packages', async () => {
  const transitions = await readJson('../schemas/review-transitions.json');
  assert.deepEqual(validateReviewStatusTransition('DRAFT', 'RESEARCHED', transitions), []);
  assert.deepEqual(validateReviewStatusTransition('RESEARCHED', 'RESEARCHED', transitions), []);
  assert.match(validateReviewStatusTransition('DRAFT', 'LEGAL_REVIEWED', transitions)[0], /invalid review status transition/);
  assert.deepEqual(validateNewTemplateStatus({
    status: 'DRAFT', legal_review: { status: 'pending' }, languages: ['en', 'fr', 'ar'],
    language_review: { en: 'pending', fr: 'pending', ar: 'pending' }, generator_enabled: false
  }), []);
  assert.ok(validateNewTemplateStatus({
    status: 'LEGAL_REVIEWED', legal_review: { status: 'reviewed' }, languages: ['en'],
    language_review: { en: 'reviewed' }, generator_enabled: true
  }).length >= 3);
});

test('source schema requires provenance and verification status', async () => {
  const source = await readJson('../schemas/source.schema.json');
  for (const field of ['publisher', 'jurisdiction', 'url', 'license_basis', 'reuse_status', 'reuse_license', 'reuse_scope', 'reuse_review_date', 'date_accessed', 'verification_date', 'used_for']) {
    assert.ok(source.required.includes(field), `missing ${field}`);
  }
});

test('schema validator rejects unsupported constraints instead of silently ignoring them', () => {
  assert.throws(() => validateJsonSchemaValue('value', { type: 'string', patternProperties: { '^x': { type: 'string' } } }), /Unsupported JSON Schema keyword patternProperties/);
  assert.throws(() => validateJsonSchemaValue('value', { type: 'string', format: 'email' }), /Unsupported JSON Schema format email/);
  assert.throws(() => validateJsonSchemaValue('value', { type: 'file-path' }), /Unsupported schema type: file-path/);
  assert.deepEqual(validateJsonSchemaValue('2026-10-08', { type: 'string', format: 'date' }), []);
});

test('source-link audit separates definite missing responses from inconclusive access', () => {
  assert.equal(classifySourceLinkStatus(200), 'reachable');
  assert.equal(classifySourceLinkStatus(302), 'reachable');
  assert.equal(classifySourceLinkStatus(404), 'missing');
  assert.equal(classifySourceLinkStatus(410), 'missing');
  assert.equal(classifySourceLinkStatus(403), 'inconclusive');
  assert.equal(classifySourceLinkStatus(429), 'inconclusive');
  assert.equal(classifySourceLinkStatus(503), 'inconclusive');
  assert.equal(normalizeSourceUrl('https://spdx.org/licenses/CC0-1.0.html'), 'https://spdx.org/licenses/CC0-1.0.html');
  assert.equal(normalizeSourceUrl('https://unlisted.example/law.pdf'), null);
  assert.equal(normalizeSourceUrl('https://user:secret@spdx.org/law.pdf'), null);
  assert.equal(normalizeSourceUrl('https://spdx.org:8443/law.pdf'), null);
  assert.equal(isAllowedSourceLinkTarget('https://adala.justice.gov.ma/'), true);
  assert.equal(isAllowedSourceLinkTarget('https://redirect.example/'), false);
  assert.equal(normalizeSourceUrl('file:///etc/passwd'), null);
  assert.equal(normalizeSourceUrl('not a URL'), null);
});

test('source link network policy accepts public IPs and rejects non-public IPv4 and IPv6 ranges', () => {
  assert.equal(isPublicSourceAddress('8.8.8.8'), true);
  assert.equal(isPublicSourceAddress('2001:4860:4860::8888'), true);
  for (const address of [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.1.2',
    '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::808:808', '::ffff:127.0.0.1', '64:ff9b::a00:1', '100::1', '2001:db8::1', '3fff::1',
    '2002::1', 'fc00::1', 'fe80::1', 'ff02::1'
  ]) assert.equal(isPublicSourceAddress(address), false, `${address} must not be fetched`);
});

test('external template candidates remain file-level review leads without reuse authorization', async () => {
  const registry = await readJson('../sources/registry.yaml');
  const inventory = await readFile(new URL('../research/comparative/reusable-template-candidates.md', import.meta.url), 'utf8');
  for (const [id, license] of [
    ['dinacon-foss-legal-templates', 'CC0-1.0'],
    ['common-paper-standard-contracts', 'CC-BY-4.0']
  ]) {
    const source = registry.sources.find((entry) => entry.id === id);
    assert.ok(source, `missing candidate source ${id}`);
    assert.equal(source.reuse_status, 'file-level-review-required');
    assert.match(source.reuse_license, new RegExp(license));
    assert.match(source.reuse_scope, /no .* reviewed/i);
    assert.match(source.used_for.join(' '), /no wording incorporated/i);
    assert.match(inventory, new RegExp(id));
  }
  const commonPaperV1 = registry.sources.find((entry) => entry.id === 'common-paper-mutual-nda-v1-0');
  assert.ok(commonPaperV1);
  assert.equal(commonPaperV1.reuse_status, 'authorized-for-reuse');
  assert.equal(commonPaperV1.reuse_license, 'CC-BY-4.0');
  assert.match(commonPaperV1.url, /mutual-nda\/1\.0$/);
  assert.match(commonPaperV1.reuse_scope, /Standard Terms text/);
  assert.match(commonPaperV1.reuse_scope, /Excludes cover page/);
  assert.match(commonPaperV1.used_for.join(' '), /no wording incorporated/i);
  assert.match(inventory, /Exact-version review: Common Paper Mutual NDA/);
  const dinaconDraft = registry.sources.find((entry) => entry.id === 'dinacon-standard-software-contract-draft-de-ch');
  assert.ok(dinaconDraft);
  assert.equal(dinaconDraft.reuse_status, 'file-level-review-required');
  assert.match(dinaconDraft.reuse_license, /CC0-1\.0.*CC BY 4\.0.*CC BY 3\.0 DE/);
  assert.match(dinaconDraft.url, /blob\/e0617d5554215bd77e4c55955c8bc5ea15603d9f\//);
  assert.match(dinaconDraft.notes, /no revision number|no revision marker/i);
  assert.match(dinaconDraft.notes, /exact relationship to Version 1\/2015 and the DINAcon update remains unverified/i);
  assert.match(dinaconDraft.notes, /four-week cure period.*two weeks/i);
  assert.match(dinaconDraft.notes, /compatibility of layered license\/attribution obligations remain unresolved/i);
  assert.match(dinaconDraft.used_for.join(' '), /no wording incorporated/i);
  const osba = registry.sources.find((entry) => entry.id === 'osba-standard-software-terms');
  assert.ok(osba);
  assert.equal(osba.reuse_status, 'file-level-review-required');
  assert.match(osba.reuse_license, /CC-BY-3\.0-DE/);
  assert.match(inventory, /Exact-file review: DINAcon standard-software draft/);
  const osbaPublicationPage = registry.sources.find((entry) => entry.id === 'osba-standard-terms-publication-page');
  assert.ok(osbaPublicationPage);
  assert.equal(osbaPublicationPage.reuse_status, 'research-only');
  assert.match(osbaPublicationPage.url, /standard-vertragsbedingungen$/);
  assert.match(osbaPublicationPage.notes, /Version 1\/2015/);
  assert.match(osbaPublicationPage.notes, /does not by itself prove/);
  assert.match(osba.notes, /osba-standard-terms-publication-page/);
  assert.match(osba.notes, /exact revision used by DINAcon/);
});

test('source reuse decisions distinguish research from license-cleared reuse', () => {
  const reusable = { reuse_status: 'authorized-for-reuse', reuse_license: 'CC0-1.0', reuse_license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', reuse_scope: 'templates/nda.md at commit abc123', reuse_review_date: '2026-10-08', verification_status: 'verified' };
  assert.deepEqual(validateSourceReusePolicy(reusable), []);
  assert.match(validateSourceReusePolicy({ ...reusable, reuse_license: null })[0], /exact license/);
  assert.match(validateSourceReusePolicy({ ...reusable, reuse_scope: null })[0], /exact file or content scope/);
  assert.match(validateSourceReusePolicy({ ...reusable, verification_status: 'unverified' })[0], /verified provenance/);
  assert.deepEqual(validateSourceReusePolicy({ reuse_status: 'research-only', reuse_license: null, reuse_scope: null, reuse_review_date: null }), []);
  assert.match(validateSourceReusePolicy({ reuse_status: 'research-only', reuse_license: 'CC0-1.0', reuse_review_date: null })[0], /cannot imply reuse/);
});

test('internship research separates statutory duration from CNSS exemption and leaves the draft unreviewed', async () => {
  const metadata = await readJson('../templates/employment/internship-agreement/metadata.yaml');
  const sources = await readJson('../templates/employment/internship-agreement/sources.yaml');
  const notes = await readFile(new URL('../templates/employment/internship-agreement/notes.md', import.meta.url), 'utf8');
  const changelog = await readFile(new URL('../templates/employment/internship-agreement/CHANGELOG.md', import.meta.url), 'utf8');
  const claims = await readJson('../research/morocco/claims.json');
  const durationClaim = claims.claims.find((claim) => claim.id === 'cnss-order-1314-25-item-24-formation-insertion-contribution-base');
  assert.equal(metadata.version, '0.1.2');
  assert.equal(metadata.status, 'DRAFT');
  assert.equal(metadata.generator_enabled, false);
  assert.equal(metadata.legal_review.status, 'pending');
  assert.equal(durationClaim.current_law_status, 'unresolved');
  assert.equal(durationClaim.legal_review_status, 'not-reviewed');
  assert.ok(sources.source_ids.includes('sgg-bo-7533-law-013-26'));
  assert.ok(sources.source_ids.includes('sgg-bo-7443-order-1314-25-cnss-base'));
  assert.match(durationClaim.notes, /provisions address different questions/);
  assert.match(durationClaim.notes, /must not be read here as authorization to exceed the statutory training limit/);
  assert.match(notes, /does not encode either duration as a term/);
  assert.match(changelog, /Clarify that Law 51\.25's statutory training-duration limit and Order 1314\.25's contribution-base exemption condition address different questions/);
});

test('privacy notice cites CNDP website guidance without adopting unresolved directions as legal requirements', async () => {
  const metadata = await readJson('../templates/privacy/privacy-policy/metadata.yaml');
  const sources = await readJson('../templates/privacy/privacy-policy/sources.yaml');
  const notes = await readFile(new URL('../templates/privacy/privacy-policy/notes.md', import.meta.url), 'utf8');
  const english = await readFile(new URL('../templates/privacy/privacy-policy/en.md', import.meta.url), 'utf8');
  const claims = await readJson('../research/morocco/claims.json');
  const directMarketingClaim = claims.claims.find((claim) => claim.id === 'law-09-08-direct-marketing-article-10');
  const rectificationPeriodClaim = claims.claims.find((claim) => claim.id === 'law-09-08-rectification-period-article-8');
  const guidanceClaim = claims.claims.find((claim) => claim.id === 'cndp-website-guidance-notification-and-consent');
  assert.equal(metadata.version, '0.1.3');
  assert.equal(metadata.status, 'DRAFT');
  assert.equal(metadata.generator_enabled, false);
  assert.ok(sources.source_ids.includes('cndp-conformite-des-sites-web'));
  assert.equal(directMarketingClaim.current_law_status, 'unresolved');
  assert.equal(directMarketingClaim.legal_review_status, 'not-reviewed');
  assert.match(directMarketingClaim.text, /without charges other than those related to transmitting the refusal/);
  assert.doesNotMatch(directMarketingClaim.text, /free objection option/);
  assert.equal(rectificationPeriodClaim.current_law_status, 'unresolved');
  assert.equal(rectificationPeriodClaim.legal_review_status, 'not-reviewed');
  assert.ok(rectificationPeriodClaim.source_ids.includes('sgg-bo-5714-2009'));
  assert.match(rectificationPeriodClaim.text, /délai franc de dix jours/);
  assert.match(rectificationPeriodClaim.notes, /Do not turn it into a service deadline or promise/);
  assert.ok(sources.source_uses.some((entry) => entry.source_id === 'cndp-conformite-des-sites-web' && entry.use === 'research-reference'));
  assert.equal(guidanceClaim.current_law_status, 'unresolved');
  assert.match(notes, /does not itself prove legal inconsistency/);
  assert.match(guidanceClaim.notes, /does not prove inconsistency/);
  assert.match(english, /Do not treat consent as a universal answer/);
});

test('cookie-notice provenance includes the CNDP sources identified in its review notes', async () => {
  const metadata = await readJson('../templates/privacy/cookie-notice/metadata.yaml');
  const sources = await readJson('../templates/privacy/cookie-notice/sources.yaml');
  const notes = await readFile(new URL('../templates/privacy/cookie-notice/notes.md', import.meta.url), 'utf8');
  const expected = ['cndp-guide-conformite-sites-web-pdf', 'cndp-deliberation-d-939-2025-cookie-data'];
  assert.equal(metadata.version, '0.1.3');
  for (const sourceId of expected) {
    assert.ok(sources.source_ids.includes(sourceId), `source_ids must include ${sourceId}`);
    assert.ok(sources.source_uses.some((entry) => entry.source_id === sourceId && entry.use === 'research-reference'));
  }
  assert.match(notes, /Deliberation D-939-2025/);
  assert.match(notes, /CNDP's website-compliance guide/);
});

test('CI uses a supported Node runtime and immutable GitHub Action references', async () => {
  const packageJson = await readJson('../package.json');
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.equal(packageJson.engines.node, '>=22');
  const actionReferences = [...workflow.matchAll(/^[ \t]*uses:[ \t]*([^\s#]+)(?:[ \t]+#[ \t]*(\S+))?[ \t]*$/gm)];
  assert.ok(actionReferences.length > 0, 'CI must declare its third-party actions');
  for (const [, reference, version] of actionReferences) {
    assert.match(reference, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/, `Action must use an immutable commit SHA: ${reference}`);
    assert.match(version ?? '', /^v\d/, `Pinned action must retain a human-readable version comment: ${reference}`);
  }
  const permissions = workflow.match(/^permissions:\r?\n((?:[ \t]+[^\r\n]*\r?\n)+)/m)?.[1];
  assert.equal(permissions?.trim(), 'contents: read', 'CI must retain read-only repository permissions');
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}\s+# v\d/);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}\s+# v\d/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}\s+# v\d/);
  assert.match(workflow, /name: legal-language-review-packets/);
  assert.match(workflow, /path: dist\/review-packets\//);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /retention-days: 90/);
  const reviewGuide = await readFile(new URL('../REVIEWING.md', import.meta.url), 'utf8');
  assert.match(reviewGuide, /`legal-language-review-packets` artifact/);
  assert.match(reviewGuide, /retains artifacts for 90 days/);
  assert.match(reviewGuide, /Actions → Foundation CI/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /package-manager-cache: false/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /if: github.event_name == 'pull_request'/);
  assert.match(workflow, /BASE_SHA:/);
  assert.match(workflow, /npm run audit:review-transitions/);
  assert.match(workflow, /OLM_LINK_AUDIT_TIMEOUT_MS: 5000/);
  assert.match(workflow, /OLM_LINK_AUDIT_RETRIES: 0/);
});

test('project does not claim an existing legal review', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /No template is marked `LEGAL_REVIEWED`/);
});

test('source JSON Schema validator rejects missing provenance and malformed dates', async () => {
  const source = await readJson('../schemas/source.schema.json');
  const invalid = {
    id: 'source-one', title: 'Source', publisher: 'Publisher', jurisdiction: 'MA',
    source_type: 'official', url: 'not a URL', license_basis: 'research only',
    date_accessed: '2026-02-31', verification_date: null, used_for: [], notes: '',
    verification_status: 'verified'
  };
  const errors = validateJsonSchemaValue(invalid, source);
  assert.ok(errors.some((error) => error.includes('valid URI')));
  assert.ok(errors.some((error) => error.includes('valid YYYY-MM-DD')));
  assert.ok(validateJsonSchemaValue({ ...invalid, verification_status: 'guess' }, source).some((error) => error.includes('verification_status')));
});

test('pinpointed research claims are linked, not marked legally reviewed, and use evidence-specific current-law statuses', async () => {
  const research = await readJson('../research/morocco/claims.json');
  const registry = await readJson('../sources/registry.yaml');
  const schema = await readJson('../schemas/research-claim.schema.json');
  const sourceIds = new Set(registry.sources.map((source) => source.id));
  const adalaLawCopy = registry.sources.find((source) => source.id === 'adala-law-09-08-pdf-2024');
  assert.ok(adalaLawCopy);
  assert.match(adalaLawCopy.notes, /does not establish consolidation/);
  assert.ok(research.claims.length >= 5);
  for (const claim of research.claims) {
    assert.deepEqual(validateJsonSchemaValue(claim, schema), []);
    assert.ok(claim.source_ids.every((sourceId) => sourceIds.has(sourceId)));
    assert.equal(claim.legal_review_status, 'not-reviewed');
    assert.ok(['verified-current', 'unresolved', 'not-applicable'].includes(claim.current_law_status));
  }
  assert.ok(research.claims.some((claim) => claim.current_law_status === 'unresolved'));
  assert.ok(research.claims.some((claim) => claim.id === 'cndp-index-lists-law-and-decree' && claim.source_ids.includes('cndp-textes-et-lois-index') && claim.current_law_status === 'unresolved'));
  const consentClaim = research.claims.find((claim) => claim.id === 'law-09-08-consent-and-exceptions');
  assert.match(consentClaim.text, /general consent rule/);
  assert.equal(consentClaim.current_law_status, 'unresolved');
  const cndpWebsiteGuidance = research.claims.find((claim) => claim.id === 'cndp-website-guidance-notification-and-consent');
  assert.ok(cndpWebsiteGuidance);
  assert.equal(cndpWebsiteGuidance.evidence_status, 'source-text-checked');
  assert.equal(cndpWebsiteGuidance.current_law_status, 'unresolved');
  assert.match(cndpWebsiteGuidance.notes, /Article 4/);
  assert.ok(research.claims.some((claim) => claim.id === 'cese-recommends-revision-law-09-08' && claim.source_ids.includes('sgg-bo-7460-bis-cese-report-2024') && claim.current_law_status === 'not-applicable'));
  const separateProposal = research.claims.find((claim) => claim.id === 'house-records-separate-law-09-08-articles-1-43-proposal-2024');
  assert.ok(separateProposal);
  assert.equal(separateProposal.current_law_status, 'not-applicable');
  assert.ok(separateProposal.source_ids.includes('house-committee-list-law-09-08-articles-1-43-proposal'));
  assert.match(separateProposal.text, /separate Mouvement group proposal/);
});

test('copyright Articles 31 and 35 amendment checks stay scoped and distinguish secondary evidence', async () => {
  const research = await readJson('../research/morocco/claims.json');
  const registry = await readJson('../sources/registry.yaml');
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  for (const claimId of ['law-2-00-authorship-article-31', 'law-2-00-employee-work-article-35']) {
    const claim = research.claims.find((entry) => entry.id === claimId);
    assert.ok(claim, `missing claim ${claimId}`);
    assert.equal(claim.legal_review_status, 'not-reviewed');
    assert.equal(claim.current_law_status, 'unresolved');
    for (const sourceId of [
      'sgg-consolidated-copyright-law-2-00',
      'sgg-bo-5397-law-34-05-copyright',
      'sgg-bo-5400-fr-law-34-05-copyright',
      'wipo-law-79-12-private-copying-amendment',
      'sgg-bo-6263-law-79-12-copyright',
      'sgg-bo-7101-law-66-19-copyright',
      'sgg-bo-7158-fr-law-66-19-copyright'
    ]) assert.ok(claim.source_ids.includes(sourceId), `${claimId} must cite ${sourceId}`);
    assert.match(claim.notes, /scoped checks/i);
    assert.match(claim.notes, /Official Bulletin versions are authoritative/i);
  }
  assert.equal(sourceById.get('sgg-bo-5397-law-34-05-copyright').source_type, 'legislation');
  assert.equal(sourceById.get('sgg-bo-5400-fr-law-34-05-copyright').source_type, 'legislation');
  assert.equal(sourceById.get('sgg-bo-7101-law-66-19-copyright').source_type, 'legislation');
  assert.equal(sourceById.get('sgg-bo-7158-fr-law-66-19-copyright').source_type, 'legislation');
  assert.equal(sourceById.get('sgg-bo-6263-law-79-12-copyright').source_type, 'legislation');
  assert.equal(sourceById.get('sgg-bo-6266-law-79-12-copyright').source_type, 'legislation');
  assert.match(sourceById.get('sgg-consolidated-copyright-law-2-00').notes, /Official Bulletin No\. 4796, dated 18 May 2000, printed p\. 1112/);
  assert.match(sourceById.get('sgg-consolidated-copyright-law-2-00').notes, /underlying SGG-hosted 2000 issue PDF.*unsuccessful/);
  const law7912 = sourceById.get('wipo-law-79-12-private-copying-amendment');
  assert.equal(law7912.source_type, 'secondary-commentary');
  assert.match(law7912.notes, /Official Bulletin No\. 6263/);
  assert.match(law7912.notes, /original Arabic Law 79-12 publication is now verified in SGG Official Bulletin No\. 6263/);
  assert.match(sourceById.get('sgg-bo-6266-law-79-12-copyright').notes, /French translation edition/);
});

test('Law 31-18 DOC amendment record stays tied to its official publication and unresolved current applicability', async () => {
  const registry = await readJson('../sources/registry.yaml');
  const officialMap = await readJson('../sources/official-morocco.yaml');
  const research = await readJson('../research/morocco/claims.json');
  const source = registry.sources.find((entry) => entry.id === 'sgg-bo-6880-law-31-18-doc');
  const claim = research.claims.find((entry) => entry.id === 'law-31-18-doc-amendments-articles-1-2');
  assert.ok(source);
  assert.equal(source.source_type, 'legislation');
  assert.match(source.url, /BO_6880_Fr\.pdf$/);
  assert.match(source.notes, /not a current consolidated DOC/);
  assert.ok(claim);
  assert.deepEqual(claim.source_ids, [source.id]);
  assert.equal(claim.current_law_status, 'unresolved');
  assert.equal(claim.legal_review_status, 'not-reviewed');
  assert.match(claim.notes, /not a current applicability claim|verify later amendments and legal effect/i);
  assert.ok(officialMap.entries.some((entry) => entry.source_id === source.id && entry.topic === 'companies'));
});

test('ICE decree claims remain historical text checks and do not imply a universal contract field', async () => {
  const research = await readJson('../research/morocco/claims.json');
  const registry = await readJson('../sources/registry.yaml');
  const officialMap = await readJson('../sources/official-morocco.yaml');
  const source = registry.sources.find((entry) => entry.id === 'adala-decree-2-11-63-ice');
  const archiveLead = registry.sources.find((entry) => entry.id === 'gazettes-africa-bo-5952-ice-decree-copy');
  const sggCandidate = registry.sources.find((entry) => entry.id === 'sgg-bo-5952-arabic-url-candidate');
  assert.ok(source);
  assert.ok(archiveLead);
  assert.ok(sggCandidate);
  assert.equal(sggCandidate.source_type, 'official');
  assert.equal(sggCandidate.verification_status, 'unavailable');
  assert.match(sggCandidate.notes, /issue number and decree text were not independently inspected/);
  assert.equal(archiveLead.source_type, 'secondary-commentary');
  assert.equal(archiveLead.verification_status, 'unavailable');
  assert.match(archiveLead.notes, /not an authoritative publisher-hosted source/);
  assert.equal(source.source_type, 'legislation');
  assert.match(source.url, /^https:\/\/adala\.justice\.gov\.ma\//);
  assert.match(source.notes, /not the Official Bulletin itself/);
  assert.match(source.notes, /do not establish subsequent amendments/);
  for (const claimId of [
    'decree-2-11-63-ice-system-and-issuance-articles-1-3',
    'decree-2-11-63-ice-data-requested-article-5'
  ]) {
    const claim = research.claims.find((entry) => entry.id === claimId);
    assert.ok(claim, `missing claim ${claimId}`);
    assert.deepEqual(claim.source_ids, ['adala-decree-2-11-63-ice']);
    assert.equal(claim.current_law_status, 'unresolved');
    assert.equal(claim.legal_review_status, 'not-reviewed');
    assert.match(claim.notes, /contract-field requirement|not a checklist of information to collect for a contract/);
  }
  assert.ok(officialMap.entries.some((entry) => entry.source_id === source.id && entry.topic === 'companies'));
  assert.ok(officialMap.entries.some((entry) => entry.source_id === archiveLead.id && entry.topic === 'companies'));
  assert.ok(officialMap.entries.some((entry) => entry.source_id === sggCandidate.id && entry.topic === 'companies'));
});

test('clause taxonomy cannot enable arbitrary composition', async () => {
  const catalog = await readJson('../clauses/catalog.yaml');
  const schema = await readJson('../schemas/clause-catalog.schema.json');
  assert.deepEqual(validateJsonSchemaValue(catalog, schema), []);
  assert.ok(catalog.clauses.length >= 20);
  assert.ok(catalog.clauses.every((clause) => clause.template_eligibility.length === 0));
  assert.ok(validateJsonSchemaValue({ ...catalog, composition_enabled: true }, schema).some((error) => error.includes('composition_enabled')));

  const sourceRegistry = await readJson('../sources/registry.yaml');
  const templateMetadata = await readJson('../templates/business/mutual-nda/metadata.yaml');
  const context = {
    sourceIds: new Set(sourceRegistry.sources.map(({ id }) => id)),
    templateIds: new Set([templateMetadata.id])
  };
  assert.deepEqual(validateClauseCatalogReferences(catalog, context), []);
  const badSourceCatalog = structuredClone(catalog);
  badSourceCatalog.clauses[0].source_ids = ['missing-source'];
  assert.ok(validateClauseCatalogReferences(badSourceCatalog, context).some((error) => error.includes('unknown source')));
  const badTemplateCatalog = structuredClone(catalog);
  badTemplateCatalog.clauses[0].content_status = 'reviewed';
  badTemplateCatalog.clauses[0].template_eligibility = ['mutual-nda'];
  assert.ok(validateClauseCatalogReferences(badTemplateCatalog, context).some((error) => error.includes('cannot advance')));
  badTemplateCatalog.clauses[0].template_eligibility = ['missing-template'];
  assert.ok(validateClauseCatalogReferences(badTemplateCatalog, context).some((error) => error.includes('unknown template')));
});

test('LEGAL_REVIEWED requires an approved, version-matched review record and authorized human', async () => {
  const { privateKey, reviewer } = makeSigningReviewer();
  const contentDigest = digestReviewableContent({ 'en.md': 'Reviewed wording', 'fr.md': 'Texte vérifié' });
  const metadata = {
    id: 'mutual-nda', status: 'LEGAL_REVIEWED', version: '1.0.0',
    legal_review: { status: 'pending', reviewer: null, reviewed_at: null, version: null, review_record_id: null }
  };
  const emptyContext = { authorizedReviewers: [], reviewRecords: [], currentContentDigest: contentDigest };
  assert.ok(validateTemplateReviewPolicy(metadata, emptyContext).some((error) => error.includes('requires legal_review.status')));
  const record = signReviewRecord({
    id: 'legal-mutual-nda-1-0-0', template_id: 'mutual-nda', template_version: '1.0.0',
    review_type: 'legal', reviewer_id: 'reviewer-1', reviewed_at: '2026-10-07',
    languages: ['en', 'fr'], scope: 'Legal meaning of EN and FR text', outcome: 'approved', content_digest: contentDigest
  }, 'reviewer-key-1', privateKey);
  const reviewCandidate = {
    ...metadata,
    legal_review: { status: 'reviewed', reviewer: 'reviewer-1', reviewed_at: '2026-10-07', version: '1.0.0', review_record_id: record.id }
  };
  const context = { authorizedReviewers: [reviewer], reviewRecords: [record], currentContentDigest: contentDigest };
  assert.ok(validateTemplateReviewPolicy(reviewCandidate, { ...context, authorizedReviewers: [] }).some((error) => error.includes('not authorized')));
  assert.deepEqual(validateTemplateReviewPolicy(reviewCandidate, context), []);
  assert.ok(validateTemplateReviewPolicy({ ...reviewCandidate, version: '1.0.1' }, context).some((error) => error.includes('version')));
  assert.ok(validateTemplateReviewPolicy(reviewCandidate, { ...context, currentContentDigest: '0'.repeat(64) }).some((error) => error.includes('content has changed')));
  const reviewSchema = JSON.parse(await readFile(new URL('../schemas/review.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateJsonSchemaValue(record, reviewSchema), []);
});

test('language review requires an authorized reviewer and approved digest-bound record for each reviewed language', () => {
  const { privateKey, reviewer } = makeSigningReviewer('language-reviewer-1', 'language-key-1');
  const contentDigest = 'a'.repeat(64);
  const metadata = {
    id: 'mutual-nda', status: 'LANGUAGE_REVIEWED', version: '1.0.0', languages: ['en'],
    legal_review: { status: 'pending' }, language_review: { en: 'reviewed' },
    language_review_records: { en: 'language-mutual-nda-en-1-0-0' }
  };
  const record = signReviewRecord({
    id: 'language-mutual-nda-en-1-0-0', template_id: 'mutual-nda', template_version: '1.0.0',
    review_type: 'language', reviewer_id: 'language-reviewer-1', reviewed_at: '2026-10-08',
    languages: ['en'], scope: 'English language and meaning review', outcome: 'approved', content_digest: contentDigest
  }, 'language-key-1', privateKey);
  const context = {
    authorizedReviewers: [], authorizedLanguageReviewers: [reviewer],
    reviewRecords: [record], currentContentDigest: contentDigest
  };
  assert.deepEqual(validateTemplateReviewPolicy(metadata, context), []);
  assert.ok(validateTemplateReviewPolicy(metadata, { ...context, authorizedLanguageReviewers: [] }).some((error) => error.includes('not authorized for language review')));
  assert.ok(validateTemplateReviewPolicy(metadata, { ...context, currentContentDigest: 'b'.repeat(64) }).some((error) => error.includes('content has changed')));
  assert.ok(validateTemplateReviewPolicy({ ...metadata, language_review_records: { en: null } }, context).some((error) => error.includes('requires a linked language review record')));
  assert.ok(validateTemplateReviewPolicy({ ...metadata, language_review: { en: 'pending' } }, context).some((error) => error.includes('pending language review must not link')));
});

test('review signatures accept the authorized Ed25519 key and reject tampering, inactive keys, and malformed values', () => {
  const { privateKey, reviewer } = makeSigningReviewer();
  const unsigned = {
    id: 'legal-mutual-nda-1-0-0', template_id: 'mutual-nda', template_version: '1.0.0',
    review_type: 'legal', reviewer_id: reviewer.id, reviewed_at: '2026-10-07',
    languages: ['en'], scope: 'Legal review', outcome: 'approved', content_digest: 'a'.repeat(64)
  };
  const record = signReviewRecord(unsigned, 'reviewer-key-1', privateKey);
  assert.equal(verifyReviewSignature(record, reviewer), null);
  assert.match(verifyReviewSignature({ ...record, outcome: 'changes-requested' }, reviewer), /does not match the record contents/);
  assert.match(verifyReviewSignature(record, {
    ...reviewer,
    signing_keys: reviewer.signing_keys.map((key) => ({ ...key, active: false }))
  }), /not active/);
  assert.match(verifyReviewSignature({ ...record, signature: { ...record.signature, value: 'not base64!' } }, reviewer), /not valid base64/);
  assert.match(verifyReviewSignature({ ...record, signature: { ...record.signature, algorithm: 'RSA' } }, reviewer), /missing an Ed25519 signature/);
});

test('review signing command logic signs an unsigned record and refuses to overwrite an existing signature', () => {
  const { privateKey, reviewer } = makeSigningReviewer();
  const unsignedRecord = {
    id: 'legal-mutual-nda-1-0-0', template_id: 'mutual-nda', template_version: '1.0.0',
    review_type: 'legal', reviewer_id: reviewer.id, reviewed_at: '2026-10-08',
    languages: ['en'], scope: 'Exact English text', outcome: 'approved', content_digest: 'a'.repeat(64)
  };
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const signedRecord = signReviewRecordWithCli(unsignedRecord, 'reviewer-key-1', privateKeyPem);
  assert.deepEqual(verifyReviewSignature(signedRecord, reviewer), null);
  assert.equal(Object.hasOwn(unsignedRecord, 'signature'), false);
  assert.throws(() => signReviewRecordWithCli(signedRecord, 'reviewer-key-1', privateKeyPem), /record already has a signature/);
  assert.throws(() => signReviewRecordWithCli(unsignedRecord, '', privateKeyPem), /key ID is required/);
});

test('research approvals bind the claim and resolved source records and gate verified-current status', () => {
  const { privateKey, reviewer } = makeSigningReviewer('research-reviewer-1', 'research-key-1');
  const sourceRegistry = [{ id: 'official-law', title: 'Official law text', url: 'https://example.gov.ma/law.pdf', verification_status: 'verified' }];
  const claim = {
    id: 'sample-claim', text: 'A bounded proposition from the source.', jurisdiction: 'MA', source_ids: ['official-law'],
    pinpoint: 'Article 1', evidence_status: 'source-text-checked', current_law_status: 'verified-current',
    legal_review_status: 'reviewed', review_record_id: 'sample-claim-review', notes: 'Scoped claim.'
  };
  const unsignedRecord = {
    id: 'sample-claim-review', claim_id: claim.id, reviewer_id: reviewer.id,
    reviewed_at: '2026-10-08', outcome: 'approved', content_digest: digestResearchClaim(claim, sourceRegistry)
  };
  const record = signReviewRecord(unsignedRecord, 'research-key-1', privateKey);
  const context = { reviewRecords: [record], authorizedReviewers: [reviewer], sourceRegistry };
  assert.deepEqual(validateResearchClaimReviewPolicy(claim, context), []);
  assert.ok(validateResearchClaimReviewPolicy({ ...claim, text: 'Changed after review.' }, context).some((error) => /claim or referenced source records changed/.test(error)));
  const changedSourceRegistry = [{ ...sourceRegistry[0], notes: 'Changed source record.' }];
  assert.ok(validateResearchClaimReviewPolicy(claim, { ...context, sourceRegistry: changedSourceRegistry }).some((error) => /claim or referenced source records changed/.test(error)));
  assert.ok(validateResearchClaimReviewPolicy(claim, { ...context, authorizedReviewers: [] }).some((error) => /not authorized/.test(error)));
  assert.ok(validateResearchClaimReviewPolicy({ ...claim, evidence_status: 'secondary-only' }, context).some((error) => /requires source-text-checked evidence/.test(error)));
  assert.ok(validateResearchClaimReviewPolicy({ ...claim, legal_review_status: 'not-reviewed', review_record_id: null }, context).some((error) => /requires an approved human legal review/.test(error)));
});

test('RELEASED requires legal approval and reviewed EN, FR, and AR versions even when generation is disabled', () => {
  const metadata = {
    id: 'fixture', status: 'RELEASED', version: '1.0.0', languages: ['en', 'fr'], generator_enabled: false,
    legal_review: { status: 'pending' }, language_review: { en: 'pending', fr: 'pending' },
    language_review_records: { en: null, fr: null }
  };
  const errors = validateTemplateReviewPolicy(metadata, {
    authorizedReviewers: [], authorizedLanguageReviewers: [], reviewRecords: [], currentContentDigest: 'c'.repeat(64)
  });
  assert.ok(errors.some((error) => error.includes('RELEASED requires legal_review.status to be reviewed')));
  assert.ok(errors.some((error) => error.includes('RELEASED requires the ar language version')));
  assert.ok(errors.some((error) => error.includes('RELEASED requires approved en language review')));
  assert.ok(errors.some((error) => error.includes('RELEASED requires approved fr language review')));
});

test('template variable scanner identifies malformed and undeclared placeholders for package validation', () => {
  const text = 'Between {{party_a_name}} and {{ party_b_name }}; amount {{PaymentAmount}}.';
  assert.deepEqual(findTemplateVariables(text), ['party_a_name', 'party_b_name', 'PaymentAmount']);
  assert.equal(hasUnmatchedTemplateBraces(text), false);
  assert.equal(hasUnmatchedTemplateBraces('broken {{party_a_name'), true);
  assert.equal(hasUnmatchedTemplateBraces('broken party_a_name}}'), true);
  assert.equal(reviewableMetadata({ status: 'DRAFT', legal_review: {}, language_review: {}, language_review_records: {}, version: '0.1.0', jurisdiction: ['MA'] }), '{"jurisdiction":["MA"],"version":"0.1.0"}');
});

test('translation structure catches section variable drift and numbering changes without claiming semantic parity', () => {
  const reference = '<!-- section: parties -->\n## 1. Parties\n{{party_a_name}}\n<!-- section: term -->\n## 2. Term\n{{term_months}}';
  const sameStructure = '<!-- section: parties -->\n## 1. Parties\n{{party_a_name}}\n<!-- section: term -->\n## 2. Term\n{{term_months}}';
  const movedVariable = '<!-- section: parties -->\n## 1. Parties\n{{term_months}}\n<!-- section: term -->\n## 2. Term\n{{party_a_name}}';
  const changedNumbering = '<!-- section: parties -->\n## 1. Parties\n{{party_a_name}}\n<!-- section: term -->\n## 3. Term\n{{term_months}}';
  const missingSectionContent = '<!-- section: parties -->\n## 1. Parties\n<!-- section: term -->\n## 2. Term\n{{term_months}}';
  const bothEmptySections = '<!-- section: parties -->\n## 1. Parties\n<!-- section: term -->\n## 2. Term\n';
  assert.deepEqual(compareTranslationStructure(reference, sameStructure), []);
  assert.ok(compareTranslationStructure(reference, movedVariable).includes('section variable placement differs'));
  assert.ok(compareTranslationStructure(reference, changedNumbering).some((error) => /numbered heading sequence differs/.test(error)));
  assert.ok(compareTranslationStructure(reference, missingSectionContent).includes('every marked section must contain content beyond its heading'));
  assert.ok(compareTranslationStructure(bothEmptySections, bothEmptySections).includes('every marked section must contain content beyond its heading'));
});

test('mutual NDA section 8 rights wording is aligned across languages and remains pending review', async () => {
  const metadata = await readJson('../templates/business/mutual-nda/metadata.yaml');
  const notes = await readFile(new URL('../templates/business/mutual-nda/notes.md', import.meta.url), 'utf8');
  const french = await readFile(new URL('../templates/business/mutual-nda/fr.md', import.meta.url), 'utf8');
  const arabic = await readFile(new URL('../templates/business/mutual-nda/ar.md', import.meta.url), 'utf8');
  const changelog = await readFile(new URL('../templates/business/mutual-nda/CHANGELOG.md', import.meta.url), 'utf8');
  const english = await readFile(new URL('../templates/business/mutual-nda/en.md', import.meta.url), 'utf8');
  assert.equal(metadata.version, '0.1.3');
  assert.equal(metadata.status, 'DRAFT');
  assert.deepEqual(metadata.language_review, { en: 'pending', fr: 'pending', ar: 'pending' });
  assert.match(english, /retains the rights and interests it holds in its Confidential Information\. Disclosure does not transfer ownership/);
  assert.match(french, /conserve les droits et intérêts qu’elle détient sur ses Informations confidentielles\. La divulgation de ces informations n’en transfère pas la propriété/);
  assert.match(arabic, /يحتفظ الطرف المفصح بالحقوق والمصالح التي يملكها في معلوماته السرية، ولا يترتب على الإفصاح عن هذه المعلومات نقل ملكيتها/);
  assert.match(notes, /same intended position/);
  assert.match(notes, /is a drafting choice, not a conclusion about Moroccan law/);
  assert.match(changelog, /## 0\.1\.3 — 2026-10-08/);
  assert.match(changelog, /Legal and language review remain pending/);
});

test('template changelog tracks the current version and date in descending SemVer order', () => {
  const metadata = { version: '1.2.0', last_updated: '2026-10-08' };
  const valid = '# Changelog\n\n## 1.2.0 — 2026-10-08\n\n- Updated content.\n\n## 1.1.0 — 2026-10-01\n\n- Earlier content.\n';
  assert.deepEqual(validateTemplateChangelog(metadata, valid), []);
  assert.ok(validateTemplateChangelog(metadata, valid.replace('## 1.2.0', '## 1.1.0')).some((error) => error.includes('must match metadata version')));
  assert.ok(validateTemplateChangelog(metadata, valid.replace('1.2.0 — 2026-10-08', '1.2.0 — 2026-10-07')).some((error) => error.includes('must match last_updated')));
  assert.ok(validateTemplateChangelog(metadata, valid.replace('## 1.1.0', '## 1.3.0')).some((error) => error.includes('descending SemVer order')));
  assert.ok(validateTemplateChangelog(metadata, '# Changelog'), 'unversioned placeholder must be rejected');
});

test('template source use requires one provenance role per source and blocks uncleared wording reuse', () => {
  const source = { id: 'external-template', reuse_status: 'file-level-review-required', reuse_license: 'CC0 signal only', reuse_scope: 'Repository-level only; source file not reviewed', reuse_review_date: '2026-10-08', verification_status: 'verified' };
  const comparative = { source_ids: ['external-template'], source_uses: [{ source_id: 'external-template', use: 'comparative-reference' }] };
  assert.deepEqual(validateTemplateSourceUsePolicy(comparative, [source]), []);
  assert.match(validateTemplateSourceUsePolicy({ ...comparative, source_uses: [{ source_id: 'external-template', use: 'reused-wording' }] }, [source])[0], /without verified, reviewed reuse authorization/);
  assert.match(validateTemplateSourceUsePolicy({ source_ids: ['external-template'], source_uses: [] }, [source])[0], /no declared use/);
  const cleared = { ...source, url: 'https://example.com/template', reuse_status: 'authorized-for-reuse', reuse_license: 'CC-BY-4.0', reuse_license_url: 'https://creativecommons.org/licenses/by/4.0/', reuse_scope: 'templates/sample.md at commit abc123' };
  const reusedWithoutNotice = { ...comparative, source_uses: [{ source_id: 'external-template', use: 'reused-wording' }] };
  assert.match(validateTemplateSourceUsePolicy(reusedWithoutNotice, [cleared]).join(' '), /requires a attribution notice/);
  const reusedWithNotice = {
    ...comparative,
    source_uses: [{
      source_id: 'external-template', use: 'reused-wording', scope: cleared.reuse_scope,
      attribution: 'External creator, template name and version', license_url: cleared.reuse_license_url,
      modifications: 'Translated into three languages and adapted for this project.'
    }]
  };
  assert.deepEqual(validateTemplateSourceUsePolicy(reusedWithNotice, [cleared]), []);
  assert.match(validateTemplateSourceUsePolicy({ ...reusedWithNotice, source_uses: [{ ...reusedWithNotice.source_uses[0], scope: 'broader than reviewed scope' }] }, [cleared])[0], /scope must exactly match/);
  assert.match(validateTemplateSourceUsePolicy({ ...reusedWithNotice, source_uses: [{ ...reusedWithNotice.source_uses[0], license_url: 'javascript:alert(1)' }] }, [cleared]).join(' '), /must use HTTPS/);
});

test('template research claim links resolve and include every supporting source', () => {
  const sources = {
    source_ids: ['official-law', 'official-bulletin'],
    source_uses: [
      { source_id: 'official-law', use: 'research-reference', claim_ids: ['sample-claim'] },
      { source_id: 'official-bulletin', use: 'research-reference', claim_ids: ['sample-claim'] }
    ]
  };
  const claims = [{ id: 'sample-claim', source_ids: ['official-law', 'official-bulletin'] }];
  assert.deepEqual(validateTemplateSourceClaimPolicy(sources, claims), []);
  assert.match(validateTemplateSourceClaimPolicy(sources, [])[0], /unknown research claim/);
  assert.match(validateTemplateSourceClaimPolicy(sources, [{ ...claims[0], source_ids: ['official-bulletin'] }])[0], /does not cite source official-law/);
  assert.match(validateTemplateSourceClaimPolicy({ ...sources, source_ids: ['official-law'] }, claims)[0], /omits official-bulletin/);
  assert.deepEqual(validateTemplateNoteClaimPolicy(sources, 'Research claim: `sample-claim`.', claims), []);
  assert.match(validateTemplateNoteClaimPolicy({ ...sources, source_uses: [] }, 'Research claim: `sample-claim`.', claims)[0], /must map cited research claim/);
});

test('specific legal instrument references in EN/FR/AR need source-linked research claims', () => {
  const claims = [{
    id: 'law-09-08-article-23',
    text: 'Article 23 of Law 09-08 concerns processing instructions.',
    source_ids: ['official-law']
  }];
  const sources = {
    source_uses: [{ source_id: 'official-law', use: 'research-reference', claim_ids: ['law-09-08-article-23'] }]
  };
  const documents = {
    en: 'Article 23 of Law 09-08 is a source-text check only.',
    fr: 'Loi n° 09-08, article 23 : vérification textuelle uniquement.',
    ar: 'المادة 23 من القانون رقم 09-08: تحقق نصي فقط.'
  };
  assert.deepEqual(validateTemplateLawCitationPolicy(documents, sources, claims), []);
  assert.match(validateTemplateLawCitationPolicy({ en: 'Under Law 09-08.' }, { source_uses: [] }, claims).join(' '), /no matching research claim is linked/);
  assert.match(validateTemplateLawCitationPolicy({ en: 'Under Law 09-08.' }, { source_uses: [] }, []).join(' '), /without a matching research claim/);
  assert.match(validateTemplateLawCitationPolicy({ ar: 'وفق المرسوم رقم 2-09-165.' }, { source_uses: [] }, claims).join(' '), /2-09-165/);
});

test('template package validation checks complete packages and rejects undeclared variables', async () => {
  const fixture = new URL('./fixtures/template-package/', import.meta.url);
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'olm-template-validator-'));
  const validPackage = join(temporaryRoot, 'valid');
  const invalidPackage = join(temporaryRoot, 'invalid');
  try {
    await cp(fixture, validPackage, { recursive: true });
    assert.equal(await validateTemplatePackages(validPackage), 1);
    await cp(fixture, invalidPackage, { recursive: true });
    await writeFile(join(invalidPackage, 'ar.md'), '<!-- section: test -->\n## عينة\n{{undeclared}}', 'utf8');
    await assert.rejects(validateTemplatePackages(invalidPackage), /uses undeclared variable/);
    await rm(invalidPackage, { recursive: true, force: true });
    await cp(fixture, invalidPackage, { recursive: true });
    await writeFile(join(invalidPackage, 'ar.md'), '<!-- section: omitted -->\n## عينة\n{{party_a_name}}', 'utf8');
    await assert.rejects(validateTemplatePackages(invalidPackage), /section structure differs/);
    await rm(invalidPackage, { recursive: true, force: true });
    await cp(fixture, invalidPackage, { recursive: true });
    await writeFile(join(invalidPackage, 'en.md'), '<!-- section: test -->\n## Fixture\n{{party_a_name}} {{party_b_name}}', 'utf8');
    const variablesPath = join(invalidPackage, 'variables.schema.json');
    const variables = JSON.parse(await readFile(variablesPath, 'utf8'));
    variables.variables.push({ name: 'party_b_name', type: 'string', required: true, description: 'Second party name', generator_input: 'factual', maxLength: 100 });
    await writeFile(variablesPath, JSON.stringify(variables), 'utf8');
    await assert.rejects(validateTemplatePackages(invalidPackage), /variable set differs/);
    await rm(invalidPackage, { recursive: true, force: true });
    await cp(fixture, invalidPackage, { recursive: true });
    const metadataPath = join(invalidPackage, 'metadata.yaml');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    delete metadata.title.ar;
    await writeFile(metadataPath, JSON.stringify(metadata), 'utf8');
    await assert.rejects(validateTemplatePackages(invalidPackage), /title translations must match declared languages/);
    await rm(invalidPackage, { recursive: true, force: true });
    await cp(fixture, invalidPackage, { recursive: true });
    const gatedMetadataPath = join(invalidPackage, 'metadata.yaml');
    const gatedMetadata = JSON.parse(await readFile(gatedMetadataPath, 'utf8'));
    gatedMetadata.generator_enabled = true;
    await writeFile(gatedMetadataPath, JSON.stringify(gatedMetadata), 'utf8');
    await assert.rejects(validateTemplatePackages(invalidPackage), /cannot enable generation before RELEASED status/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('renderer validates typed inputs, escapes Markdown syntax, and fails closed for draft packages', async () => {
  const variables = [
    { name: 'name', type: 'string', required: true, description: 'Name', generator_input: 'factual', maxLength: 100 },
    { name: 'date', type: 'date', required: true, description: 'Date', generator_input: 'factual' },
    { name: 'email', type: 'email', required: false, description: 'Email', generator_input: 'factual', maxLength: 254 }
  ];
  assert.doesNotThrow(() => validateInputValues(variables, { name: 'Party', date: '2026-10-07' }));
  assert.throws(() => validateInputValues(variables, { name: 'Party', date: '2026-02-31' }), /valid YYYY-MM-DD/);
  assert.throws(() => validateInputValues(variables, { name: 'Party', date: '2026-10-07', extra: 'unknown' }), /Unknown input variable/);
  assert.throws(() => validateInputValues(variables, { name: 'Party', date: '2026-10-07', email: 'not-an-email' }), /email address/);
  assert.throws(() => validateInputValues(variables, { name: 'Party\nGoverning law: elsewhere', date: '2026-10-07' }), /control characters, line separators/);
  assert.match(validateGeneratorVariablePolicy([{ name: 'legal_terms', type: 'string', required: true, description: 'Terms', generator_input: 'blocked' }]).join(' '), /counsel-controlled wording/);
  assert.match(validateGeneratorVariablePolicy([{ name: 'party', type: 'string', required: true, description: 'Party' }]).join(' '), /no approved generator input classification/);
  assert.match(validateGeneratorVariablePolicy([{ name: 'party', type: 'string', required: true, description: 'Party', generator_input: 'factual' }]).join(' '), /needs a maxLength/);
  assert.match(validateGeneratorVariablePolicy([{ name: 'amount', type: 'number', required: true, description: 'Amount', generator_input: 'factual' }]).join(' '), /number needs a finite minimum/);
  const boundedAmount = { name: 'amount', type: 'number', required: true, description: 'Amount', generator_input: 'factual', minimum: 0, maximum: 1_000_000 };
  assert.deepEqual(validateGeneratorVariablePolicy([boundedAmount]), []);
  assert.doesNotThrow(() => validateInputValues([boundedAmount], { amount: 0 }));
  assert.throws(() => validateInputValues([boundedAmount], { amount: 1_000_001 }), /must be between 0 and 1000000/);
  assert.throws(() => validateInputValues([boundedAmount], { amount: -1 }), /must be between 0 and 1000000/);
  assert.match(validateGeneratorVariablePolicy([{ ...boundedAmount, minimum: 10, maximum: 1 }]).join(' '), /minimum cannot exceed maximum/);
  assert.throws(() => validateInputValues([{ name: 'name', type: 'string', required: true, description: 'Name', generator_input: 'factual', maxLength: 5 }], { name: 'Too long' }), /maxLength 5/);
  assert.equal(escapeMarkdownValue('A|B\n# title'), 'A\\|B \\# title');
  await assert.rejects(
    renderTemplate(fileURLToPath(new URL('./fixtures/template-package/', import.meta.url)), 'en', { party_a_name: 'Party' }),
    /Generation is disabled/);
});

test('DOCX export packages document structure, numbering, version footer, and Arabic RTL', () => {
  const template = {
    metadata: { id: 'reviewed-fixture', version: '1.0.0', title: { en: 'Fixture', ar: 'مثال' } }
  };
  const markdown = '## Agreement\n\nBetween &lt;script&gt; &amp; Party B.\n\n1. First duty.\n2. Second duty.\n\n| Party | Signature |\n| --- | --- |\n| A | __________________ |\n\nSigned by both parties.';
  const englishParts = createDocxXmlParts(template, 'en', markdown);
  assert.match(englishParts['word/document.xml'], /w:pStyle w:val="Heading2"/);
  assert.match(englishParts['word/document.xml'], /w:numId w:val="2"/);
  assert.match(englishParts['word/document.xml'], /Between &lt;script&gt; &amp; Party B/);
  assert.doesNotMatch(englishParts['word/document.xml'], /&amp;lt;script/);
  assert.match(englishParts['word/document.xml'], /<w:tbl>/);
  assert.match(englishParts['word/document.xml'], /Signed by both parties/);
  assert.match(englishParts['word/footer1.xml'], /reviewed-fixture · v1\.0\.0 · en/);
  const plainText = createPlainText(template, 'en', `${markdown}\n\n[Source](https://example.com/source)`);
  assert.match(plainText, /1\. First duty\.\n\n2\. Second duty\./);
  assert.match(plainText, /Open Legal Morocco · reviewed-fixture · v1\.0\.0 · en/);
  assert.match(plainText, /Source \(https:\/\/example\.com\/source\)/);
  assert.doesNotMatch(plainText, /\*\*|\\\./);
  const arabicParts = createDocxXmlParts(template, 'ar', '## اتفاق\n\nتوقيع الطرفين.');
  assert.match(arabicParts['word/document.xml'], /<w:bidi\/>/);
  assert.match(arabicParts['word/document.xml'], /<w:rtl\/>/);
  assert.match(arabicParts['word/footer1.xml'], /v1\.0\.0 · ar/);
  const archive = createDocxBytes(template, 'en', markdown);
  assert.equal(new TextDecoder().decode(archive.slice(0, 4)), 'PK\u0003\u0004');
  assert.ok(archive.length > 1000);
});

test('standalone HTML document renderer escapes raw HTML and renders common legal-document blocks', () => {
  const html = renderMarkdownToHtml('# Agreement\n\nText **bold** with {{party_name}} and `<script>`.\n\n- First\n- Second\n\n| Party | Signer |\n|---|---|\n| A | Name |');
  assert.match(html, /<h2>Agreement<\/h2>/);
  assert.match(renderMarkdownToHtml('## Section', { headingOffset: 0 }), /<h2>Section<\/h2>/);
  assert.match(renderMarkdownToHtml('[Official source](https://example.com/source.pdf)'), /<a href="https:\/\/example\.com\/source\.pdf">Official source<\/a>/);
  assert.doesNotMatch(renderMarkdownToHtml('[Unsafe](javascript:alert(1))'), /href="javascript:/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code class="template-variable">\{\{party_name\}\}<\/code>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<ul><li>First<\/li><li>Second<\/li><\/ul>/);
  assert.match(html, /<th scope="col">Party<\/th>/);
});

test('offline export CLI keeps released-template gates, source notices, and self-contained RTL HTML', async () => {
  const template = { metadata: { id: 'fixture', version: '1.2.3', title: { en: 'Fixture', ar: '<مثال>' } } };
  const html = standaloneHtml(template, 'ar', '# اتفاق\n\nنص آمن.');
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /<title>&lt;مثال&gt;<\/title>/);
  assert.match(html, /نص آمن/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(html, /<script|<img|https?:\/\//);

  const generatedMarkdown = renderGeneratedMarkdown({
    metadata: {
      status: 'RELEASED', legal_review: { status: 'reviewed' }, generator_enabled: true,
      languages: ['en'], language_review: { en: 'reviewed' }, title: { en: 'Fixture' },
      id: 'fixture', version: '1.0.0', license: 'CC0-1.0'
    },
    variables: [], contents: { en: '# Agreement' },
    sources: [{
      source_id: 'licensed-source', use: 'reused-wording',
      reuse_status: 'authorized-for-reuse', reuse_license: 'CC-BY-4.0',
      reuse_scope: 'one reviewed paragraph', reuse_review_date: '2026-10-08', verification_status: 'verified',
      url: 'https://example.org/source', scope: 'one reviewed paragraph',
      attribution: 'Example Source', license_url: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Translated.'
    }]
  }, 'en', {});
  assert.match(generatedMarkdown, /Third-party attribution and license notices/);
  assert.match(generatedMarkdown, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(createPlainText({ metadata: { id: 'fixture', version: '1.0.0' } }, 'en', generatedMarkdown), /Example Source \(https:\/\/example\.org\/source\)/);

  const outputDirectory = await mkdtemp(join(tmpdir(), 'olm-export-test-'));
  const outputPath = join(outputDirectory, 'draft.md');
  try {
    await assert.rejects(exportTemplate({
      templateDirectory: fileURLToPath(new URL('../templates/business/mutual-nda/', import.meta.url)),
      language: 'en', format: 'md', outputPath, values: {}
    }), /has not passed all release and generator input gates/);
    await assert.rejects(readFile(outputPath));
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('project-only export rejects internal Markdown names and content', () => {
  assert.equal(isInternalMarkdownDocument('README.md', '# Open Legal Morocco\n\nProject status and template catalog.'), false);
  assert.equal(isInternalMarkdownDocument('ROADMAP.md', '# Open Legal Morocco'), true);
  assert.equal(isInternalMarkdownDocument('how-to.md', '# Overview'), true);
  assert.equal(isInternalMarkdownDocument('project-notes.md', '# Current direction'), false);
  assert.equal(isInternalMarkdownDocument('notes.md', 'Codex implementation plan'), true);
  assert.equal(isInternalMarkdownDocument('instructions.md', 'How to build the project'), true);
  assert.equal(isInternalMarkdownDocument('notes.md', 'Build instructions'), true);
  assert.equal(isInternalMarkdownDocument('SECURITY.md', 'Run `npm run audit:privacy` to check the project.'), true);
  assert.equal(isInternalMarkdownDocument('notes.md', 'Run `node scripts/validate-foundation.mjs` before release.'), true);
  assert.equal(isInternalMarkdownDocument('CONTRIBUTING.md', 'Contribute Moroccan source research and translation corrections.'), false);
  assert.equal(isInternalMarkdownDocument('CONTRIBUTING.md', 'Run `npm test` before submitting.'), true);
  assert.equal(isInternalMarkdownDocument('development-plan.md', '# Tasks'), true);
});

test('project-only export includes project policies and excludes planning and development guides', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'olm-project-export-'));
  const output = join(outputDirectory, 'project');
  const exportScript = fileURLToPath(new URL('../scripts/export-project-preview.mjs', import.meta.url));
  try {
    await execFileAsync(process.execPath, [exportScript, output, '--preview']);
    const readme = await readFile(join(output, 'README.md'), 'utf8');
    assert.match(readme, /v0\.0\.1 · Early public contribution release/);
    assert.match(readme, /Moroccan lawyers and legal researchers/);
    assert.match(readme, /recognize common legal questions and prepare discussion drafts/);
    assert.match(readme, /does not certify that a business or document is legally compliant/);
    assert.match(readme, /README\.fr\.md/);
    assert.match(readme, /README\.ar\.md/);
    assert.match(readme, /not ready for public reliance/);
    const releaseNotes = await readFile(join(output, 'RELEASE_NOTES.md'), 'utf8');
    assert.match(releaseNotes, /project has no profit-making aim/);
    assert.match(releaseNotes, /not a registered legal status/);
    assert.match(releaseNotes, /does not add a non-commercial restriction/);
    assert.match(releaseNotes, /fourteen structured legal-template discussion drafts/i);
    assert.match(releaseNotes, /no authorized human legal or language review is recorded/i);
    for (const path of ['README.fr.md', 'README.ar.md', 'RELEASE_NOTES.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'REVIEWING.md', 'docs/REVIEWER_ONBOARDING.md', 'GOVERNANCE.md', 'SECURITY.md', 'DISCLAIMER.md', 'LICENSES/README.md', '.github/PULL_REQUEST_TEMPLATE.md', '.github/ISSUE_TEMPLATE/contribution.yml', '.github/ISSUE_TEMPLATE/legal-research.yml', '.github/ISSUE_TEMPLATE/template-defect.yml', '.github/ISSUE_TEMPLATE/reviewer-interest.yml']) {
      await readFile(join(output, path), 'utf8');
      if (path.endsWith('.md') && !path.startsWith('.github/')) assert.match(readme, new RegExp(path.replaceAll('.', '\\.')));
    }
    const contributionIssue = await readFile(join(output, '.github/ISSUE_TEMPLATE/contribution.yml'), 'utf8');
    assert.match(contributionIssue, /Source, authorship, and license provenance review/);
    assert.match(contributionIssue, /Do not include confidential client information/);
    const contributionGuide = await readFile(join(output, 'CONTRIBUTING.md'), 'utf8');
    assert.doesNotMatch(contributionGuide, /npm run|npm test|graphify|ROADMAP|Codex/i);
    assert.match(contributionGuide, /has no contributor license agreement or ownership-assignment process/i);
    assert.match(contributionGuide, /pull request does not itself establish ownership/i);
    assert.match(contributionGuide, /Maintainers must resolve contribution terms and verify rights before merging contributed content/i);
    assert.match(contributionGuide, /authorized human reviewer/);
    const reviewGuide = await readFile(join(output, 'REVIEWING.md'), 'utf8');
    assert.match(readme, /REVIEWING\.md/);
    assert.match(reviewGuide, /no legal or language reviewer is authorized/i);
    assert.match(reviewGuide, /Comments and issue reports are welcome, but they do not change a review status/);
    assert.doesNotMatch(reviewGuide, /npm run|npm test|graphify|Codex|ROADMAP/i);
    const onboarding = await readFile(join(output, 'docs/REVIEWER_ONBOARDING.md'), 'utf8');
    assert.match(readme, /reviewer interest form/);
    assert.match(onboarding, /form and all replies are public/);
    assert.match(onboarding, /registries are currently empty/);
    const reviewerInterestForm = await readFile(join(output, '.github/ISSUE_TEMPLATE/reviewer-interest.yml'), 'utf8');
    assert.match(reviewerInterestForm, /Moroccan legal reviewer/);
    assert.match(reviewerInterestForm, /Community moderator/);
    assert.match(reviewerInterestForm, /issue and all answers are public/);
    const frenchReadme = await readFile(join(output, 'README.fr.md'), 'utf8');
    assert.match(frenchReadme, /repérer les questions juridiques courantes/);
    assert.match(frenchReadme, /professionnel qualifié en droit marocain/);
    assert.match(frenchReadme, /ne certifie pas la conformité juridique/);
    assert.match(frenchReadme, /n’a pas de but lucratif/);
    assert.match(frenchReadme, /aucun évaluateur juridique ou linguistique n’est actuellement autorisé/);
    assert.match(frenchReadme, /CONTRIBUTING\.md/);
    assert.match(frenchReadme, /formulaire public d’intérêt/);
    const arabicReadme = await readFile(join(output, 'README.ar.md'), 'utf8');
    assert.match(arabicReadme, /التعرّف على المسائل القانونية الشائعة/);
    assert.match(arabicReadme, /مهني مؤهل في القانون المغربي/);
    assert.match(arabicReadme, /لا يشهد المشروع بأن أي شركة أو وثيقة متوافقة مع القانون/);
    assert.match(arabicReadme, /لا يهدف المشروع إلى تحقيق الربح/);
    assert.match(arabicReadme, /لا يوجد حاليا مراجع قانوني أو لغوي معتمد/);
    assert.match(arabicReadme, /CONTRIBUTING\.md/);
    assert.match(arabicReadme, /استمارة إبداء الاهتمام العامة/);
    assert.match(arabicReadme, /لم يخضع لمراجعة مستقلة/);
    const pullRequestTemplate = await readFile(join(output, '.github/PULL_REQUEST_TEMPLATE.md'), 'utf8');
    assert.doesNotMatch(pullRequestTemplate, /npm run|npm test|graphify|Codex|ROADMAP/i);
    const licenseReadme = await readFile(join(output, 'LICENSES/README.md'), 'utf8');
    assert.doesNotMatch(licenseReadme, /npm run|graphify|ROADMAP|Codex/i);
    assert.match(licenseReadme, /Reviewer-authored submissions retain their own rights/);
    const exportedScopes = JSON.parse(await readFile(join(output, 'LICENSES/scopes.json'), 'utf8'));
    const exportedPatterns = exportedScopes.rules.flatMap((rule) => rule.patterns);
    assert.ok(exportedPatterns.includes('LICENSES/README.md'));
    assert.ok(exportedPatterns.includes('scripts/**'));
    assert.ok(exportedPatterns.includes('CONTRIBUTING.md'));
    assert.ok(exportedPatterns.includes('REVIEWING.md'));
    assert.ok(exportedPatterns.includes('docs/REVIEWER_ONBOARDING.md'));
    assert.ok(exportedPatterns.includes('RELEASE_NOTES.md'));
    assert.ok(exportedPatterns.includes('README.fr.md'));
    assert.ok(exportedPatterns.includes('README.ar.md'));
    assert.ok(exportedPatterns.includes('.github/PULL_REQUEST_TEMPLATE.md'));
    assert.ok(!exportedPatterns.some((pattern) => /ROADMAP|BUILD|DEVELOPMENT|PLAN/i.test(pattern)));
    for (const path of ['ROADMAP.md']) {
      await assert.rejects(readFile(join(output, path)), { code: 'ENOENT' });
    }
    await assert.rejects(readdir(join(output, 'site')), { code: 'ENOENT' });
    assert.deepEqual(await findBrokenMarkdownLinks(output), []);
    const markdownFiles = [];
    async function collectMarkdown(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await collectMarkdown(path);
        else if (entry.name.toLowerCase().endsWith('.md')) markdownFiles.push(path);
      }
    }
    await collectMarkdown(output);
    for (const path of markdownFiles) {
      const content = await readFile(path, 'utf8');
      assert.equal(isInternalMarkdownDocument(path.split('/').at(-1), content), false, `${path} contains internal planning or development instructions`);
      assert.doesNotMatch(content, /\/home\/[A-Za-z0-9._-]+/, `${path} contains a local home-directory path`);
      assert.doesNotMatch(content, /\/tmp\/open-legal-morocco/i, `${path} contains a local release-workspace path`);
      assert.doesNotMatch(content, /\.codex\b/i, `${path} contains a Codex-local path`);
      assert.doesNotMatch(content, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, `${path} contains a private-key header`);
      assert.doesNotMatch(content, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, `${path} contains a GitHub token-shaped string`);
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('review packet generation binds legal and language forms to exact validated content without approving it', async () => {
  const output = await mkdtemp(join(tmpdir(), 'olm-review-packets-'));
  try {
    const packets = await buildReviewPackets(output);
    assert.equal(packets.templates.length, 14);
    const mutual = packets.templates.find((packet) => packet.templateId === 'nda-mutual');
    assert.ok(mutual);
    assert.match(mutual.contentDigest, /^[a-f0-9]{64}$/);
    const packetRoot = join(output, 'nda-mutual', mutual.version);
    const manifest = JSON.parse(await readFile(join(packetRoot, 'REVIEW_PACKET.json'), 'utf8'));
    const legalForm = await readFile(join(packetRoot, 'LEGAL_REVIEW.md'), 'utf8');
    const signingGuide = await readFile(join(packetRoot, 'SIGNING.md'), 'utf8');
    const arabicForm = await readFile(join(packetRoot, 'LANGUAGE_REVIEW_AR.md'), 'utf8');
    const packetIndex = await readFile(join(output, 'README.md'), 'utf8');
    assert.equal(manifest.content_digest, mutual.contentDigest);
    assert.equal(manifest.prepared_only, true);
    assert.equal(manifest.template_status, 'DRAFT');
    assert.ok(manifest.source_uses.some((entry) => entry.source_id === 'general-legal-templates' && entry.use === 'comparative-reference'));
    assert.match(manifest.reviewable_files.join(' '), /ar\.md/);
    assert.match(legalForm, /no legal reviewers are currently authorized/i);
    assert.match(legalForm, /Signed review record ID and registered Ed25519 key ID/);
    assert.match(signingGuide, /signs the complete JSON record with the Ed25519 key/);
    assert.doesNotMatch(legalForm, /Signature or confirmation method/);
    assert.match(arabicForm, /right-to-left reading order/i);
    assert.match(arabicForm, /Authorized language reviewer ID/);
    assert.match(arabicForm, /Review scope/);
    assert.match(arabicForm, /Review record ID \(assigned by maintainer\)/);
    assert.match(arabicForm, /active in `reviews\/authorized-reviewers\.yaml`/);
    assert.match(packetIndex, /generation is not legal or language review/i);
    assert.match(legalForm, /Declared source uses: general-legal-templates: comparative-reference/);
    assert.doesNotMatch(legalForm, /outcome:\s*approved\s*$/m);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
