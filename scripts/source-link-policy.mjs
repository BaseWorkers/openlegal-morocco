// Only domains already reviewed for the source registry may trigger CI requests.
// Additions require a deliberate code review so registry edits cannot choose an
// arbitrary outbound destination.
export const ALLOWED_SOURCE_LINK_HOSTS = new Set([
  'adala.justice.gov.ma', 'anfanews.com', 'anrt.ma', 'archive.gazettes.africa',
  'bdj.mmsp.gov.ma', 'commonpaper.com', 'creativecommons.org', 'democraticac.de',
  'documentationjuridiquemarocaine.gov.ma', 'github.com', 'groups.google.com',
  'eur-lex.europa.eu', 'justice.gov.ma', 'lexmaghreb.com', 'natlex.ilo.org', 'nc.directentreprise.ma',
  'osb-alliance.de', 'propertynews.africa', 'rnesm.justice.gov.ma', 'spdx.org',
  'www.acaps.ma', 'www.chambredesconseillers.ma', 'www.chambredesrepresentants.ma',
  'www.cndp.ma', 'www.cnea.ma', 'www.cour-constitutionnelle.ma', 'www.dgssi.gov.ma',
  'www.directentreprise.ma', 'www.haca.ma', 'www.mcrpsc.gov.ma', 'www.ompic.ma',
  'www.sgg.gov.ma', 'www.wipo.int'
]);

export function classifySourceLinkStatus(status) {
  if (Number.isInteger(status) && status >= 200 && status < 400) return 'reachable';
  if (status === 404 || status === 410) return 'missing';
  return 'inconclusive';
}

export function normalizeSourceUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password
    && (!parsed.port || parsed.port === '443')
    && ALLOWED_SOURCE_LINK_HOSTS.has(parsed.hostname.toLowerCase())
    ? parsed.href
    : null;
}

export function isAllowedSourceLinkTarget(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && (!parsed.port || parsed.port === '443')
      && ALLOWED_SOURCE_LINK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
