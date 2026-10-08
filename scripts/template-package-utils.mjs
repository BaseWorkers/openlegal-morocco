export function findTemplateVariables(markdown) {
  return [...markdown.matchAll(/\{\{([^{}]*)\}\}/g)].map((match) => match[1].trim());
}

export function hasUnmatchedTemplateBraces(markdown) {
  return markdown.replace(/\{\{[^{}]*\}\}/g, '').includes('{{') || markdown.replace(/\{\{[^{}]*\}\}/g, '').includes('}}');
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  return value;
}

export function reviewableMetadata(metadata) {
  const { status, legal_review, language_review, language_review_records, ...reviewable } = metadata;
  return stableStringify(reviewable);
}

export function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}
