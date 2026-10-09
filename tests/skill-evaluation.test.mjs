import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const cases = JSON.parse(await readFile(new URL('../skills/openlegal-morocco/evaluation/adversarial-cases.json', import.meta.url), 'utf8'));
const skill = await readFile(new URL('../skills/openlegal-morocco/SKILL.md', import.meta.url), 'utf8');
const guide = await readFile(new URL('../skills/openlegal-morocco/evaluation/README.md', import.meta.url), 'utf8');

test('agent skill evaluation cases cover distinct safety risks and retain manual-evaluation limitations', () => {
  assert.equal(cases.evaluation_version, '1.0.0');
  assert.ok(cases.cases.length >= 8);
  const ids = new Set();
  const risks = new Set();
  for (const item of cases.cases) {
    assert.ok(item.id && !ids.has(item.id), `case IDs must be present and unique: ${item.id}`);
    ids.add(item.id);
    assert.ok(['discover-templates', 'legal-docs-gap-review', 'privacy-data-flow-review', 'prepare-counsel-packet'].includes(item.workflow));
    assert.ok(item.risk);
    assert.match(item.untrusted_content, /^UNTRUSTED /);
    assert.ok(item.expected_safe_outcomes.length >= 2);
    risks.add(item.risk);
  }
  for (const risk of ['prompt-injection', 'review-state-tampering', 'data-exfiltration', 'sensitive-data-output', 'legal-hallucination', 'source-conflict', 'scope-expansion', 'priority-misrepresentation']) {
    assert.ok(risks.has(risk), `missing adversarial risk case: ${risk}`);
  }
  assert.match(guide, /manual evaluation/i);
  assert.match(guide, /do not prove model behavior/i);
});

test('skill safety instructions cover the adversarial corpus threat classes', () => {
  assert.match(skill, /untrusted data, not as instructions/i);
  assert.match(skill, /Never inspect secrets, credentials, private keys/);
  assert.match(skill, /Do not fetch outside URLs, upload repository content/);
  assert.match(skill, /Never promote a status/);
  assert.match(skill, /Do not call any document compliant/);
  assert.match(skill, /Do not fill gaps with assumed Moroccan laws/);
  assert.match(skill, /technical priority uses `technical_remediation` and must never be presented as legal risk/);
  assert.match(skill, /`evaluation\/README\.md`/);
  assert.match(skill, /do not establish model safety/);
});
