import { readFile } from 'node:fs/promises';
import { createPrivateKey, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { reviewSigningPayload } from './review-signatures.mjs';

export function signReviewRecord(record, keyId, privateKeyPem) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('review record must be a JSON object');
  if (typeof keyId !== 'string' || !keyId.trim()) throw new Error('key ID is required');
  if (record.signature) throw new Error('record already has a signature; remove it before signing an updated record');
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('private key must use Ed25519');
  return {
    ...record,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: sign(null, reviewSigningPayload(record), privateKey).toString('base64')
    }
  };
}

async function signRecord() {
  const [recordPath, keyId, privateKeyPath] = process.argv.slice(2);
  if (!recordPath || !keyId || !privateKeyPath || process.argv.length !== 5) {
    throw new Error('Usage: node scripts/sign-review-record.mjs <unsigned-record.json> <key-id> <private-key.pem>');
  }
  const record = JSON.parse(await readFile(recordPath, 'utf8'));
  const signedRecord = signReviewRecord(record, keyId, await readFile(privateKeyPath));
  process.stdout.write(`${JSON.stringify(signedRecord, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await signRecord();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
