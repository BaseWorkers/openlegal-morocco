import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LANGUAGES = new Set(['en', 'fr', 'ar']);
const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.htm', '.md', '.mdx']);
const IGNORED_DIRECTORIES = new Set([
  '.git', '.next', '.nuxt', '.output', '.turbo', '.cache', '.vercel', '.wrangler',
  'node_modules', 'dist', 'build', 'coverage', 'vendor', 'out', 'playwright-report',
]);
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const SENSITIVE_PATH = /(?:^|\/)(?:\.env(?:\..*)?|secrets?|credentials?)(?:\/|$)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const MESSAGES = {
  en: {
    title: 'OpenLegal repository scan',
    schema: 'Schema version', generated: 'Generated', revision: 'Scanned revision', jurisdiction: 'Jurisdiction', type: 'Type', priority: 'Technical priority', review: 'Review', evidenceLabel: 'Evidence', sourceLabel: 'Source',
    disclaimer: 'Technical indicators and discussion questions only; not legal advice or a compliance determination.',
    limitations: [
      'Static inspection only; no application was executed and no network traffic or deployed website was inspected.',
      'A missing recognized notice does not establish that a notice is legally required or that an existing notice is incomplete.',
      'Tracking and third-party indicators do not prove that consent is absent or that personal data was transmitted.',
      'Legal interpretation and current-law status have not been independently reviewed for these scanner rules.',
    ],
    noticeFound: 'A file or heading matching a privacy-notice pattern was detected; the scanner did not assess whether the notice is complete or applicable.',
    noticeMissing: (count) => `No recognized privacy-notice file or heading was detected among ${count} inspected files; this is not a legal conclusion.`,
    noticeQuestion: 'Ask qualified Moroccan counsel whether the product’s actual data practices require a notice and what it should contain.',
    tracking: 'A known cookie, analytics, or tracking API/library indicator was detected; consent behavior was not evaluated.',
    trackingQuestion: 'Review the actual tracking behavior, user controls, and any applicable notice or consent requirements with qualified counsel.',
    provider: 'A known external-service SDK or endpoint indicator was detected; the scanner cannot establish whether personal data is sent.',
    providerQuestion: 'Confirm what information, if any, is sent to the provider, where it is processed, and what review or safeguards may apply.',
    evidence: 'Static indicator matched; source contents are not included in this report.',
    rootEvidence: (count) => `Inspected ${count} allowlisted repository files for recognized notice paths and headings.`,
    verification: 'Verification limitations',
    findings: 'Findings',
    none: 'No tracking or external-service indicators matched the built-in patterns.',
    count: (count) => `Inspected ${count} files.`,
  },
  fr: {
    title: 'Analyse locale du dépôt OpenLegal',
    schema: 'Version du schéma', generated: 'Généré le', revision: 'Révision analysée', jurisdiction: 'Juridiction', type: 'Type', priority: 'Priorité technique', review: 'Revue', evidenceLabel: 'Élément', sourceLabel: 'Source',
    disclaimer: 'Indicateurs techniques et questions de discussion uniquement ; ni conseil juridique ni conclusion de conformité.',
    limitations: [
      'Analyse statique uniquement ; aucune application ni aucun trafic réseau ou site déployé n’a été inspecté.',
      'L’absence d’un avis reconnu ne prouve pas qu’un avis est légalement requis ou qu’un avis existant est incomplet.',
      'Les indicateurs de suivi et de tiers ne prouvent ni l’absence de consentement ni la transmission de données personnelles.',
      'L’interprétation juridique et l’état actuel du droit n’ont pas fait l’objet d’une revue indépendante pour ces règles.',
    ],
    noticeFound: 'Un fichier ou titre correspondant à un motif d’avis de confidentialité a été détecté ; son exhaustivité et son applicabilité n’ont pas été évaluées.',
    noticeMissing: (count) => `Aucun avis de confidentialité reconnu n’a été détecté parmi ${count} fichiers inspectés ; il ne s’agit pas d’une conclusion juridique.`,
    noticeQuestion: 'Demander à un conseil marocain qualifié si les pratiques réelles du produit exigent un avis et quel contenu prévoir.',
    tracking: 'Un indicateur connu de cookie, analytique ou suivi a été détecté ; le comportement du consentement n’a pas été évalué.',
    trackingQuestion: 'Examiner avec un conseil qualifié le suivi réel, les contrôles utilisateur et les éventuelles exigences d’information ou de consentement.',
    provider: 'Un indicateur connu de SDK ou endpoint tiers a été détecté ; l’envoi de données personnelles n’est pas établi.',
    providerQuestion: 'Confirmer quelles informations sont éventuellement transmises au fournisseur, où elles sont traitées et quelles garanties peuvent s’appliquer.',
    evidence: 'Indicateur statique détecté ; le contenu source ne figure pas dans ce rapport.',
    rootEvidence: (count) => `${count} fichiers du dépôt autorisés ont été examinés pour détecter des chemins et titres d’avis reconnus.`,
    verification: 'Limites de vérification',
    findings: 'Constats',
    none: 'Aucun indicateur de suivi ou de service tiers ne correspond aux motifs intégrés.',
    count: (count) => `${count} fichiers examinés.`,
  },
  ar: {
    title: 'فحص مستودع OpenLegal محلياً',
    schema: 'إصدار المخطط', generated: 'تاريخ الإنشاء', revision: 'المراجعة المفحوصة', jurisdiction: 'الاختصاص', type: 'النوع', priority: 'الأولوية التقنية', review: 'المراجعة البشرية', evidenceLabel: 'الدليل', sourceLabel: 'المصدر',
    disclaimer: 'مؤشرات تقنية وأسئلة للنقاش فقط؛ ليست استشارة قانونية ولا حكماً بالامتثال.',
    limitations: [
      'فحص ساكن فقط؛ لم يُشغَّل التطبيق ولم تُفحص حركة الشبكة أو أي موقع منشور.',
      'عدم العثور على إشعار معروف لا يثبت أن الإشعار مطلوب قانوناً أو أن إشعاراً موجوداً ناقص.',
      'مؤشرات التتبع والخدمات الخارجية لا تثبت غياب الموافقة أو إرسال بيانات شخصية.',
      'لم يخضع التفسير القانوني أو الوضع الحالي للقانون لمراجعة مستقلة ضمن هذه القواعد.',
    ],
    noticeFound: 'تم العثور على ملف أو عنوان يطابق نمطاً معروفاً لإشعار الخصوصية؛ لم يُقيّم الفحص اكتماله أو انطباقه.',
    noticeMissing: (count) => `لم يُعثر على إشعار خصوصية معروف ضمن ${count} ملفاً جرى فحصه؛ وهذه ليست نتيجة قانونية.`,
    noticeQuestion: 'اسأل مستشاراً مغربياً مؤهلاً إن كانت ممارسات المنتج الفعلية تستلزم إشعاراً وما المعلومات التي ينبغي أن يتضمنها.',
    tracking: 'تم العثور على مؤشر معروف لواجهة أو مكتبة ملفات تعريف الارتباط أو التحليلات أو التتبع؛ لم يُفحص سلوك الموافقة.',
    trackingQuestion: 'راجع مع مستشار مؤهل سلوك التتبع الفعلي وخيارات المستخدم وأي متطلبات محتملة للإشعار أو الموافقة.',
    provider: 'تم العثور على مؤشر معروف لمكتبة أو عنوان خدمة خارجية؛ ولا يثبت الفحص إرسال بيانات شخصية.',
    providerQuestion: 'تحقق مما إذا كانت معلومات تُرسل إلى المزوّد، وأين تتم معالجتها، وما المراجعة أو الضمانات التي قد تلزم.',
    evidence: 'تمت مطابقة مؤشر ساكن؛ لا يتضمن التقرير محتوى المصدر.',
    rootEvidence: (count) => `فُحص ${count} ملفاً مسموحاً به بحثاً عن مسارات وعناوين معروفة لإشعارات الخصوصية.`,
    verification: 'حدود التحقق',
    findings: 'النتائج',
    none: 'لم تطابق مؤشرات التتبع أو الخدمات الخارجية الأنماط المضمنة.',
    count: (count) => `عدد الملفات التي فُحصت: ${count}.`,
  },
};

const RULES = {
  notice: 'openlegal.privacy.notice.presence',
  tracking: 'openlegal.privacy.tracking.indicator',
  provider: 'openlegal.third_party.integration.indicator',
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function includedFile(path) {
  const name = path.split('/').at(-1);
  if (SENSITIVE_PATH.test(path) || /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|log|lock)$/i.test(name)) return false;
  return name === 'package.json' || ALLOWED_EXTENSIONS.has(extname(name).toLowerCase());
}

async function collectFiles(root) {
  const files = [];
  const limits = [];
  let totalBytes = 0;
  async function visit(directory, relativeDirectory = '', depth = 0) {
    if (depth > 24 || files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) {
      limits.push('The scan stopped at a documented depth, file-count, or total-byte limit.');
      return;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) {
        limits.push('The scan stopped at a documented depth, file-count, or total-byte limit.');
        break;
      }
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) await visit(resolve(directory, entry.name), relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !includedFile(relativePath)) continue;
      const absolutePath = resolve(directory, entry.name);
      const info = await lstat(absolutePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES || totalBytes + info.size > MAX_TOTAL_BYTES) {
        limits.push('Some candidate files were skipped because they exceeded the per-file or total-byte limit.');
        continue;
      }
      const canonicalPath = await realpath(absolutePath);
      const canonicalRelative = relative(root, canonicalPath);
      if (!canonicalRelative || canonicalRelative.startsWith(`..${sep}`) || isAbsolute(canonicalRelative)) continue;
      const bytes = await readFile(canonicalPath);
      totalBytes += bytes.length;
      files.push({ path: canonicalRelative.split(sep).join('/'), text: bytes.toString('utf8'), digest: hash(bytes) });
    }
  }
  await visit(root);
  return { files, limits: [...new Set(limits)] };
}

function findLine(text, pattern) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index < 0 ? null : index + 1;
}

function isCommentOnlyLine(path, line) {
  const trimmed = line.trim();
  if (/\.html?$/i.test(path)) return trimmed.startsWith('<!--');
  return /\.(?:[cm]?js|jsx|tsx?)$/i.test(path) && /^(?:\/\/|\/\*|\*|\*\/)/.test(trimmed);
}

const NOTICE_PATH = /^(?:privacy(?:[-_ ]?(?:policy|notice))?|cookies?(?:[-_ ]?(?:policy|notice))?|data[-_ ]?protection|politique[-_ ]confidentialit[eé]|سياسة[-_ ]الخصوصية|إشعار[-_ ]الخصوصية)(?:\.[a-z0-9]+)?$/i;
const NOTICE_HEADING = /^\s*(?:#{1,3}\s+|<h[1-3][^>]*>|<title[^>]*>)(?:privacy\s+(?:policy|notice)|data\s+protection\s+(?:notice|policy)|politique\s+de\s+confidentialit[eé]|protection\s+des\s+donn[eé]es|سياسة\s+الخصوصية|إشعار\s+الخصوصية|حماية\s+المعطيات)/i;
const TRACKING = /(?:document\.cookie|cookieStore\b|gtag\s*\(|GoogleTagManager|googletagmanager|google-analytics|analytics\.track\s*\(|posthog-js|posthog\.init\s*\(|mixpanel(?:-browser)?|fbq\s*\(|segment\.analytics|@segment\/analytics)/i;
const PROVIDER = /(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|googleapis\.com|sentry\.io|posthog\.com|segment\.io|mixpanel\.com|@openai\/|@anthropic-ai\/sdk|@google\/generative-ai|@sentry\/|posthog-js|mixpanel-browser|@segment\/analytics)/i;

function evidenceFor(file, line, summary) {
  return {
    summary,
    source_reference: {
      kind: file ? 'repository_file' : 'other', path: file?.path ?? null,
      line_start: line, line_end: line, content_digest: file ? file.digest : null,
    },
    verification_status: file ? 'verified' : 'unverified',
  };
}

async function legalReference() {
  try {
    const registry = JSON.parse(await readFile(resolve(ROOT, 'sources/registry.yaml'), 'utf8'));
    const source = registry.sources.find(({ id }) => id === 'cndp-loi-09-08');
    if (source) return [{ title: source.title, uri: source.url, pinpoint: null, verification_status: 'unverified' }];
  } catch { /* Missing source metadata must not prevent a clearly limited technical scan. */ }
  return [];
}

function finding({ ruleId, message, question, evidence, sourceRefs, confidence }) {
  const isLegalQuestion = Boolean(question);
  return {
    finding_id: `scan-${ruleId.replaceAll('.', '-')}`,
    rule_id: ruleId,
    jurisdiction: 'MA',
    finding_type: isLegalQuestion ? 'potential_legal_question' : 'technical_observation',
    category: ruleId.split('.').slice(1, 3).join('.'),
    priority: 'informational',
    priority_basis: 'technical_remediation',
    description: message,
    legal_question: question ?? null,
    evidence,
    affected_resources: [{ type: 'repository', identifier: '.' }],
    legal_references: sourceRefs,
    suggested_controls: [],
    review_status: { verification: evidence.some((item) => item.verification_status === 'verified') ? 'partially_verified' : 'unverified', human_review: 'pending' },
    confidence,
    schema_version: '2.0.0',
  };
}

export async function scanRepository(repositoryPath, { language = 'en', version = '0.1.0' } = {}) {
  if (!LANGUAGES.has(language)) throw new Error('Language must be en, fr, or ar');
  if (typeof repositoryPath !== 'string' || !repositoryPath.trim()) throw new Error('A repository path is required');
  const requestedRoot = resolve(repositoryPath);
  const requestedInfo = await lstat(requestedRoot);
  if (requestedInfo.isSymbolicLink()) throw new Error('Repository path must not be a symbolic link');
  const root = await realpath(requestedRoot);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Repository path must resolve to a directory');
  const { files, limits } = await collectFiles(root);
  const messages = MESSAGES[language];
  const sourceRefs = await legalReference();
  const findings = [];
  const noticeFiles = files.map((file) => {
    const pathMatch = file.path.split('/').some((part) => NOTICE_PATH.test(part));
    const line = findLine(file.text, NOTICE_HEADING);
    return pathMatch || line ? { file, line: line ?? 1 } : null;
  }).filter(Boolean);
  const noticeEvidence = noticeFiles.length
    ? noticeFiles.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.noticeFound))
    : [evidenceFor(null, null, messages.rootEvidence(files.length))];
  findings.push(finding({
    ruleId: RULES.notice,
    message: noticeFiles.length ? messages.noticeFound : messages.noticeMissing(files.length),
    question: messages.noticeQuestion,
    evidence: noticeEvidence,
    sourceRefs,
    confidence: noticeFiles.length ? 0.72 : 0.58,
  }));

  const trackingMatches = [];
  const providerMatches = [];
  for (const file of files.filter(({ path }) => !/\.mdx?$/i.test(path))) {
    const lines = file.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (isCommentOnlyLine(file.path, lines[index])) continue;
      if (TRACKING.test(lines[index])) trackingMatches.push({ file, line: index + 1 });
      if (PROVIDER.test(lines[index])) providerMatches.push({ file, line: index + 1 });
      TRACKING.lastIndex = 0;
      PROVIDER.lastIndex = 0;
    }
  }
  if (trackingMatches.length) findings.push(finding({
    ruleId: RULES.tracking,
    message: messages.tracking,
    question: messages.trackingQuestion,
    evidence: trackingMatches.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.evidence)),
    sourceRefs,
    confidence: 0.7,
  }));
  if (providerMatches.length) findings.push(finding({
    ruleId: RULES.provider,
    message: messages.provider,
    question: messages.providerQuestion,
    evidence: providerMatches.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.evidence)),
    sourceRefs,
    confidence: 0.68,
  }));

  const revision = /^[a-f0-9]{7,40}$/i.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null;
  const document = {
    schema_version: '2.0.0',
    generated_at: new Date().toISOString(),
    source: { tool: 'openlegal', version },
    repository: { revision },
    verification_limitations: [...messages.limitations, ...limits, messages.count(files.length)],
    findings,
  };
  return { document, scannedFiles: files.length, messages };
}

export function renderScanMarkdown(document, messages) {
  const lines = [
    `# ${messages.title}`, '',
    `${messages.schema}: ${document.schema_version}`,
    `${messages.generated}: ${document.generated_at}`,
    `${messages.revision}: ${document.repository.revision ?? 'unavailable'}`,
    '',
    `> ${messages.disclaimer}`, '',
    `## ${messages.findings}`, '',
  ];
  if (!document.findings.length) lines.push(messages.none, '');
  for (const item of document.findings) {
    lines.push(`### ${item.rule_id}`, '',
      `- ${messages.jurisdiction}: ${item.jurisdiction}`,
      `- ${messages.type}: ${item.finding_type}`,
      `- ${messages.priority}: ${item.priority}`,
      `- ${messages.review}: ${item.review_status.human_review}`,
      `- ${item.description}`);
    if (item.legal_question) lines.push(`- ${item.legal_question}`);
    for (const evidence of item.evidence) {
      const ref = evidence.source_reference;
      const location = ref.path ? `${ref.path}${ref.line_start ? `:${ref.line_start}` : ''}` : 'repository scan scope';
      lines.push(`- ${messages.evidenceLabel}: ${evidence.summary} [${location}]`);
    }
    for (const source of item.legal_references) lines.push(`- ${messages.sourceLabel} (${source.verification_status}): ${source.title}${source.uri ? ` — ${source.uri}` : ''}`);
    lines.push('');
  }
  lines.push(`## ${messages.verification}`, '', ...document.verification_limitations.map((item) => `- ${item}`), '');
  return lines.join('\n');
}
