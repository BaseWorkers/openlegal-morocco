function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function validateTemplateChangelog(metadata, changelog) {
  const entries = [...changelog.matchAll(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})\s*$/gm)];
  const errors = [];
  if (entries.length === 0) return ['must contain a dated SemVer entry'];
  const versions = entries.map((entry) => entry[1]);
  if (new Set(versions).size !== versions.length) errors.push('contains duplicate versions');
  if (entries[0][1] !== metadata.version) errors.push(`latest entry ${entries[0][1]} must match metadata version ${metadata.version}`);
  if (entries[0][2] !== metadata.last_updated) errors.push(`latest entry date ${entries[0][2]} must match last_updated ${metadata.last_updated}`);
  for (let index = 1; index < versions.length; index += 1) {
    if (compareVersions(versions[index - 1], versions[index]) <= 0) {
      errors.push(`entries must be in descending SemVer order (${versions[index - 1]} before ${versions[index]})`);
      break;
    }
  }
  for (const [index, entry] of entries.entries()) {
    const start = entry.index + entry[0].length;
    const end = entries[index + 1]?.index ?? changelog.length;
    if (!/^- .+/m.test(changelog.slice(start, end))) errors.push(`version ${entry[1]} needs at least one dated change bullet`);
  }
  return errors;
}
