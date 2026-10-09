import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJsonSchemaValue } from './schema-validator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function compareSourceChange({ sourceId, previousSha256, currentBytes, retrievedAt = new Date().toISOString() }) {
  if (!/^[a-f0-9]{64}$/.test(previousSha256 ?? '')) throw new Error('previous-sha must be a lowercase SHA-256 digest');
  if (!(currentBytes instanceof Uint8Array)) throw new Error('Current source copy must be provided as bytes');
  if (!Number.isFinite(Date.parse(retrievedAt)) || !retrievedAt.endsWith('Z')) throw new Error('retrieved-at must be a UTC ISO timestamp');

  const [registry, allowlist, schema] = await Promise.all([
    readFile(resolve(root, 'sources/registry.yaml'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'change-tracker/allowlist.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'schemas/change-candidate.schema.json'), 'utf8').then(JSON.parse),
  ]);
  if (!allowlist.source_ids.includes(sourceId)) throw new Error(`Source is not on the manual comparison allowlist: ${sourceId}`);
  const source = registry.sources.find((item) => item.id === sourceId);
  if (!source) throw new Error(`Allowlisted source is missing from the source registry: ${sourceId}`);

  const currentSha256 = createHash('sha256').update(currentBytes).digest('hex');
  const record = {
    schema_version: '1.0.0', source_id: source.id, source_url: source.url,
    issuing_authority: source.publisher ?? null, retrieved_at: retrievedAt,
    previous_sha256: previousSha256, current_sha256: currentSha256,
    change_type: currentSha256 === previousSha256 ? 'no_change' : 'source_copy_changed',
    status: 'candidate_unverified', evidence_url: source.url,
    affected_claim_ids: [], reviewer_notes: null,
    limitations: [
      'Only a locally supplied file checksum was compared; no network retrieval or source authentication was performed.',
      'A changed source copy is not evidence that legislation changed or that any legal interpretation is affected.',
      'Source content was not included in this record; affected claims and legal significance require human review.',
    ],
  };
  const errors = validateJsonSchemaValue(record, schema);
  if (errors.length) throw new Error(`Change candidate failed schema validation: ${errors.join('; ')}`);
  return record;
}
