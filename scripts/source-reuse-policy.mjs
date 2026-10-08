export function validateSourceReusePolicy(source) {
  const errors = [];
  if (source.reuse_status === 'authorized-for-reuse') {
    if (!source.reuse_license?.trim()) errors.push('reuse authorization requires an exact license');
    if (!source.reuse_license_url?.trim() || !isHttpsUrl(source.reuse_license_url)) errors.push('reuse authorization requires the exact license terms URL over HTTPS');
    if (!source.reuse_scope?.trim()) errors.push('reuse authorization requires an exact file or content scope');
    if (!source.reuse_review_date) errors.push('reuse authorization requires a review date');
    if (source.verification_status !== 'verified') errors.push('reuse authorization requires verified provenance');
  }
  if (source.reuse_status === 'file-level-review-required') {
    if (!source.reuse_license?.trim()) errors.push('file-level review must state the observed license signal');
    if (!source.reuse_scope?.trim()) errors.push('file-level review must state the scope not yet reviewed');
    if (!source.reuse_review_date) errors.push('file-level review requires an audit date');
  }
  if (source.reuse_status === 'license-reference') {
    if (!source.reuse_license?.trim()) errors.push('license reference requires an exact license identifier');
    if (!source.reuse_scope?.trim()) errors.push('license reference requires the scope of the license check');
    if (!source.reuse_review_date) errors.push('license reference requires a review date');
  }
  if (source.reuse_status === 'research-only' && (source.reuse_license !== null || source.reuse_scope !== null || source.reuse_review_date !== null)) {
    errors.push('research-only records cannot imply reuse permission');
  }
  return errors;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateReuseRevisionPolicy(source) {
  if (source.reuse_status === 'authorized-for-reuse' && !source.reuse_revision?.trim()) {
    return ['reuse authorization requires an immutable source revision or edition'];
  }
  return [];
}
