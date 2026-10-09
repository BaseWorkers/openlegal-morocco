import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCredentialRuleIds } from '../scripts/audit-secrets.mjs';

test('secrets audit detects high-signal credentials without returning their values', () => {
  const samples = [
    `AWS_ACCESS_KEY_ID=AKIA${'A'.repeat(16)}`,
    `token=ghp_${'B'.repeat(36)}`,
    `Authorization: Bearer ${'C'.repeat(30)}`,
    `${'-----BEGIN ' + 'PRIVATE KEY-----'}\n${'D'.repeat(40)}\n-----END PRIVATE KEY-----`,
  ].join('\n');
  assert.deepEqual(findCredentialRuleIds(samples), ['private-key', 'aws-access-key', 'github-token', 'bearer-token']);
  assert.deepEqual(findCredentialRuleIds('Use a synthetic key placeholder such as <TOKEN> in documentation.'), []);
});
