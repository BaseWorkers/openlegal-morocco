export function validateTemplateSourceUsePolicy(templateSources, sourceRegistry) {
  const errors = [];
  const references = templateSources.source_uses ?? [];
  const usedIds = references.map((reference) => reference.source_id);
  const declaredIds = templateSources.source_ids ?? [];
  const duplicateIds = usedIds.filter((id, index) => usedIds.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`duplicate source-use entries: ${[...new Set(duplicateIds)].join(', ')}`);
  for (const id of declaredIds) if (!usedIds.includes(id)) errors.push(`source ${id} has no declared use`);
  for (const id of usedIds) if (!declaredIds.includes(id)) errors.push(`source-use entry ${id} is not in source_ids`);
  const registryById = new Map(sourceRegistry.map((source) => [source.id, source]));
  for (const reference of references) {
    const source = registryById.get(reference.source_id);
    if (!source) continue;
    const noticeFields = ['scope', 'attribution', 'license_url', 'modifications'];
    if (reference.use === 'reused-wording') {
      if (
        source.reuse_status !== 'authorized-for-reuse' ||
        !source.reuse_license?.trim() ||
        !source.reuse_scope?.trim() ||
        !source.reuse_review_date ||
        source.verification_status !== 'verified'
      ) errors.push(`source ${reference.source_id} cannot be marked reused-wording without verified, reviewed reuse authorization`);
      for (const field of noticeFields) {
        if (typeof reference[field] !== 'string' || !reference[field].trim()) errors.push(`source ${reference.source_id} reused-wording requires a ${field} notice`);
      }
      if (reference.scope && source.reuse_scope && reference.scope !== source.reuse_scope) {
        errors.push(`source ${reference.source_id} reused-wording scope must exactly match the reviewed source scope`);
      }
      if (reference.license_url !== source.reuse_license_url) {
        errors.push(`source ${reference.source_id} license_url must exactly match the reviewed license URL in the source registry`);
      }
      if (reference.license_url) {
        try {
          if (new URL(reference.license_url).protocol !== 'https:') errors.push(`source ${reference.source_id} license_url must use HTTPS`);
        } catch {
          errors.push(`source ${reference.source_id} license_url must be a valid HTTPS URL`);
        }
      }
      if (source.url) {
        try {
          if (new URL(source.url).protocol !== 'https:') errors.push(`source ${reference.source_id} source URL must use HTTPS for a generated attribution link`);
        } catch {
          errors.push(`source ${reference.source_id} must have a valid HTTPS source URL for a generated attribution link`);
        }
      }
    } else if (noticeFields.some((field) => Object.hasOwn(reference, field))) {
      errors.push(`source ${reference.source_id} may include attribution/license notices only when marked reused-wording`);
    }
  }
  return errors;
}

export function validateTemplateSourceClaimPolicy(templateSources, claimRegistry) {
  const errors = [];
  const claimsById = new Map(claimRegistry.map((claim) => [claim.id, claim]));
  for (const reference of templateSources.source_uses ?? []) {
    const claimIds = reference.claim_ids ?? [];
    if (new Set(claimIds).size !== claimIds.length) {
      errors.push(`source ${reference.source_id} has duplicate claim IDs`);
    }
    for (const claimId of claimIds) {
      const claim = claimsById.get(claimId);
      if (!claim) {
        errors.push(`source ${reference.source_id} refers to unknown research claim ${claimId}`);
      } else if (!claim.source_ids.includes(reference.source_id)) {
        errors.push(`research claim ${claimId} does not cite source ${reference.source_id}`);
      } else {
        for (const claimSourceId of claim.source_ids) {
          if (!(templateSources.source_ids ?? []).includes(claimSourceId)) {
            errors.push(`template source package omits ${claimSourceId}, which supports research claim ${claimId}`);
          }
        }
      }
    }
  }
  return errors;
}

export function validateTemplateNoteClaimPolicy(templateSources, notes, claimRegistry) {
  const errors = [];
  const claimsById = new Map(claimRegistry.map((claim) => [claim.id, claim]));
  const citedClaimIds = new Set(
    [...notes.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((id) => claimsById.has(id))
  );
  const sourcesById = new Map((templateSources.source_uses ?? []).map((reference) => [reference.source_id, reference]));
  for (const claimId of citedClaimIds) {
    const claim = claimsById.get(claimId);
    for (const sourceId of claim.source_ids) {
      if (!(templateSources.source_ids ?? []).includes(sourceId)) {
        errors.push(`template source package omits ${sourceId}, which supports cited claim ${claimId}`);
      }
      if (!(sourcesById.get(sourceId)?.claim_ids ?? []).includes(claimId)) {
        errors.push(`template source ${sourceId} must map cited research claim ${claimId}`);
      }
    }
  }
  return errors;
}

function normalizeInstrumentNumber(value) {
  return value.replace(/[–—.]/g, '-');
}

export function validateTemplateLawCitationPolicy(languageDocuments, templateSources, claimRegistry) {
  const errors = [];
  const linkedClaims = new Set(
    (templateSources.source_uses ?? []).flatMap((reference) => reference.claim_ids ?? [])
  );
  const claimsByInstrument = new Map();
  for (const claim of claimRegistry) {
    const searchable = normalizeInstrumentNumber(`${claim.id} ${claim.text}`.toLowerCase());
    for (const match of searchable.matchAll(/(?:^|[^\p{L}\p{N}])(\d{1,3}-\d{1,3}(?:-\d{1,3})?)(?!\d)/gu)) {
      const instrument = match[1];
      if (!claimsByInstrument.has(instrument)) claimsByInstrument.set(instrument, []);
      claimsByInstrument.get(instrument).push(claim);
    }
  }

  const instrumentPattern = /(?:^|[^\p{L}\p{N}])(?:law|loi|القانون|قانون|decree|décret|dahir|الظهير|ظهير|المرسوم|مرسوم)\s*(?:(?:n[°º.]?|رقم)\s*)?(\d{1,3}[-–—.]\d{1,3}(?:[-–—.]\d{1,3})?)(?!\d)/giu;
  for (const [language, document] of Object.entries(languageDocuments)) {
    const text = document.toLowerCase();
    const citedInstruments = new Set(
      [...text.matchAll(instrumentPattern)].map((match) => normalizeInstrumentNumber(match[1]))
    );
    for (const instrument of citedInstruments) {
      const matchingClaims = claimsByInstrument.get(instrument) ?? [];
      if (matchingClaims.length === 0) {
        errors.push(`${language}.md cites legal instrument ${instrument} without a matching research claim`);
      } else if (!matchingClaims.some((claim) => linkedClaims.has(claim.id))) {
        errors.push(`${language}.md cites legal instrument ${instrument} but no matching research claim is linked by sources.yaml`);
      }
    }
  }
  return errors;
}
