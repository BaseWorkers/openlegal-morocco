import { digestReviewableContent, resolveReviewSourceRecords } from './review-policy.mjs';
import { verifyReviewSignature } from './review-signatures.mjs';
import { stableStringify } from './template-package-utils.mjs';

export function reviewableResearchClaim(claim) {
  const { legal_review_status, review_record_id, ...reviewableClaim } = claim;
  return reviewableClaim;
}

export function digestResearchClaim(claim, sourceRegistry) {
  const sources = resolveReviewSourceRecords(claim.source_ids, sourceRegistry);
  return digestReviewableContent({
    'claim.json': stableStringify(reviewableResearchClaim(claim)),
    'source-records.json': `${JSON.stringify(sources, null, 2)}\n`
  });
}

export function validateResearchClaimReviewPolicy(claim, { reviewRecords, authorizedReviewers, sourceRegistry }) {
  const errors = [];
  const { legal_review_status: status, review_record_id: recordId } = claim;
  const requiresRecord = status === 'reviewed' || status === 'review-pending';
  if (requiresRecord && !recordId) errors.push(`${status} claim requires a linked research review record`);
  if (!requiresRecord && recordId !== null && recordId !== undefined) errors.push(`${status} claim must not link a research review record`);

  if (claim.current_law_status === 'verified-current') {
    if (claim.evidence_status !== 'source-text-checked') errors.push('verified-current claim requires source-text-checked evidence');
    if (status !== 'reviewed') errors.push('verified-current claim requires an approved human legal review');
  }
  if (!requiresRecord || !recordId) return errors;

  const record = reviewRecords.find((entry) => entry.id === recordId);
  if (!record) return [...errors, `research review record ${recordId} does not exist`];
  if (record.claim_id !== claim.id) errors.push('research review record claim ID does not match');
  const approved = record.outcome === 'approved';
  if (status === 'reviewed' && !approved) errors.push('reviewed claim requires an approved research review record');
  if (status === 'review-pending' && approved) errors.push('approved research review must be reflected in claim review status');
  const reviewer = authorizedReviewers.find((entry) => entry.id === record.reviewer_id && entry.active);
  if (!reviewer) errors.push(`research reviewer ${record.reviewer_id} is not authorized`);
  if (reviewer && reviewer.authorized_at > record.reviewed_at) errors.push('research reviewer must have been authorized on or before the review date');
  if (reviewer) {
    const signatureError = verifyReviewSignature(record, reviewer);
    if (signatureError) errors.push(signatureError);
  }
  const expectedDigest = digestResearchClaim(claim, sourceRegistry);
  if (record.content_digest !== expectedDigest) errors.push('research claim or referenced source records changed after review');
  return errors;
}
