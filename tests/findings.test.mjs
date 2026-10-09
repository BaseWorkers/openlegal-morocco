import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderFindingsMarkdown, validateFindings } from '../scripts/findings.mjs';

const finding = {
  finding_id: 'scan-001', finding_type: 'technical_observation', category: 'data-handling',
  priority: 'medium', priority_basis: 'technical_remediation',
  description: 'A request handler writes a user-provided field to an application log.',
  legal_question: null,
  evidence: [{ summary: 'The handler passes the request field to the logger.', source_reference: { kind: 'repository_file', path: 'src/handler.js', line_start: 42, line_end: 42, content_digest: null }, verification_status: 'verified' }],
  affected_resources: [{ type: 'file', identifier: 'src/handler.js' }], legal_references: [],
  suggested_controls: ['data_minimization', 'redaction'],
  review_status: { verification: 'verified', human_review: 'not_requested' }, confidence: null, schema_version: '1.0.0',
};
const document = {
  schema_version: '1.0.0', generated_at: '2026-10-09T10:00:00Z',
  source: { tool: 'example-agent', version: '0.1.0' }, repository: { revision: 'abc123' },
  verification_limitations: ['No legal review was performed.'], findings: [finding],
};

test('findings export validates against the published schema and renders the distinction clearly', async () => {
  assert.deepEqual(await validateFindings(document), []);
  const markdown = renderFindingsMarkdown(document);
  assert.match(markdown, /Technical priority describes remediation sequencing only/);
  assert.match(markdown, /technical_observation/);
  assert.match(markdown, /src\/handler\.js:42/);
});

test('findings reject unknown controls, incorrect legal priority framing, and sensitive patterns', async () => {
  const invalid = structuredClone(document);
  invalid.findings[0].priority_basis = 'legal_risk';
  invalid.findings[0].suggested_controls = ['vendor_product'];
  invalid.findings[0].description = 'Email alice@example.org';
  const errors = await validateFindings(invalid);
  assert.ok(errors.some((item) => item.includes('priority_basis')));
  assert.ok(errors.some((item) => item.includes('unknown control')));
  assert.ok(errors.some((item) => item.includes('direct email')));
});

test('findings reject duplicate identifiers even when the finding objects differ', async () => {
  const duplicate = structuredClone(document);
  duplicate.findings.push({ ...structuredClone(finding), description: 'A distinct observation using the same identifier.' });
  const errors = await validateFindings(duplicate);
  assert.ok(errors.some((item) => item.includes('duplicate finding_id')));
});

test('findings validator returns schema errors for a non-array findings field', async () => {
  const errors = await validateFindings({ ...document, findings: null });
  assert.ok(errors.some((item) => item.includes('must be array')));
});

test('findings reject sensitive identifiers in references and metadata fields', async () => {
  const unsafe = structuredClone(document);
  unsafe.findings[0].description = 'A handler writes a field to a log.';
  unsafe.findings[0].evidence[0].source_reference.path = 'private/alice@example.org.log';
  const errors = await validateFindings(unsafe);
  assert.ok(errors.some((item) => item.includes('$.findings[0].evidence[0].source_reference.path')));
});
