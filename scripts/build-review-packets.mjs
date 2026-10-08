import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { digestReviewableContent, resolveReviewSourceRecords } from './review-policy.mjs';
import { digestResearchClaim, reviewableResearchClaim, validateResearchClaimReviewPolicy } from './research-claim-policy.mjs';
import { reviewableMetadata, stableStringify } from './template-package-utils.mjs';
import { validateJsonSchemaValue } from './schema-validator.mjs';
import { validateTemplatePackages } from './validate-template-packages.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const execFileAsync = promisify(execFile);

async function sourceDiff(paths) {
  const base = process.env.BASE_SHA;
  if (base && !/^[0-9a-f]{40,64}$/i.test(base)) throw new Error('BASE_SHA must be a full Git commit hash');
  const relativePaths = paths.map((path) => relative(root, path).split(sep).join('/'));
  const args = ['diff', '--no-ext-diff', '--no-textconv', '--unified=3', base ?? 'HEAD', '--', ...relativePaths];
  if (!base) {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], { cwd: root, timeout: 15000 });
    } catch (error) {
      const details = `${error.stderr ?? ''}\n${error.message}`;
      if (/not a git repository|Needed a single revision|unknown revision|bad revision/i.test(details)) {
        return { base: 'unavailable (project has no Git history yet)', patch: '(No Git baseline is available; review the complete listed package contents.)\n' };
      }
      throw error;
    }
  }
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: root, timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
    return { base: base ?? 'HEAD', patch: stdout || '(No tracked changes relative to diff base.)\n' };
  } catch (error) {
    const details = `${error.stderr ?? ''}\n${error.message}`;
    if (!base && /Could not access 'HEAD'|ambiguous argument 'HEAD'|not a git repository/i.test(details)) {
      return { base: 'unavailable (project has no Git history yet)', patch: '(No Git baseline is available; review the complete listed package contents.)\n' };
    }
    throw error;
  }
}

async function packageDiff(packageDirectory) {
  return sourceDiff([packageDirectory]);
}

async function findPackages(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findPackages(path));
    else if (entry.name === 'metadata.yaml') found.push(dirname(path));
  }
  return found;
}

function extractSections(markdown) {
  const sections = [];
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const marker = /^<!-- section: ([a-z0-9-]+) -->$/.exec(lines[index]);
    if (!marker) continue;
    const heading = lines.slice(index + 1).find((line) => /^#{1,6}\s+/.test(line));
    sections.push({ id: marker[1], heading: heading?.replace(/^#{1,6}\s+/, '').trim() ?? marker[1] });
  }
  return sections;
}

function escapeMarkdownInline(value) {
  const visibleText = String(value)
    .replace(/[\r\n\t\p{Cc}]+/gu, ' ')
    .replace(/\p{Bidi_Control}/gu, (character) => `[U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]`)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return visibleText.replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

async function writeFileAt(directory, name, content) {
  const destination = join(directory, name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, 'utf8');
}

async function buildPacket(packageDirectory, outputRoot, sourceRegistry) {
  const metadata = JSON.parse(await readFile(join(packageDirectory, 'metadata.yaml'), 'utf8'));
  const variablesText = await readFile(join(packageDirectory, 'variables.schema.json'), 'utf8');
  const sourcesText = await readFile(join(packageDirectory, 'sources.yaml'), 'utf8');
  const notesText = await readFile(join(packageDirectory, 'notes.md'), 'utf8');
  const changelogText = await readFile(join(packageDirectory, 'CHANGELOG.md'), 'utf8');
  const sourcePackage = JSON.parse(sourcesText);
  const sourceIds = sourcePackage.source_ids;
  const reviewableSources = resolveReviewSourceRecords(sourceIds, sourceRegistry);
  const sourceUseSummary = sourcePackage.source_uses.map(({ source_id, use }) => `${source_id}: ${use}`).join('; ');
  const reviewableFiles = {
    'variables.schema.json': variablesText,
    'sources.yaml': sourcesText,
    'source-records.json': `${JSON.stringify(reviewableSources, null, 2)}\n`,
    'notes.md': notesText,
    'CHANGELOG.md': changelogText,
    'metadata.json': reviewableMetadata(metadata)
  };
  const texts = {};
  for (const language of metadata.languages) {
    texts[language] = await readFile(join(packageDirectory, `${language}.md`), 'utf8');
    reviewableFiles[`${language}.md`] = texts[language];
  }
  const contentDigest = digestReviewableContent(reviewableFiles);
  const diff = await packageDiff(packageDirectory);
  const sections = extractSections(texts.en ?? texts[metadata.languages[0]]);
  const destination = join(outputRoot, metadata.id, metadata.version);
  await mkdir(destination, { recursive: true });

  const manifest = {
    packet_schema_version: 1,
    template_id: metadata.id,
    template_version: metadata.version,
    template_status: metadata.status,
    generated_from: relative(root, packageDirectory).split(sep).join('/'),
    content_digest: contentDigest,
    change_diff_file: 'CHANGE_DIFF.patch',
    change_diff_base: diff.base,
    languages: metadata.languages,
    source_ids: sourceIds,
    source_uses: sourcePackage.source_uses,
    sections,
    reviewable_files: Object.keys(reviewableFiles).sort(),
    prepared_only: true,
    legal_review_status: metadata.legal_review.status,
    language_review_status: metadata.language_review
  };
  await writeFileAt(destination, 'REVIEW_PACKET.json', `${JSON.stringify(manifest, null, 2)}\n`);

  const packetTitle = escapeMarkdownInline(metadata.title.en ?? metadata.title[metadata.languages[0]]);
  const sectionsList = sections.map(({ id, heading }) => `- \`${id}\` — ${escapeMarkdownInline(heading)}`).join('\n');
  const languageList = metadata.languages.map((language) => `- ${language}: ${metadata.language_review[language]}`).join('\n');
  const instructions = `# Review packet — ${packetTitle}\n\n**Preparation only.** This packet is not a review, approval, legal opinion, or public release. Do not change the repository review state based on packet generation.\n\n- Template: \`${metadata.id}\`\n- Version: \`${metadata.version}\`\n- Current status: \`${metadata.status}\`\n- Content digest: \`${contentDigest}\`\n- Languages: ${metadata.languages.join(', ')}\n- Source IDs: ${sourceIds.join(', ')}\n- Declared source uses: ${sourceUseSummary}\n- Legal review status: \`${metadata.legal_review.status}\`\n- Language review states:\n${languageList}\n\n## What is included\n\n- The exact language Markdown files, variable schema, template source declarations, resolved central source-registry records, and review notes used for the digest above.\n- A legal review response form and one language review form per declared language.\n- A machine-readable packet manifest.\n\n## Reviewer instructions\n\n1. Confirm the template ID, version, language scope, and digest before starting. If the repository content changes, request a new packet.\n2. Review both the template source declarations and the included source-registry records; distinguish source text from current-law conclusions and legal analysis.\n3. Record findings and changes requested. A suggested clause or translation change must be incorporated, revalidated, and reviewed against a newly generated digest.\n4. Submit a completed review record that conforms to the repository review schema. An authorized maintainer must independently verify the reviewer, scope, outcome, version, date, and digest before updating registries.\n\n## Legal review checklist\n\n- [ ] Confirm current applicable law from authoritative sources and record pinpoints.\n- [ ] Assess scope, interpretation, mandatory rules, and transaction-specific assumptions.\n- [ ] Review every section for legal effect, omissions, conflicts, and enforceability.\n- [ ] Review variables, optional fields, and how blank or populated values affect meaning.\n- [ ] Record findings, unresolved questions, and a clear outcome.\n\n## Sections in the English reference\n\n${sectionsList}\n\n## Reviewer details and outcome\n\n- Reviewer name / authorized ID:\n- Qualifications and jurisdictional experience:\n- Conflicts disclosed:\n- Date completed (YYYY-MM-DD):\n- Languages reviewed:\n- Scope reviewed:\n- Outcome (approved / changes-requested / informational):\n- Findings and required changes:\n- Signed review record ID and registered Ed25519 key ID:\n\n**Current governance limitation:** no legal reviewers are currently authorized in the repository. A completed form alone cannot authorize the legally reviewed status; reviewer authorization and a valid review record are required.\n`;
  await writeFileAt(destination, 'LEGAL_REVIEW.md', instructions);
  await writeFileAt(destination, 'SIGNING.md', '# Review record signing\n\nA legal or language review record does not establish approval until the authorized reviewer signs the complete JSON record with the Ed25519 key registered for their reviewer ID. A maintainer must add and verify the reviewer public key in the base branch reviewer registry before the approval can pass pull-request CI.\n\nGenerate keys with `openssl genpkey -algorithm Ed25519 -out reviewer-private.pem` and `openssl pkey -in reviewer-private.pem -pubout -out reviewer-public.pem`. Keep the private key under the reviewer\'s control; never commit or share it. Put only the public key in the maintainer-approved registry. Complete an unsigned record that matches the review schema, then sign it with `node scripts/sign-review-record.mjs <unsigned-record.json> <key-id> <private-key.pem>`; the command writes the signed record to standard output. The signature covers all record fields, including reviewer ID, outcome, date, scope, and content digest. It proves control of the registered key and integrity of the record, not qualifications or review quality.\n');

  for (const language of metadata.languages) {
    await writeFileAt(destination, `${language}.md`, texts[language]);
    const languageForm = `# ${language.toUpperCase()} language review — ${metadata.id} ${metadata.version}\n\n**Preparation only.** Completing this form does not change template status. Review the exact source file \`${language}.md\` in this packet.\n\n- Template ID: \`${metadata.id}\`\n- Template version: \`${metadata.version}\`\n- Language under review: \`${language}\`\n- Content digest: \`${contentDigest}\`\n- Authorized language reviewer ID (must be active in \`reviews/authorized-reviewers.yaml\`):\n- Reviewer name / language qualifications:\n- Date completed (YYYY-MM-DD):\n- Review scope:\n- Reference language(s): ${metadata.languages.filter((item) => item !== language).join(', ') || 'not applicable'}\n- Outcome (approved / changes-requested / informational):\n- Review record ID (assigned by maintainer):\n\n## Review checks\n\n- [ ] Meaning and obligations match the source-language text.\n- [ ] Defined terms, cross-references, dates, durations, and variables match.\n- [ ] No material is omitted or added, including qualifications or warnings.\n- [ ] Grammar, legal terminology, register, and local usage are appropriate.\n- [ ] Arabic layout and right-to-left reading order are suitable, where applicable.\n\n## Section-by-section findings\n\n${sections.map(({ id, heading }) => `### ${id} — ${escapeMarkdownInline(heading)}\n\n- Meaning parity: [ ] confirmed [ ] issue\n- Terminology / wording findings:\n- Proposed correction (if any):\n`).join('\n')}\n## Overall findings\n\n- Blocking issues:\n- Non-blocking suggestions:\n- Final outcome:\n- Reviewer confirmation:\n`;
    await writeFileAt(destination, `LANGUAGE_REVIEW_${language.toUpperCase()}.md`, languageForm);
  }
  await writeFileAt(destination, 'variables.schema.json', variablesText);
  await writeFileAt(destination, 'sources.yaml', sourcesText);
  await writeFileAt(destination, 'source-records.json', reviewableFiles['source-records.json']);
  await writeFileAt(destination, 'notes.md', notesText);
  await writeFileAt(destination, 'CHANGELOG.md', changelogText);
  await writeFileAt(destination, 'CHANGE_DIFF.patch', diff.patch);
  await writeFileAt(destination, 'metadata.yaml', await readFile(join(packageDirectory, 'metadata.yaml'), 'utf8'));
  return { templateId: metadata.id, version: metadata.version, contentDigest, outputDirectory: destination };
}

async function buildResearchClaimPackets(outputRoot, sourceRegistry) {
  const claimsPackage = JSON.parse(await readFile(join(root, 'research/morocco/claims.json'), 'utf8'));
  const reviewPackage = JSON.parse(await readFile(join(root, 'reviews/research-records.json'), 'utf8'));
  const reviewers = JSON.parse(await readFile(join(root, 'reviews/authorized-reviewers.yaml'), 'utf8'));
  const claimSchema = JSON.parse(await readFile(join(root, 'schemas/research-claim.schema.json'), 'utf8'));
  const reviewSchema = JSON.parse(await readFile(join(root, 'schemas/research-review.schema.json'), 'utf8'));
  const claimIds = new Set();
  const reviewIds = new Set();
  if (claimsPackage.schema_version !== 1 || reviewPackage.schema_version !== 1) throw new Error('research claim or review registry schema version is unsupported');
  if (!Array.isArray(claimsPackage.claims) || !Array.isArray(reviewPackage.reviews)) throw new Error('research claim or review registry entries must be arrays');
  for (const [index, record] of reviewPackage.reviews.entries()) {
    const errors = validateJsonSchemaValue(record, reviewSchema);
    if (errors.length) throw new Error(`research review record ${index} invalid: ${errors.join('; ')}`);
    if (reviewIds.has(record.id)) throw new Error(`duplicate research review record ID ${record.id}`);
    reviewIds.add(record.id);
  }
  const registeredClaimIds = new Set(claimsPackage.claims.map((claim) => claim.id));
  for (const record of reviewPackage.reviews) if (!registeredClaimIds.has(record.claim_id)) throw new Error(`research review ${record.id} refers to unknown claim ${record.claim_id}`);
  const researchRoot = join(outputRoot, 'research-claims');
  await mkdir(researchRoot, { recursive: true });
  const diff = await sourceDiff([join(root, 'research/morocco/claims.json'), join(root, 'sources/registry.yaml')]);
  await writeFileAt(researchRoot, 'CHANGE_DIFF.patch', diff.patch);
  const packets = [];
  for (const [index, claim] of claimsPackage.claims.entries()) {
    const errors = validateJsonSchemaValue(claim, claimSchema);
    if (errors.length) throw new Error(`research claim ${index} invalid: ${errors.join('; ')}`);
    if (claimIds.has(claim.id)) throw new Error(`duplicate research claim ID ${claim.id}`);
    claimIds.add(claim.id);
    const policyErrors = validateResearchClaimReviewPolicy(claim, {
      reviewRecords: reviewPackage.reviews,
      authorizedReviewers: reviewers.authorized_legal_reviewers,
      sourceRegistry
    });
    if (policyErrors.length) throw new Error(`research claim ${claim.id} review policy invalid: ${policyErrors.join('; ')}`);
    const sources = resolveReviewSourceRecords(claim.source_ids, sourceRegistry);
    const contentDigest = digestResearchClaim(claim, sourceRegistry);
    const destination = join(researchRoot, claim.id);
    const reviewableFiles = ['claim.json', 'source-records.json'];
    const manifest = {
      packet_schema_version: 1,
      review_type: 'research-claim-legal',
      claim_id: claim.id,
      jurisdiction: claim.jurisdiction,
      source_ids: claim.source_ids,
      evidence_status: claim.evidence_status,
      current_law_status: claim.current_law_status,
      legal_review_status: claim.legal_review_status,
      content_digest: contentDigest,
      reviewable_files: reviewableFiles,
      change_diff_file: '../CHANGE_DIFF.patch',
      change_diff_base: diff.base,
      prepared_only: true
    };
    await writeFileAt(destination, 'REVIEW_PACKET.json', `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFileAt(destination, 'claim.json', stableStringify(reviewableResearchClaim(claim)));
    await writeFileAt(destination, 'source-records.json', `${JSON.stringify(sources, null, 2)}\n`);
    const sourceList = sources.map((source) => `- \`${escapeMarkdownInline(source.id)}\` — ${escapeMarkdownInline(source.title)} (${escapeMarkdownInline(source.source_type)}; ${escapeMarkdownInline(source.verification_status)})`).join('\n');
    const form = `# Research claim legal review — ${escapeMarkdownInline(claim.id)}\n\n**Preparation only.** This packet is not legal review, a current-law conclusion, or an approval. Use the exact machine-readable materials and digest below; do not update claim status from packet generation.\n\n- Claim ID: \`${claim.id}\`\n- Jurisdiction: ${escapeMarkdownInline(claim.jurisdiction)}\n- Evidence status: \`${claim.evidence_status}\`\n- Current-law status: \`${claim.current_law_status}\`\n- Current review status: \`${claim.legal_review_status}\`\n- Content digest: \`${contentDigest}\`\n- Change diff: [shared claims and source-registry patch](../CHANGE_DIFF.patch), relative to \`${diff.base}\` (context only; not part of digest)\n\n## Proposition under review\n\n> ${escapeMarkdownInline(claim.text)}\n\n- Pinpoint: ${escapeMarkdownInline(claim.pinpoint)}\n- Research notes: ${escapeMarkdownInline(claim.notes)}\n\n## Bound source records\n\n${sourceList}\n\nThe full resolved records, including URLs, license signals, verification history, and reuse status, are in \`source-records.json\`. The exact claim is in \`claim.json\`.\n\n## Review checks\n\n- [ ] Confirm the cited source and pinpoint directly; distinguish publication text from current-law status.\n- [ ] Reconcile amendments, commencement, authoritative versions, and relevant later sources before marking law current.\n- [ ] Assess whether the proposition accurately states the source and separates text from interpretation.\n- [ ] Check that source rights, scope, and provenance are accurately represented.\n- [ ] Record limitations, unresolved questions, and any narrower approved scope.\n- [ ] Confirm the digest matches the exact claim and source records reviewed.\n\n## Reviewer details and outcome\n\n- Authorized legal reviewer ID (must already be active):\n- Authorization date:\n- Reviewer qualifications / jurisdictional experience:\n- Conflicts disclosed:\n- Date completed (YYYY-MM-DD):\n- Outcome (approved / changes-requested / informational):\n- Findings and unresolved questions:\n- Research review record ID:\n- Reviewer confirmation:\n\n**Current governance limitation:** no legal reviewers are authorized. A completed form alone cannot change claim status; a valid record in \`reviews/research-records.json\` and maintainer verification are required.\n`;
    await writeFileAt(destination, 'LEGAL_REVIEW.md', form);
    await writeFileAt(destination, 'SIGNING.md', '# Research review record signing\n\nA research review record must include an Ed25519 signature from the authorized reviewer key. A maintainer must add and verify the reviewer public key in the base branch reviewer registry before the approval can pass pull-request CI.\n\nGenerate keys with `openssl genpkey -algorithm Ed25519 -out reviewer-private.pem` and `openssl pkey -in reviewer-private.pem -pubout -out reviewer-public.pem`. Keep the private key under the reviewer\'s control; never commit or share it. Put only the public key in the maintainer-approved registry. Complete an unsigned record that matches the review schema, then sign it with `node scripts/sign-review-record.mjs <unsigned-record.json> <key-id> <private-key.pem>`; the command writes the signed record to standard output. The signature covers all record fields, including claim ID, reviewer ID, outcome, date, and content digest. It proves control of the registered key and integrity of the record, not qualifications or review quality.\n');
    packets.push({ claimId: claim.id, contentDigest, outputDirectory: destination });
  }
  const index = ['# Prepared research claim review packets', '', 'Preparation only. These packets do not confirm current law or constitute legal review.', '', ...packets.map((packet) => `- [${escapeMarkdownInline(packet.claimId)}](./${packet.claimId}/LEGAL_REVIEW.md) — digest \`${packet.contentDigest}\``), ''].join('\n');
  await writeFileAt(researchRoot, 'README.md', index);
  return packets;
}

export async function buildReviewPackets(outputDirectory = join(root, 'dist/review-packets')) {
  const templatesDirectory = join(root, 'templates');
  const sourceRegistryPackage = JSON.parse(await readFile(join(root, 'sources/registry.yaml'), 'utf8'));
  await validateTemplatePackages(templatesDirectory, sourceRegistryPackage);
  const sourceRegistry = sourceRegistryPackage.sources;
  const outputRoot = resolve(outputDirectory);
  const packets = [];
  for (const packageDirectory of await findPackages(templatesDirectory)) packets.push(await buildPacket(packageDirectory, outputRoot, sourceRegistry));
  const researchPackets = await buildResearchClaimPackets(outputRoot, sourceRegistry);
  const index = ['# Prepared review packets', '', 'These packets were generated from current, validated package contents. Generation is not legal or language review.', '', '## Templates', '', ...packets.map((packet) => `- [${packet.templateId} ${packet.version}](./${packet.templateId}/${packet.version}/LEGAL_REVIEW.md) — digest \`${packet.contentDigest}\``), '', '## Research claims', '', `[Prepared research claim packets](./research-claims/README.md) — ${researchPackets.length} claims`, ''].join('\n');
  await writeFileAt(outputRoot, 'README.md', index);
  return { templates: packets, researchClaims: researchPackets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const packets = await buildReviewPackets();
    console.log(`Prepared ${packets.templates.length} template packets and ${packets.researchClaims.length} research claim packets in ${join(root, 'dist/review-packets')}`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
