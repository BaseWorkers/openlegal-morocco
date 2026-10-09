#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sensitiveText = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{12,}\b|\bAKIA[0-9A-Z]{16}\b|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;

function assertNoSensitiveText(value, path = '$') {
  if (typeof value === 'string') {
    if (sensitiveText.test(value)) throw new Error(path + ' appears to contain a credential, token, or direct email identifier');
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveText(item, path + '[' + index + ']'));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertNoSensitiveText(item, path + '.' + key);
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} as JSON: ${error.message}`);
  }
}

function validateAdapterInputs(document, taxonomy, controlMapping) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Findings export must be a JSON object');
  assertNoSensitiveText(document);
  if (document.schema_version !== '1.0.0') throw new Error(`Unsupported findings schema version: ${document.schema_version ?? 'missing'}`);
  if (typeof document.generated_at !== 'string' || !document.generated_at.trim()) throw new Error('Findings export must include a generation timestamp');
  if (!document.source || typeof document.source.tool !== 'string' || !document.source.tool.trim() || typeof document.source.version !== 'string' || !document.source.version.trim()) throw new Error('Findings export must identify its source tool and version');
  if (!document.repository || !(document.repository.revision === null || (typeof document.repository.revision === 'string' && document.repository.revision.trim()))) throw new Error('Findings export must include its repository revision or null');
  if (!Array.isArray(document.verification_limitations) || document.verification_limitations.length === 0 || !document.verification_limitations.every((item) => typeof item === 'string' && item.trim())) throw new Error('Findings export must include explicit verification limitations');
  if (!Array.isArray(document.findings)) throw new Error('Findings export must contain a findings array');
  if (!taxonomy || taxonomy.taxonomy_version !== '1.0.0' || !Array.isArray(taxonomy.controls)) throw new Error('Unsupported or invalid control taxonomy');
  if (!controlMapping || typeof controlMapping !== 'object' || Array.isArray(controlMapping)) throw new Error('Control mapping must be a JSON object');

  const knownControls = new Set(taxonomy.controls.map((control) => control?.id).filter((id) => typeof id === 'string'));
  for (const [controlId, targets] of Object.entries(controlMapping)) {
    if (!knownControls.has(controlId)) throw new Error(`Mapping contains unknown vendor-neutral control: ${controlId}`);
    if (typeof targets !== 'string' && (!Array.isArray(targets) || !targets.every((target) => typeof target === 'string'))) {
      throw new Error(`Mapping for ${controlId} must be a string or array of strings`);
    }
  }

  const ids = new Set();
  for (const [index, finding] of document.findings.entries()) {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) throw new Error(`Finding ${index} must be an object`);
    if (finding.schema_version !== document.schema_version) throw new Error(`Finding ${index} schema version does not match the export`);
    if (typeof finding.finding_id !== 'string' || ids.has(finding.finding_id)) throw new Error(`Finding ${index} has a missing or duplicate finding_id`);
    ids.add(finding.finding_id);
    if (finding.priority_basis !== 'technical_remediation') throw new Error(`Finding ${finding.finding_id} has an unsupported priority basis`);
    if (finding.finding_type === 'technical_observation' && finding.legal_question !== null) throw new Error(`Technical observation ${finding.finding_id} must not include a legal conclusion`);
    if (finding.finding_type === 'potential_legal_question' && (typeof finding.legal_question !== 'string' || !finding.legal_question.trim())) throw new Error(`Potential legal question ${finding.finding_id} must retain its unresolved question`);
    if (!['technical_observation', 'potential_legal_question'].includes(finding.finding_type)) throw new Error(`Finding ${finding.finding_id} has an unsupported finding type`);
    for (const controlId of finding.suggested_controls ?? []) {
      if (!knownControls.has(controlId)) throw new Error(`Finding ${finding.finding_id} uses unknown control: ${controlId}`);
    }
  }
}

export async function consumeFindings(findingsPath, taxonomyPath, mappingPath) {
  if (!findingsPath || !taxonomyPath) throw new Error('A findings export and control taxonomy path are required');
  const [document, taxonomy, controlMapping] = await Promise.all([
    readJson(findingsPath, 'findings export'),
    readJson(taxonomyPath, 'control taxonomy'),
    mappingPath ? readJson(mappingPath, 'adapter control mapping') : Promise.resolve({}),
  ]);
  validateAdapterInputs(document, taxonomy, controlMapping);

  return {
    imported_from: document.source,
    repository_revision: document.repository?.revision ?? null,
    generated_at: document.generated_at,
    schema_version: document.schema_version,
    disclaimer: 'Technical priority is remediation sequencing, not legal risk. Potential legal questions remain unresolved; this adapter does not approve legal findings.',
    validation_note: 'This example checks version, identifier, finding-type, priority-basis, and control consistency. Use an independent JSON Schema 2020-12 validator with the published schema for full contract validation.',
    verification_limitations: document.verification_limitations,
    findings: document.findings.map((finding) => ({
      finding_id: finding.finding_id,
      finding_type: finding.finding_type,
      category: finding.category,
      technical_priority: { value: finding.priority, basis: finding.priority_basis },
      description: finding.description,
      legal_question: finding.finding_type === 'potential_legal_question' ? finding.legal_question : null,
      evidence: finding.evidence,
      affected_resources: finding.affected_resources,
      legal_references: finding.legal_references,
      confidence: finding.confidence,
      review_status: finding.review_status,
      suggested_controls: finding.suggested_controls.map((control_id) => ({
        control_id,
        adapter_capabilities: controlMapping[control_id] === undefined
          ? []
          : Array.isArray(controlMapping[control_id]) ? controlMapping[control_id] : [controlMapping[control_id]],
      })),
    })),
  };
}

async function main() {
  const [, , findingsPath, taxonomyPath, mappingPath, ...extra] = process.argv;
  if (!findingsPath || !taxonomyPath || extra.length) {
    throw new Error('Usage: node consume.mjs <findings.json> <control-taxonomy.json> [control-mapping.json]');
  }
  const result = await consumeFindings(findingsPath, taxonomyPath, mappingPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
) {
  if (typeof value === 'string') {
    if (sensitiveText.test(value)) throw new Error(`${path} appears to contain a credential, token, or direct email identifier`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveText(item, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertNoSensitiveText(item, `${path}.${key}`);
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} as JSON: ${error.message}`);
  }
}

function validateAdapterInputs(document, taxonomy, controlMapping) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Findings export must be a JSON object');
  if (document.schema_version !== '1.0.0') throw new Error(`Unsupported findings schema version: ${document.schema_version ?? 'missing'}`);
  if (typeof document.generated_at !== 'string' || !document.generated_at.trim()) throw new Error('Findings export must include a generation timestamp');
  if (!document.source || typeof document.source.tool !== 'string' || !document.source.tool.trim() || typeof document.source.version !== 'string' || !document.source.version.trim()) throw new Error('Findings export must identify its source tool and version');
  if (!document.repository || !(document.repository.revision === null || (typeof document.repository.revision === 'string' && document.repository.revision.trim()))) throw new Error('Findings export must include its repository revision or null');
  if (!Array.isArray(document.verification_limitations) || document.verification_limitations.length === 0 || !document.verification_limitations.every((item) => typeof item === 'string' && item.trim())) throw new Error('Findings export must include explicit verification limitations');
  if (!Array.isArray(document.findings)) throw new Error('Findings export must contain a findings array');
  if (!taxonomy || taxonomy.taxonomy_version !== '1.0.0' || !Array.isArray(taxonomy.controls)) throw new Error('Unsupported or invalid control taxonomy');
  if (!controlMapping || typeof controlMapping !== 'object' || Array.isArray(controlMapping)) throw new Error('Control mapping must be a JSON object');

  const knownControls = new Set(taxonomy.controls.map((control) => control?.id).filter((id) => typeof id === 'string'));
  for (const [controlId, targets] of Object.entries(controlMapping)) {
    if (!knownControls.has(controlId)) throw new Error(`Mapping contains unknown vendor-neutral control: ${controlId}`);
    if (typeof targets !== 'string' && (!Array.isArray(targets) || !targets.every((target) => typeof target === 'string'))) {
      throw new Error(`Mapping for ${controlId} must be a string or array of strings`);
    }
  }

  const ids = new Set();
  for (const [index, finding] of document.findings.entries()) {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) throw new Error(`Finding ${index} must be an object`);
    if (finding.schema_version !== document.schema_version) throw new Error(`Finding ${index} schema version does not match the export`);
    if (typeof finding.finding_id !== 'string' || ids.has(finding.finding_id)) throw new Error(`Finding ${index} has a missing or duplicate finding_id`);
    ids.add(finding.finding_id);
    if (finding.priority_basis !== 'technical_remediation') throw new Error(`Finding ${finding.finding_id} has an unsupported priority basis`);
    if (finding.finding_type === 'technical_observation' && finding.legal_question !== null) throw new Error(`Technical observation ${finding.finding_id} must not include a legal conclusion`);
    if (finding.finding_type === 'potential_legal_question' && (typeof finding.legal_question !== 'string' || !finding.legal_question.trim())) throw new Error(`Potential legal question ${finding.finding_id} must retain its unresolved question`);
    if (!['technical_observation', 'potential_legal_question'].includes(finding.finding_type)) throw new Error(`Finding ${finding.finding_id} has an unsupported finding type`);
    for (const controlId of finding.suggested_controls ?? []) {
      if (!knownControls.has(controlId)) throw new Error(`Finding ${finding.finding_id} uses unknown control: ${controlId}`);
    }
  }
}

export async function consumeFindings(findingsPath, taxonomyPath, mappingPath) {
  if (!findingsPath || !taxonomyPath) throw new Error('A findings export and control taxonomy path are required');
  const [document, taxonomy, controlMapping] = await Promise.all([
    readJson(findingsPath, 'findings export'),
    readJson(taxonomyPath, 'control taxonomy'),
    mappingPath ? readJson(mappingPath, 'adapter control mapping') : Promise.resolve({}),
  ]);
  validateAdapterInputs(document, taxonomy, controlMapping);

  return {
    imported_from: document.source,
    repository_revision: document.repository?.revision ?? null,
    generated_at: document.generated_at,
    schema_version: document.schema_version,
    disclaimer: 'Technical priority is remediation sequencing, not legal risk. Potential legal questions remain unresolved; this adapter does not approve legal findings.',
    validation_note: 'This example checks version, identifier, finding-type, priority-basis, and control consistency. Use an independent JSON Schema 2020-12 validator with the published schema for full contract validation.',
    verification_limitations: document.verification_limitations,
    findings: document.findings.map((finding) => ({
      finding_id: finding.finding_id,
      finding_type: finding.finding_type,
      category: finding.category,
      technical_priority: { value: finding.priority, basis: finding.priority_basis },
      description: finding.description,
      legal_question: finding.finding_type === 'potential_legal_question' ? finding.legal_question : null,
      evidence: finding.evidence,
      affected_resources: finding.affected_resources,
      legal_references: finding.legal_references,
      confidence: finding.confidence,
      review_status: finding.review_status,
      suggested_controls: finding.suggested_controls.map((control_id) => ({
        control_id,
        adapter_capabilities: controlMapping[control_id] === undefined
          ? []
          : Array.isArray(controlMapping[control_id]) ? controlMapping[control_id] : [controlMapping[control_id]],
      })),
    })),
  };
}

async function main() {
  const [, , findingsPath, taxonomyPath, mappingPath, ...extra] = process.argv;
  if (!findingsPath || !taxonomyPath || extra.length) {
    throw new Error('Usage: node consume.mjs <findings.json> <control-taxonomy.json> [control-mapping.json]');
  }
  const result = await consumeFindings(findingsPath, taxonomyPath, mappingPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
