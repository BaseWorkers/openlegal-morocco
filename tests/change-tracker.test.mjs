import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compareSourceChange } from '../scripts/change-tracker.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

test('changed local copies produce schema-shaped unverified hash-only candidates', async () => {
  const record = await compareSourceChange({
    sourceId: 'sgg-bo-5714-2009',
    previousSha256: digest('previous synthetic source'),
    currentBytes: Buffer.from('current synthetic source'),
    retrievedAt: '2026-10-09T12:00:00Z',
  });

  assert.equal(record.change_type, 'source_copy_changed');
  assert.equal(record.status, 'candidate_unverified');
  assert.equal(record.current_sha256, digest('current synthetic source'));
  assert.deepEqual(record.affected_claim_ids, []);
  assert.ok(record.limitations.some((item) => item.includes('not evidence that legislation changed')));
  assert.equal(Object.hasOwn(record, 'content'), false);
});

test('identical digests are reported as no change', async () => {
  const bytes = Buffer.from('synthetic source copy');
  const record = await compareSourceChange({
    sourceId: 'cndp-loi-09-08', previousSha256: digest(bytes), currentBytes: bytes,
    retrievedAt: '2026-10-09T12:00:00Z',
  });

  assert.equal(record.change_type, 'no_change');
  assert.equal(record.current_sha256, record.previous_sha256);
});

test('comparison rejects sources outside the local allowlist and malformed digests', async () => {
  await assert.rejects(compareSourceChange({
    sourceId: 'spdx-mit', previousSha256: digest('old'), currentBytes: Buffer.from('new'),
  }), /not on the manual comparison allowlist/);
  await assert.rejects(compareSourceChange({
    sourceId: 'sgg-bo-5714-2009', previousSha256: 'not-a-hash', currentBytes: Buffer.from('new'),
  }), /lowercase SHA-256 digest/);
});
