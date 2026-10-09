import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateJsonSchemaValue } from './schema-validator.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(root, 'schemas/findings.schema.json');
const taxonomyPath = resolve(root, 'schemas/control-taxonomy.json');

export async function findingsSpecification() {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const taxonomy = JSON.parse(await readFile(taxonomyPath, 'utf8'));
  const schemaControls = schema.$defs.finding.properties.suggested_controls.items.enum;
  const taxonomyControls = taxonomy.controls.map(({ id }) => id);
  if (JSON.stringify(schemaControls) !== JSON.stringify(taxonomyControls)) throw new Error('Findings schema control identifiers do not match the published taxonomy');
  return { schema, taxonomy };
}

export async function validateFindings(value) {
  const { schema, taxonomy } = await findingsSpecification();
  const errors = validateJsonSchemaValue(value, schema);
  const knownControls = new Set(taxonomy.controls.map(({ id }) => id));
  value?.findings?.forEach((finding, index) => {
    if (finding.finding_type === 'potential_legal_question' && (typeof finding.legal_question !== 'string' || !finding.legal_question.trim())) errors.push(`$.findings[${index}].legal_question is required for a potential legal question`);
    if (finding.finding_type === 'technical_observation' && finding.legal_question !== null) errors.push(`$.findings[${index}].legal_question must be null for a technical observation`);
    for (const control of finding.suggested_controls ?? []) {
      if (!knownControls.has(control)) errors.push(`$.findings[${index}].suggested_controls contains unknown control: ${control}`);
    }
    for (const [field, text] of [['description', finding.description], ['legal_question', finding.legal_question], ...((finding.evidence ?? []).map((item, itemIndex) => [`evidence[${itemIndex}].summary`, item.summary]))]) {
      if (typeof text !== 'string') continue;
      if (/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{12,}|\bAKIA[0-9A-Z]{16}\b|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i.test(text)) {
        errors.push(`$.findings[${index}].${field} appears to contain a credential, token, or direct email identifier`);
      }
    }
  });
  return errors;
}

export function renderFindingsMarkdown(document) {
  const lines = [
    '# Structured Findings', '',
    `Schema version: ${document.schema_version}`,
    `Generated: ${document.generated_at}`,
    `Source: ${document.source.tool} ${document.source.version}`,
    `Repository revision: ${document.repository.revision ?? 'unavailable'}`,
    '',
    '> Technical priority describes remediation sequencing only. It is not a legal-risk assessment or legal conclusion.',
    '> Evidence summaries must be sanitized; this export does not contain raw evidence payloads.', '',
  ];
  for (const finding of document.findings) {
    lines.push(`## ${finding.finding_id} — ${finding.finding_type}`, '',
      `- Category: ${finding.category}`,
      `- Technical priority: ${finding.priority}`,
      `- Review: verification=${finding.review_status.verification}; human=${finding.review_status.human_review}`,
      `- Confidence: ${finding.confidence ?? 'not measured'}`,
      `- Description: ${finding.description}`);
    if (finding.legal_question) lines.push(`- Potential legal question: ${finding.legal_question}`);
    for (const evidence of finding.evidence) {
      const ref = evidence.source_reference;
      const location = ref.path ? `${ref.path}${ref.line_start ? `:${ref.line_start}${ref.line_end && ref.line_end !== ref.line_start ? `-${ref.line_end}` : ''}` : ''}` : ref.kind;
      lines.push(`- Evidence (${evidence.verification_status}): ${evidence.summary} [${location}]`);
    }
    for (const ref of finding.legal_references) lines.push(`- Legal reference (${ref.verification_status}): ${ref.title}${ref.pinpoint ? `, ${ref.pinpoint}` : ''}${ref.uri ? ` — ${ref.uri}` : ''}`);
    if (finding.affected_resources.length) lines.push(`- Affected resources: ${finding.affected_resources.map(({ identifier }) => identifier).join(', ')}`);
    if (finding.suggested_controls.length) lines.push(`- Suggested vendor-neutral controls: ${finding.suggested_controls.join(', ')}`);
    lines.push('');
  }
  lines.push('## Verification limitations', '', ...(document.verification_limitations.map((item) => `- ${item}`)), '');
  return `${lines.join('\n')}\n`;
}
