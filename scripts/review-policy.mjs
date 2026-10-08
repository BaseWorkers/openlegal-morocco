import { createHash } from 'node:crypto';
import { verifyReviewSignature } from './review-signatures.mjs';

export function digestReviewableContent(files) {
  const entries = Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const canonical = entries.map(([path, contents]) => `${path}\0${contents}`).join('\0');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function resolveReviewSourceRecords(sourceIds, sourceRegistry) {
  const recordsById = new Map(sourceRegistry.map((source) => [source.id, source]));
  return [...sourceIds].sort().map((sourceId) => {
    const record = recordsById.get(sourceId);
    if (!record) throw new Error(`Cannot resolve review source record ${sourceId}`);
    return record;
  });
}

export function validateTemplateReviewPolicy(metadata, { authorizedReviewers, authorizedLanguageReviewers = [], reviewRecords, currentContentDigest }) {
  const errors = [];
  const review = metadata.legal_review ?? {};
  if (['LEGAL_REVIEWED', 'RELEASED'].includes(metadata.status) && review.status !== 'reviewed') {
    errors.push(`${metadata.status} requires legal_review.status to be reviewed`);
  }
  if (metadata.status === 'RELEASED') {
    for (const requiredLanguage of ['en', 'fr', 'ar']) {
      if (!metadata.languages?.includes(requiredLanguage)) errors.push(`RELEASED requires the ${requiredLanguage} language version`);
      if (metadata.language_review?.[requiredLanguage] !== 'reviewed') errors.push(`RELEASED requires approved ${requiredLanguage} language review`);
    }
  }
  if (review.status === 'reviewed') {
    if (!review.reviewer) errors.push('a reviewed template requires a reviewer ID');
    if (!review.reviewed_at) errors.push('a reviewed template requires a review date');
    if (!review.version) errors.push('a reviewed template requires the reviewed version');
    if (review.version && review.version !== metadata.version) errors.push('the reviewed version must match template metadata.version');
    const reviewer = authorizedReviewers.find((entry) => entry.id === review.reviewer && entry.active);
    if (review.reviewer && !reviewer) errors.push(`reviewer ${review.reviewer} is not authorized`);
    const record = reviewRecords.find((entry) => entry.id === review.review_record_id);
    if (!review.review_record_id || !record) errors.push('a reviewed template requires a linked review record');
    if (record) {
      if (record.review_type !== 'legal' || record.outcome !== 'approved') errors.push('linked record must be an approved legal review');
      if (record.template_id !== metadata.id) errors.push('review record template ID does not match metadata');
      if (record.template_version !== metadata.version || record.template_version !== review.version) errors.push('review record version does not match metadata');
      if (record.reviewer_id !== review.reviewer) errors.push('review record reviewer does not match metadata');
      if (record.reviewed_at !== review.reviewed_at) errors.push('review record date does not match metadata');
      if (reviewer && reviewer.authorized_at > record.reviewed_at) errors.push('legal reviewer must have been authorized on or before the review date');
      if (reviewer) {
        const signatureError = verifyReviewSignature(record, reviewer);
        if (signatureError) errors.push(signatureError);
      }
      if (!currentContentDigest || record.content_digest !== currentContentDigest) errors.push('reviewed content has changed or no current digest was supplied');
    }
  }

  for (const language of metadata.languages ?? []) {
    const state = metadata.language_review?.[language];
    const recordId = metadata.language_review_records?.[language];
    if (state !== 'reviewed') {
      if (recordId !== null && recordId !== undefined) errors.push(`${language} pending language review must not link an approval record`);
      continue;
    }
    if (!recordId) {
      errors.push(`${language} reviewed state requires a linked language review record`);
      continue;
    }
    const record = reviewRecords.find((entry) => entry.id === recordId);
    if (!record) {
      errors.push(`${language} language review record ${recordId} does not exist`);
      continue;
    }
    if (record.review_type !== 'language' || record.outcome !== 'approved') errors.push(`${language} record must be an approved language review`);
    if (record.template_id !== metadata.id) errors.push(`${language} review record template ID does not match metadata`);
    if (record.template_version !== metadata.version) errors.push(`${language} review record version does not match metadata`);
    if (!record.languages?.includes(language)) errors.push(`${language} review record does not include this language`);
    const reviewer = authorizedLanguageReviewers.find((entry) => entry.id === record.reviewer_id && entry.active);
    if (!reviewer) errors.push(`${language} reviewer ${record.reviewer_id} is not authorized for language review`);
    if (reviewer && reviewer.authorized_at > record.reviewed_at) errors.push(`${language} reviewer must have been authorized on or before the review date`);
    if (reviewer) {
      const signatureError = verifyReviewSignature(record, reviewer);
      if (signatureError) errors.push(`${language} ${signatureError}`);
    }
    if (!currentContentDigest || record.content_digest !== currentContentDigest) errors.push(`${language} reviewed content has changed or no current digest was supplied`);
  }
  return errors;
}
