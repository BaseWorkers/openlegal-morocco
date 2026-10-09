import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { renderFindingsMarkdown, validateFindings } from '../scripts/findings.mjs';

const conformance = JSON.parse(await readFile(new URL('./fixtures/findings-contract.json', import.meta.url), 'utf8'));

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

test('priority values have shared technical-urgency meanings and disclaim legal-risk interpretation', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/findings.schema.json', import.meta.url), 'utf8'));
  const properties = schema.$defs.finding.properties;
  assert.deepEqual(properties.priority.enum, ['informational', 'low', 'medium', 'high', 'critical']);
  assert.match(properties.priority.description, /informational records context/);
  assert.match(properties.priority.description, /low is non-urgent/);
  assert.match(properties.priority.description, /medium should be planned/);
  assert.match(properties.priority.description, /high warrants prompt/);
  assert.match(properties.priority.description, /critical warrants urgent containment/);
  assert.match(properties.priority.description, /do not assess legal risk/);
  assert.match(properties.priority_basis.description, /not legal-risk assessment/);
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

test('CLI validator conforms to the shared cross-runtime findings contract cases', async () => {
  for (const document of conformance.valid_documents) assert.deepEqual(await validateFindings(document), []);
  for (const testCase of conformance.invalid_cases) {
    const invalid = structuredClone(conformance.valid_documents[0]);
    Object.assign(invalid.findings[0], testCase.finding_patch ?? {});
    if (testCase.duplicate_first_finding) invalid.findings.push(structuredClone(invalid.findings[0]));
    assert.ok((await validateFindings(invalid)).length > 0, testCase.id);
  }
});

test('standalone adapter consumes exports using only caller-supplied JSON files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'olm-independent-adapter-'));
  try {
    const document = {
      ...conformance.valid_documents[0],
      findings: conformance.valid_documents.flatMap(({ findings }) => findings),
    };
    const taxonomy = JSON.parse(await readFile(new URL('../schemas/control-taxonomy.json', import.meta.url), 'utf8'));
    await writeFile(join(directory, 'findings.json'), JSON.stringify(document));
    await writeFile(join(directory, 'control-taxonomy.json'), JSON.stringify(taxonomy));
    await copyFile(new URL('../examples/findings-adapter/control-mapping.example.json', import.meta.url), join(directory, 'mapping.json'));
    await copyFile(new URL('../examples/findings-adapter/consume.mjs', import.meta.url), join(directory, 'consume.mjs'));

    const adapter = await import(pathToFileURL(join(directory, 'consume.mjs')).href);
    const imported = await adapter.consumeFindings(
      join(directory, 'findings.json'), join(directory, 'control-taxonomy.json'), join(directory, 'mapping.json'),
    );
    assert.equal(imported.schema_version, document.schema_version);
    assert.equal(imported.repository_revision, document.repository.revision);
    assert.equal(imported.findings.length, 2);
    assert.equal(imported.findings[0].technical_priority.basis, 'technical_remediation');
    assert.equal(imported.findings[0].suggested_controls[1].adapter_capabilities[0], 'organization.safe_output_filter');
    assert.equal(imported.findings[1].finding_type, 'potential_legal_question');
    assert.match(imported.findings[1].legal_question, /qualified counsel/);
    assert.equal(imported.findings[1].review_status.human_review, 'pending');
    assert.match(imported.disclaimer, /does not approve legal findings/);
    assert.match(imported.validation_note, /full contract validation/);

    const invalid = structuredClone(document);
    invalid.findings[0].suggested_controls = ['vendor_product'];
    await writeFile(join(directory, 'invalid.json'), JSON.stringify(invalid));
    await assert.rejects(adapter.consumeFindings(
      join(directory, 'invalid.json'), join(directory, 'control-taxonomy.json'), join(directory, 'mapping.json'),
    ), /unknown control/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
