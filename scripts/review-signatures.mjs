import { createPublicKey, verify } from 'node:crypto';

function sortForSigning(value) {
  if (Array.isArray(value)) return value.map(sortForSigning);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).filter((key) => key !== 'signature').sort().map((key) => [key, sortForSigning(value[key])]));
  }
  return value;
}

export function reviewSigningPayload(record) {
  return Buffer.from(JSON.stringify(sortForSigning(record)), 'utf8');
}

export function verifyReviewSignature(record, reviewer) {
  const signature = record?.signature;
  if (!signature || signature.algorithm !== 'Ed25519' || typeof signature.key_id !== 'string' || typeof signature.value !== 'string') {
    return 'review record is missing an Ed25519 signature';
  }
  const key = reviewer?.signing_keys?.find((entry) => entry.id === signature.key_id && entry.active);
  if (!key) return `review signing key ${signature.key_id} is not active for the authorized reviewer`;
  try {
    const bytes = Buffer.from(signature.value, 'base64');
    if (!bytes.length || bytes.toString('base64') !== signature.value) return 'review signature is not valid base64';
    if (!verify(null, reviewSigningPayload(record), createPublicKey(key.public_key_pem), bytes)) {
      return 'review signature does not match the record contents';
    }
  } catch {
    return 'review signing key or signature is invalid';
  }
  return null;
}
