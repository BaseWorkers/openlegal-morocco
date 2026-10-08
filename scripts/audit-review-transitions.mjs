import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateResearchClaimReviewPolicy } from './research-claim-policy.mjs';
import { verifyReviewSignature } from './review-signatures.mjs';

export function validateReviewStatusTransition(previousStatus, nextStatus, transitions) {
  if (previousStatus === nextStatus) return [];
  if (!transitions[previousStatus]?.includes(nextStatus)) {
    return [`invalid review status transition ${previousStatus} -> ${nextStatus}`];
  }
  return [];
}

export function validateNewTemplateStatus(metadata) {
  const errors = [];
  if (metadata.status !== 'DRAFT') errors.push('new template packages must start in DRAFT');
  if (metadata.legal_review?.status !== 'pending') errors.push('new template packages cannot import a legal-review approval');
  if (metadata.languages?.some((language) => metadata.language_review?.[language] !== 'pending')) {
    errors.push('new template packages cannot import language-review approvals');
  }
  if (metadata.generator_enabled !== false) errors.push('new template packages must start with generation disabled');
  return errors;
}

export function validateReviewAuthorityAgainstBase(metadata, reviewRecords, authorizedReviewers, authorizedLanguageReviewers) {
  const errors = [];
  const legalReview = metadata.legal_review ?? {};
  if (legalReview.status === 'reviewed') {
    const record = reviewRecords.find((entry) => entry.id === legalReview.review_record_id);
    const reviewer = authorizedReviewers.find((entry) => entry.id === legalReview.reviewer && entry.active);
    if (!reviewer) errors.push(`legal reviewer ${legalReview.reviewer ?? '(missing)'} was not active in the PR base reviewer registry`);
    if (!record || record.review_type !== 'legal' || record.outcome !== 'approved' || record.reviewer_id !== legalReview.reviewer) {
      errors.push('legal approval must link an approved legal review by the same base-authorized reviewer');
    }
    if (reviewer && record && reviewer.authorized_at > record.reviewed_at) errors.push('legal reviewer was not authorized by the recorded review date in the PR base registry');
    if (reviewer && record) {
      const signatureError = verifyReviewSignature(record, reviewer);
      if (signatureError) errors.push(`legal ${signatureError}`);
    }
  }
  for (const language of metadata.languages ?? []) {
    if (metadata.language_review?.[language] !== 'reviewed') continue;
    const recordId = metadata.language_review_records?.[language];
    const record = reviewRecords.find((entry) => entry.id === recordId);
    const reviewer = record && authorizedLanguageReviewers.find((entry) => entry.id === record.reviewer_id && entry.active);
    if (!reviewer) errors.push(`${language} reviewer ${record?.reviewer_id ?? '(missing)'} was not active in the PR base language-review registry`);
    if (!record || record.review_type !== 'language' || record.outcome !== 'approved' || record.template_id !== metadata.id || record.template_version !== metadata.version || !record.languages?.includes(language)) {
      errors.push(`${language} approval must link a matching approved language review`);
    }
    if (reviewer && record && reviewer.authorized_at > record.reviewed_at) errors.push(`${language} reviewer was not authorized by the recorded review date in the PR base registry`);
    if (reviewer && record) {
      const signatureError = verifyReviewSignature(record, reviewer);
      if (signatureError) errors.push(`${language} ${signatureError}`);
    }
  }
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function auditReviewTransitions() {
  const baseSha = process.env.BASE_SHA;
  if (!/^[a-f0-9]{40,64}$/.test(baseSha ?? '')) {
    throw new Error('BASE_SHA must contain the pull request base commit SHA');
  }
  const transitions = JSON.parse(await readFile(new URL('../schemas/review-transitions.json', import.meta.url), 'utf8'));
  const baseReviewers = JSON.parse(git(['show', `${baseSha}:reviews/authorized-reviewers.yaml`]));
  const currentReviewRecords = JSON.parse(await readFile(new URL('../reviews/records.json', import.meta.url), 'utf8')).reviews;
  const currentResearchReviewRecords = JSON.parse(await readFile(new URL('../reviews/research-records.json', import.meta.url), 'utf8')).reviews;
  const currentResearchClaims = JSON.parse(await readFile(new URL('../research/morocco/claims.json', import.meta.url), 'utf8')).claims;
  const currentSourceRegistry = JSON.parse(await readFile(new URL('../sources/registry.yaml', import.meta.url), 'utf8')).sources;
  const trackedTemplateMetadata = git(['ls-files', '--', 'templates'])
    .split(/\r?\n/)
    .filter((path) => path.startsWith('templates/') && path.endsWith('/metadata.yaml'));
  const approvalErrors = [];
  for (const path of trackedTemplateMetadata) {
    const metadata = JSON.parse(await readFile(path, 'utf8'));
    approvalErrors.push(...validateReviewAuthorityAgainstBase(
      metadata,
      currentReviewRecords,
      baseReviewers.authorized_legal_reviewers,
      baseReviewers.authorized_language_reviewers
    ).map((error) => `${path}: ${error}`));
  }
  for (const claim of currentResearchClaims) {
    approvalErrors.push(...validateResearchClaimReviewPolicy(claim, {
      reviewRecords: currentResearchReviewRecords,
      authorizedReviewers: baseReviewers.authorized_legal_reviewers,
      sourceRegistry: currentSourceRegistry
    }).map((error) => `research claim ${claim.id}: ${error}`));
  }
  const changed = git(['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...HEAD`, '--', 'templates'])
    .split(/\r?\n/)
    .filter((path) => path.startsWith('templates/') && path.endsWith('/metadata.yaml'));
  const errors = [...approvalErrors];
  for (const path of changed) {
    const metadata = JSON.parse(await readFile(path, 'utf8'));
    let previousText;
    try {
      previousText = git(['show', `${baseSha}:${path}`]);
    } catch {
      errors.push(...validateNewTemplateStatus(metadata).map((error) => `${path}: ${error}`));
      continue;
    }
    const previous = JSON.parse(previousText);
    errors.push(...validateReviewStatusTransition(previous.status, metadata.status, transitions).map((error) => `${path}: ${error}`));
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Review transition audit passed for ${changed.length} changed template package(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await auditReviewTransitions();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
