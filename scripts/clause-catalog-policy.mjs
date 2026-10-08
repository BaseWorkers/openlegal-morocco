export function validateClauseCatalogReferences(catalog, { sourceIds, templateIds }) {
  const errors = [];
  const seenClauseIds = new Set();

  if (catalog.composition_enabled !== false) {
    errors.push('clause composition must remain disabled until its independent review gate is implemented');
  }

  for (const clause of catalog.clauses ?? []) {
    if (seenClauseIds.has(clause.id)) errors.push(`duplicate clause id: ${clause.id}`);
    seenClauseIds.add(clause.id);

    for (const sourceId of clause.source_ids ?? []) {
      if (!sourceIds.has(sourceId)) errors.push(`clause ${clause.id} refers to unknown source ${sourceId}`);
    }

    for (const templateId of clause.template_eligibility ?? []) {
      if (!templateIds.has(templateId)) errors.push(`clause ${clause.id} refers to unknown template ${templateId}`);
    }

    if (clause.content_status === 'taxonomy-only' && (clause.source_ids?.length || clause.template_eligibility?.length)) {
      errors.push(`taxonomy-only clause ${clause.id} cannot claim sources or template eligibility before clause-level review exists`);
    }
    if (clause.content_status !== 'taxonomy-only') {
      errors.push(`clause ${clause.id} cannot advance beyond taxonomy-only until clause-level human review records are supported`);
    }
  }

  return errors;
}
