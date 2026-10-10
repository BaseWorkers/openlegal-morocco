import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
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
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const PAGE_TIMEOUT_MS = 10_000;
const SENSITIVE_PATH = /(?:^|\/)(?:\.env(?:\..*)?|secrets?|credentials?)(?:\/|$)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

const MESSAGES = {
  en: {
    title: 'OpenLegal privacy scan',
    schema: 'Schema version', generated: 'Generated', revision: 'Scanned revision', jurisdiction: 'Jurisdiction', type: 'Type', priority: 'Technical priority', review: 'Review', evidenceLabel: 'Evidence', sourceLabel: 'Source',
    disclaimer: 'Technical indicators and discussion questions only; not legal advice or a compliance determination.',
    limitations: [
      'Repository files were inspected statically and application code was not executed. URL mode, when requested, fetches bounded public HTML only.',
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
    score: 'Technical review readiness', coverage: 'Evidence coverage', scoreLimit: 'The readiness signal summarizes scanner findings and incomplete requested scopes; it is not a legal-risk or compliance score.',
    scoreFormula: (findings, scopes, deduction) => `Formula: 100 minus ${findings} finding-rule penalty points and ${scopes} incomplete-scope penalty points (${deduction} total deducted). Informational: 10; low: 15; medium: 25; high: 40; critical: 60 per distinct rule ID. Incomplete requested scope: 10 each. Capped at 0.`,
    optionalScope: 'Optional scope not scanned: public website (not included in coverage or treated as passed).',
    critical: 'Critical findings requiring attention',
    cookieStorage: 'A cookie-storage API indicator was detected; the scanner cannot determine the cookie purpose, persistence, or whether it is used for tracking.',
    cookieStorageQuestion: 'Review the purpose, lifetime, and value stored by this cookie API; distinguish application state from analytics or cross-site tracking.',
    cookieStorageAction: 'Trace the call site and the value stored, then confirm whether it is necessary for the feature and whether any user-facing controls or notice should describe it.',
    nextjs: 'Detected framework', nextjsDetected: 'Next.js detected', nextjsUnknown: 'Next.js was not identified; framework-specific coverage is limited.',
    urlFound: 'Public-page scan', urlMissing: 'No public-page URL was supplied; deployed behavior was not inspected.',
    urlLimit: 'The public-page scan fetched HTML only. It did not execute JavaScript, submit forms, log in, follow consent choices, or inspect authenticated pages.',
    urlError: (message) => `The public-page scan could not complete: ${message}`,
    urlPartial: (details) => `Could not inspect these privacy-related page link(s): ${details.join('; ')}.`,
    gdprMessage: 'GDPR territorial applicability cannot be determined from source code or public pages alone.',
    gdprQuestion: 'Confirm whether the organization is established in the EU, offers goods or services to people in the EU, or monitors their behavior there; consult qualified counsel about GDPR scope.',
    humanReviewRequired: 'Human review required',
    nextSteps: 'Recommended next steps',
    noticeAction: 'Inventory the information collected and its purposes, then ask qualified counsel whether a notice is required and make any reviewed notice easy to find.',
    trackingAction: 'Trace where the indicator initializes and what it sends; test user controls with synthetic data and ask counsel whether a consent step is needed.',
    providerAction: 'Inventory the service, data fields, processing location, and retention; have counsel review applicable terms and safeguards.',
    gdprAction: 'Record the organization’s establishment, target markets, and any monitoring of people in the EU; ask qualified counsel to assess Article 3 before treating GDPR rules as applicable.',
  },
  fr: {
    title: 'Analyse de confidentialité OpenLegal',
    schema: 'Version du schéma', generated: 'Généré le', revision: 'Révision analysée', jurisdiction: 'Juridiction', type: 'Type', priority: 'Priorité technique', review: 'Revue', evidenceLabel: 'Élément', sourceLabel: 'Source',
    disclaimer: 'Indicateurs techniques et questions de discussion uniquement ; ni conseil juridique ni conclusion de conformité.',
    limitations: [
      'Les fichiers du dépôt ont été examinés statiquement et aucune application n’a été exécutée. Le mode URL, si demandé, récupère uniquement du HTML public limité.',
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
    score: 'Préparation à la revue technique', coverage: 'Couverture des éléments recueillis', scoreLimit: 'Ce signal résume les constats à examiner et les périmètres demandés incomplets ; il ne mesure ni le risque juridique ni la conformité.',
    scoreFormula: (findings, scopes, deduction) => `Calcul : 100 moins ${findings} points de règles de constat et ${scopes} points de périmètres incomplets (${deduction} points au total). Informationnel : 10 ; faible : 15 ; moyen : 25 ; élevé : 40 ; critique : 60 par règle distincte. Périmètre demandé incomplet : 10 chacun. Minimum : 0.`,
    optionalScope: 'Périmètre facultatif non analysé : site public (non inclus dans la couverture et non considéré comme validé).',
    critical: 'Constats critiques à examiner',
    cookieStorage: 'Un indicateur d’API de stockage de cookies a été détecté ; le scanner ne peut déterminer ni son objectif, ni sa durée, ni s’il sert au suivi.',
    cookieStorageQuestion: 'Examiner l’objectif, la durée et la valeur stockée ; distinguer l’état de l’application des analyses ou du suivi intersites.',
    cookieStorageAction: 'Suivre l’appel et la valeur stockée, puis confirmer si elle est nécessaire à la fonctionnalité et si des contrôles ou une information utilisateur doivent la décrire.',
    nextjs: 'Framework détecté', nextjsDetected: 'Next.js détecté', nextjsUnknown: 'Next.js n’a pas été identifié ; la couverture spécifique au framework est limitée.',
    urlFound: 'Analyse des pages publiques', urlMissing: 'Aucune URL publique fournie ; le comportement du site déployé n’a pas été inspecté.',
    urlLimit: 'L’analyse de la page publique a uniquement récupéré le HTML. Elle n’a pas exécuté JavaScript, soumis de formulaires, ouvert de session, choisi un consentement ni inspecté de pages authentifiées.',
    urlError: (message) => `L’analyse de la page publique n’a pas abouti : ${message}`,
    urlPartial: (details) => `Ces liens vers des pages de confidentialité n’ont pas pu être examinés : ${details.join(' ; ')}.`,
    gdprMessage: 'Le champ territorial du RGPD ne peut pas être déterminé à partir du code source ou des pages publiques seuls.',
    gdprQuestion: 'Confirmer si l’organisation est établie dans l’UE, propose des biens ou services aux personnes qui s’y trouvent, ou y suit leur comportement ; consulter un conseil qualifié sur l’applicabilité du RGPD.',
    humanReviewRequired: 'Revue humaine requise',
    nextSteps: 'Étapes suivantes recommandées',
    noticeAction: 'Inventorier les informations collectées et leurs finalités, puis demander à un conseil qualifié si un avis est requis et rendre tout avis revu facile à trouver.',
    trackingAction: 'Tracer le chargement de l’indicateur et les données qu’il envoie ; tester les contrôles avec des données synthétiques et demander au conseil si un consentement est nécessaire.',
    providerAction: 'Inventorier le service, les catégories de données, le lieu de traitement et la conservation ; faire examiner les conditions et garanties applicables par un conseil.',
    gdprAction: 'Documenter l’établissement de l’organisation, ses marchés cibles et tout suivi de personnes dans l’UE ; demander à un conseil qualifié d’évaluer l’article 3 avant d’appliquer des règles RGPD.',
  },
  ar: {
    title: 'فحص OpenLegal للخصوصية',
    schema: 'إصدار المخطط', generated: 'تاريخ الإنشاء', revision: 'المراجعة المفحوصة', jurisdiction: 'الاختصاص', type: 'النوع', priority: 'الأولوية التقنية', review: 'المراجعة البشرية', evidenceLabel: 'الدليل', sourceLabel: 'المصدر',
    disclaimer: 'مؤشرات تقنية وأسئلة للنقاش فقط؛ ليست استشارة قانونية ولا حكماً بالامتثال.',
    limitations: [
      'فُحصت ملفات المستودع فحصاً ساكناً ولم يُشغَّل التطبيق. وعند طلب فحص URL، يُسترجع HTML عام ومحدود فقط.',
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
    score: 'الاستعداد للمراجعة التقنية', coverage: 'تغطية جمع الأدلة', scoreLimit: 'تلخص هذه الإشارة النتائج التي تحتاج إلى مراجعة ونطاقات الفحص المطلوبة غير المكتملة؛ وليست تقييماً للمخاطر القانونية أو الامتثال.',
    scoreFormula: (findings, scopes, deduction) => `طريقة الحساب: 100 ناقص ${findings} نقطة لقواعد النتائج و${scopes} نقطة لنطاقات الفحص غير المكتملة (${deduction} نقطة إجمالاً). معلوماتي: 10؛ منخفض: 15؛ متوسط: 25؛ مرتفع: 40؛ حرج: 60 لكل قاعدة مختلفة. النطاق المطلوب غير المكتمل: 10 لكل نطاق. الحد الأدنى 0.`,
    optionalScope: 'نطاق اختياري لم يُفحص: الموقع العام (غير داخل في التغطية ولا يُعتبر ناجحاً).',
    critical: 'نتائج حرجة تتطلب الانتباه',
    cookieStorage: 'تم العثور على مؤشر لواجهة تخزين ملفات تعريف الارتباط؛ لا يستطيع الفحص تحديد الغرض منها أو مدة حفظها أو ما إذا كانت للتتبع.',
    cookieStorageQuestion: 'راجع غرض واجهة ملفات تعريف الارتباط ومدة حفظها والقيمة المخزنة؛ وميّز بين حالة التطبيق والتحليلات أو التتبع بين المواقع.',
    cookieStorageAction: 'تتبّع موضع الاستدعاء والقيمة المخزنة، ثم تحقق من ضرورتها للميزة وما إذا كان ينبغي وصفها ضمن أدوات تحكم أو إشعار للمستخدم.',
    nextjs: 'إطار العمل المكتشف', nextjsDetected: 'تم اكتشاف Next.js', nextjsUnknown: 'لم يتم التعرف على Next.js؛ لذلك فالتغطية الخاصة به محدودة.',
    urlFound: 'فحص الصفحات العامة', urlMissing: 'لم يُقدَّم رابط عام؛ لم يُفحص سلوك الموقع المنشور.',
    urlLimit: 'استرجع فحص الصفحة العامة HTML فقط. لم يشغّل JavaScript، ولم يرسل نماذج أو يسجل الدخول أو يختَر الموافقة أو يفحص صفحات تتطلب تسجيل الدخول.',
    urlError: (message) => `تعذر إكمال فحص الصفحة العامة: ${message}`,
    urlPartial: (details) => `تعذر فحص روابط صفحات الخصوصية التالية: ${details.join('؛ ')}.`,
    gdprMessage: 'لا يمكن تحديد النطاق الإقليمي للائحة GDPR من الشيفرة أو الصفحات العامة وحدها.',
    gdprQuestion: 'تحقق مما إذا كانت المؤسسة موجودة في الاتحاد الأوروبي، أو تعرض خدمات لأشخاص فيه، أو تراقب سلوكهم داخله؛ واستشر مختصاً لتحديد انطباق GDPR.',
    humanReviewRequired: 'المراجعة البشرية مطلوبة',
    nextSteps: 'الخطوات التالية المقترحة',
    noticeAction: 'وثّق المعلومات التي تجمعها وأغراضها، ثم اسأل مختصاً مؤهلاً إن كان الإشعار مطلوباً واجعل أي إشعار راجعه المختص سهل الوصول.',
    trackingAction: 'تتبّع موضع تشغيل المؤشر والبيانات التي يرسلها؛ واختبر أدوات تحكم المستخدم ببيانات تجريبية واسأل المختص إن كانت هناك حاجة للموافقة.',
    providerAction: 'أنشئ قائمة بالخدمة وفئات البيانات ومكان المعالجة ومدة الاحتفاظ، واطلب من مختص مراجعة الشروط والضمانات المنطبقة.',
    gdprAction: 'وثّق مكان المؤسسة والأسواق المستهدفة وأي مراقبة لأشخاص في الاتحاد الأوروبي؛ واطلب من مختص تقييم المادة 3 قبل تطبيق قواعد GDPR.',
  },
};

const RULES = {
  notice: 'openlegal.privacy.notice.presence',
  cookieStorage: 'openlegal.privacy.cookie-storage.indicator',
  tracking: 'openlegal.privacy.tracking.indicator',
  provider: 'openlegal.third_party.integration.indicator',
  gdpr: 'openlegal.gdpr.territorial-scope.question',
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
const PRIVACY_LINK_PATH = /(?:^|\/)(?:privacy(?:[-_](?:policy|notice|center))?|cookies?(?:[-_](?:policy|notice))?|data[-_]?protection|politique[-_]confidentialit[eé]|سياسة[-_]الخصوصية|إشعار[-_]الخصوصية)(?:\/|$)/i;
const COOKIE_STORAGE = /(?:document\.cookie|cookieStore\b)/i;
const TRACKING = /(?:gtag\s*\(|GoogleTagManager|googletagmanager|google-analytics|analytics\.track\s*\(|posthog-js|posthog\.init\s*\(|mixpanel(?:-browser)?|fbq\s*\(|segment\.analytics|@segment\/analytics)/i;
const PROVIDER = /(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|googleapis\.com|google-analytics\.com|googletagmanager\.com|sentry\.io|posthog\.com|segment\.io|mixpanel\.com|@openai\/|@anthropic-ai\/sdk|@google\/generative-ai|@sentry\/|posthog-js|mixpanel-browser|@segment\/analytics)/i;

function evidenceFor(file, line, summary, sourceKind = 'repository_file', digest = null) {
  return {
    summary,
    source_reference: {
      kind: file ? sourceKind : 'other', path: file?.path ?? null,
      line_start: line, line_end: line, content_digest: file ? (digest ?? file.digest) : null,
    },
    verification_status: file ? 'verified' : 'unverified',
  };
}

async function legalReference() {
  try {
    const registry = JSON.parse(await readFile(resolve(ROOT, 'sources/registry.yaml'), 'utf8'));
    const ids = ['cndp-loi-09-08', 'gdpr-regulation-2016-679'];
    return ids.flatMap((id) => {
      const source = registry.sources.find((item) => item.id === id);
      return source ? [{
        title: source.title,
        uri: source.url,
        pinpoint: id.startsWith('gdpr') ? 'Article 3' : null,
        verification_status: source.verification_status === 'verified' ? 'source_verified' : 'unverified',
      }] : [];
    });
  } catch { /* Missing source metadata must not prevent a clearly limited technical scan. */ }
  return [];
}

function finding({ ruleId, message, question, evidence, sourceRefs, confidence, suggestedActions = [], jurisdiction = 'MA', resourceType = 'repository', resourceIdentifier = '.', findingIdSuffix = '' }) {
  const isLegalQuestion = Boolean(question);
  return {
    finding_id: `scan-${ruleId.replaceAll('.', '-')}${findingIdSuffix ? `-${findingIdSuffix}` : ''}`,
    rule_id: ruleId,
    jurisdiction,
    finding_type: isLegalQuestion ? 'potential_legal_question' : 'technical_observation',
    category: ruleId.split('.').slice(1, 3).join('.'),
    priority: 'informational',
    priority_basis: 'technical_remediation',
    description: message,
    legal_question: question ?? null,
    evidence,
    affected_resources: [{ type: resourceType, identifier: resourceIdentifier }],
    legal_references: sourceRefs,
    suggested_controls: [],
    suggested_actions: suggestedActions,
    review_status: { verification: evidence.some((item) => item.verification_status === 'verified') ? 'partially_verified' : 'unverified', human_review: 'pending' },
    confidence,
    schema_version: '2.0.0',
  };
}

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => (value * 256) + Number(part), 0);
}

function inIpv4Range(address, network, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask);
}

function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4],
    ];
    return !blocked.some(([network, prefix]) => inIpv4Range(address, network, prefix));
  }
  if (family === 6) {
    const value = address.toLowerCase().split('%')[0];
    if (value.startsWith('::ffff:') || value.startsWith('2001:db8:') || value.startsWith('2001:0000:')
      || value.startsWith('2001:0:') || value.startsWith('2001:2:') || value.startsWith('2001:10:')
      || value.startsWith('2002:')) return false;
    const first = Number.parseInt(value.split(':')[0] || '0', 16);
    return Number.isFinite(first) && (first & 0xe000) === 0x2000;
  }
  return false;
}

function validatePageUrl(input, { allowPrivateHosts = false, allowHttp = false } = {}) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('URL must be a string of at most 2048 characters');
  let url;
  try { url = new URL(input); } catch { throw new Error('URL is invalid'); }
  const allowedProtocol = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
  if (!allowedProtocol || url.username || url.password) throw new Error('URL must use HTTPS and must not contain credentials');
  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== expectedPort && !allowPrivateHosts) throw new Error('URL must use the standard HTTPS port');
  if (url.search) throw new Error('URL query strings are not scanned; remove them to avoid sending token-like values');
  if (!allowPrivateHosts) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname) && !isPublicAddress(hostname)) throw new Error('URL resolves to a private or reserved address');
  }
  url.hash = '';
  return url;
}

function guardedLookup({ allowPrivateHosts = false } = {}) {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      if (!addresses.length || (!allowPrivateHosts && addresses.some(({ address }) => !isPublicAddress(address)))) {
        return callback(new Error('URL host resolves to a private, reserved, or unavailable address'));
      }
      const matchingFamily = options.family ? addresses.filter(({ family }) => family === options.family) : addresses;
      if (!matchingFamily.length) return callback(new Error('URL host has no address for the requested protocol family'));
      const selected = matchingFamily[0];
      if (options.all) return callback(null, matchingFamily);
      return callback(null, selected.address, selected.family);
    });
  };
}

function readBoundedResponse(response) {
  return new Promise((resolveResponse, reject) => {
    const chunks = [];
    let bytes = 0;
    const declaredLength = Number(response.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PAGE_BYTES) {
      response.destroy();
      reject(new Error('Page exceeds the 2 MiB response limit'));
      return;
    }
    response.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_PAGE_BYTES) {
        response.destroy(new Error('Page exceeds the 2 MiB response limit'));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => resolveResponse(Buffer.concat(chunks).toString('utf8')));
    response.on('error', reject);
  });
}

async function requestPage(url, { allowPrivateHosts = false, allowHttp = false } = {}) {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolveResponse, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const req = request(url, {
      method: 'GET',
      headers: { 'user-agent': 'OpenLegal-Scanner/0.1 (+local privacy indicator scan)', accept: 'text/html,application/xhtml+xml', 'accept-encoding': 'identity' },
      lookup: guardedLookup({ allowPrivateHosts }),
      timeout: PAGE_TIMEOUT_MS,
      maxHeaderSize: 16 * 1024,
    }, async (response) => {
      try {
        const body = await readBoundedResponse(response);
        finish(resolveResponse, { status: response.statusCode ?? 0, headers: response.headers, body });
      } catch (error) { finish(reject, error); }
    });
    timer = setTimeout(() => req.destroy(new Error('Page request timed out')), PAGE_TIMEOUT_MS);
    timer.unref();
    req.on('error', (error) => finish(reject, error));
    req.end();
  });
}

export async function fetchPublicPage(startUrl, options = {}) {
  let url = validatePageUrl(startUrl, options);
  const initialOrigin = url.origin;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await (options.requestImpl ?? requestPage)(url, options);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || redirect === MAX_REDIRECTS) throw new Error('Redirect limit reached or redirect target missing');
      url = validatePageUrl(new URL(location, url).href, options);
      if (url.origin !== initialOrigin) throw new Error('Cross-origin redirects are not followed');
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`Page returned HTTP ${response.status}`);
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('Page response is not HTML');
    return { url, html: response.body, digest: hash(response.body) };
  }
  throw new Error('Redirect limit reached');
}

function privacyLinks(html, pageUrl) {
  const candidates = [];
  const href = /\bhref\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(href)) {
    const target = match[2].replaceAll('&amp;', '&');
    try {
      const url = new URL(target, pageUrl);
      if (url.origin !== pageUrl.origin || !['http:', 'https:'].includes(url.protocol) || url.search) continue;
      if (PRIVACY_LINK_PATH.test(url.pathname)) candidates.push(url.href);
    } catch { /* Ignore malformed links from untrusted HTML. */ }
  }
  return [...new Set(candidates)].slice(0, 4);
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

export async function scanUrl(startUrl, { language = 'ar', allowPrivateHosts = false, allowHttp = false, requestImpl } = {}) {
  if (!LANGUAGES.has(language)) throw new Error('Language must be en, fr, or ar');
  const requestOptions = { allowPrivateHosts, allowHttp, ...(requestImpl ? { requestImpl } : {}) };
  const firstPage = await fetchPublicPage(startUrl, requestOptions);
  const pages = [firstPage];
  const inaccessiblePages = [];
  for (const candidate of privacyLinks(firstPage.html, firstPage.url)) {
    if (pages.length >= 5) break;
    try {
      pages.push(await fetchPublicPage(candidate, requestOptions));
    } catch (error) {
      const candidateUrl = new URL(candidate);
      inaccessiblePages.push({ path: candidateUrl.pathname, reason: error.message });
    }
  }
  const messages = MESSAGES[language];
  const sourceRefs = (await legalReference()).filter(({ uri }) => !uri?.includes('eur-lex.europa.eu'));
  const findings = [];
  const noticePages = pages.filter(({ html, url }) => NOTICE_PATH.test(decodeURIComponent(url.pathname.split('/').at(-1) || '')) || NOTICE_HEADING.test(html));
  const pageEvidence = (page, summary) => evidenceFor(
    { path: null }, null, `${summary} (${page.url.host}${page.url.pathname})`, 'external_source', page.digest,
  );
  const pageNames = pages.map(({ url }) => `${url.origin}${url.pathname}`).join(', ');
  const noticeEvidence = noticePages.length
    ? noticePages.map((page) => pageEvidence(page, messages.noticeFound))
    : [evidenceFor(null, null, `${messages.urlFound}: ${pages.length} HTML page(s) inspected (${pageNames}).`)];
  findings.push(finding({
    ruleId: RULES.notice,
    message: noticePages.length ? messages.noticeFound : messages.noticeMissing(pages.length),
    question: messages.noticeQuestion,
    suggestedActions: [messages.noticeAction],
    evidence: noticeEvidence,
    sourceRefs,
    confidence: noticePages.length ? 0.72 : 0.58,
    resourceType: 'website',
    resourceIdentifier: `${firstPage.url.origin}${firstPage.url.pathname}`,
    findingIdSuffix: 'website',
  }));
  const trackingPages = pages.filter(({ html }) => TRACKING.test(html));
  const providerPages = pages.filter(({ html }) => PROVIDER.test(html));
  if (trackingPages.length) findings.push(finding({
    ruleId: RULES.tracking,
    message: messages.tracking,
    question: messages.trackingQuestion,
    suggestedActions: [messages.trackingAction],
    evidence: trackingPages.map((page) => pageEvidence(page, messages.evidence)),
    sourceRefs,
    confidence: 0.7,
    resourceType: 'website',
    resourceIdentifier: `${firstPage.url.origin}${firstPage.url.pathname}`,
    findingIdSuffix: 'website',
  }));
  const cookieStoragePages = pages.filter(({ html }) => COOKIE_STORAGE.test(html));
  if (cookieStoragePages.length) findings.push(finding({
    ruleId: RULES.cookieStorage,
    message: messages.cookieStorage,
    question: messages.cookieStorageQuestion,
    suggestedActions: [messages.cookieStorageAction],
    evidence: cookieStoragePages.map((page) => pageEvidence(page, messages.evidence)),
    sourceRefs,
    confidence: 0.62,
    resourceType: 'website',
    resourceIdentifier: `${firstPage.url.origin}${firstPage.url.pathname}`,
    findingIdSuffix: 'website',
  }));
  if (providerPages.length) findings.push(finding({
    ruleId: RULES.provider,
    message: messages.provider,
    question: messages.providerQuestion,
    suggestedActions: [messages.providerAction],
    evidence: providerPages.map((page) => pageEvidence(page, messages.evidence)),
    sourceRefs,
    confidence: 0.68,
    resourceType: 'website',
    resourceIdentifier: `${firstPage.url.origin}${firstPage.url.pathname}`,
    findingIdSuffix: 'website',
  }));
  return {
    findings,
    pages: pages.map(({ url }) => `${url.origin}${url.pathname}`),
    inaccessible_pages: inaccessiblePages,
    limitations: [messages.urlLimit, ...(inaccessiblePages.length ? [messages.urlPartial(inaccessiblePages.map(({ path, reason }) => `${path}: ${reason}`))] : [])],
  };
}

function nextJsDetected(files) {
  for (const file of files) {
    if (!/(?:^|\/)package\.json$/.test(file.path)) continue;
    try {
      const manifest = JSON.parse(file.text);
      if (manifest.dependencies?.next || manifest.devDependencies?.next || manifest.optionalDependencies?.next) return true;
    } catch { /* Another workspace manifest may still identify the Next.js app. */ }
  }
  return files.some(({ path }) => /(?:^|\/)(?:src\/)?(?:app|pages)\/(?:page|index)\.(?:js|jsx|ts|tsx)$/.test(path)
    || /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts)$/.test(path));
}

const FINDING_PENALTIES = { informational: 10, low: 15, medium: 25, high: 40, critical: 60 };
const INCOMPLETE_SCOPE_PENALTY = 10;

function assessmentFor({ localScanComplete, framework, websiteRequested, websiteComplete, findings }) {
  const checks = [
    { id: 'repository', complete: localScanComplete },
    { id: 'nextjs_framework', complete: framework === 'Next.js' },
    ...(websiteRequested ? [{ id: 'public_website', complete: websiteComplete }] : []),
  ];
  const completed = checks.filter(({ complete }) => complete).length;
  const unresolvedRules = new Map();
  for (const item of findings) {
    const penalty = FINDING_PENALTIES[item.priority] ?? FINDING_PENALTIES.informational;
    unresolvedRules.set(item.rule_id, Math.max(unresolvedRules.get(item.rule_id) ?? 0, penalty));
  }
  const findingPenalty = [...unresolvedRules.values()].reduce((total, penalty) => total + penalty, 0);
  const incompleteScopes = checks.filter(({ complete }) => !complete).length;
  const incompleteScopePenalty = incompleteScopes * INCOMPLETE_SCOPE_PENALTY;
  return {
    score: Math.round((completed / checks.length) * 100),
    score_basis: 'evidence_collection_coverage',
    readiness_score: Math.max(0, 100 - findingPenalty - incompleteScopePenalty),
    readiness_basis: 'open_review_work',
    readiness_penalties: {
      finding_rules: unresolvedRules.size,
      finding_points: findingPenalty,
      incomplete_requested_scopes: incompleteScopes,
      incomplete_scope_points: incompleteScopePenalty,
    },
    readiness_formula: 'Start at 100; subtract one priority-weighted penalty per distinct finding rule ID and 10 points per incomplete requested scan scope; floor at 0. Informational 10, low 15, medium 25, high 40, critical 60.',
    completed_scopes: checks.filter(({ complete }) => complete).map(({ id }) => id),
    incomplete_scopes: checks.filter(({ complete }) => !complete).map(({ id }) => id),
    unscanned_optional_scopes: websiteRequested ? [] : ['public_website'],
    status: 'human_review_required',
  };
}

export async function scanRepository(repositoryPath, { language = 'ar', version = '0.1.0', url = null, requestImpl } = {}) {
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
  const allSourceRefs = await legalReference();
  const sourceRefs = allSourceRefs.filter(({ uri }) => !uri?.includes('eur-lex.europa.eu'));
  const findings = [];
  const framework = nextJsDetected(files) ? 'Next.js' : 'unknown';
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
    suggestedActions: [messages.noticeAction],
    evidence: noticeEvidence,
    sourceRefs,
    confidence: noticeFiles.length ? 0.72 : 0.58,
  }));

  const trackingMatches = [];
  const cookieStorageMatches = [];
  const providerMatches = [];
  for (const file of files.filter(({ path }) => !/\.mdx?$/i.test(path))) {
    const lines = file.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (isCommentOnlyLine(file.path, lines[index])) continue;
      if (TRACKING.test(lines[index])) trackingMatches.push({ file, line: index + 1 });
      if (COOKIE_STORAGE.test(lines[index])) cookieStorageMatches.push({ file, line: index + 1 });
      if (PROVIDER.test(lines[index])) providerMatches.push({ file, line: index + 1 });
      TRACKING.lastIndex = 0;
      PROVIDER.lastIndex = 0;
    }
  }
  if (trackingMatches.length) findings.push(finding({
    ruleId: RULES.tracking,
    message: messages.tracking,
    question: messages.trackingQuestion,
    suggestedActions: [messages.trackingAction],
    evidence: trackingMatches.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.evidence)),
    sourceRefs,
    confidence: 0.7,
  }));
  if (cookieStorageMatches.length) findings.push(finding({
    ruleId: RULES.cookieStorage,
    message: messages.cookieStorage,
    question: messages.cookieStorageQuestion,
    suggestedActions: [messages.cookieStorageAction],
    evidence: cookieStorageMatches.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.evidence)),
    sourceRefs,
    confidence: 0.62,
  }));
  if (providerMatches.length) findings.push(finding({
    ruleId: RULES.provider,
    message: messages.provider,
    question: messages.providerQuestion,
    suggestedActions: [messages.providerAction],
    evidence: providerMatches.slice(0, 20).map(({ file, line }) => evidenceFor(file, line, messages.evidence)),
    sourceRefs,
    confidence: 0.68,
  }));

  const gdprSource = allSourceRefs.filter(({ uri }) => uri?.includes('eur-lex.europa.eu'));
  findings.push(finding({
    ruleId: RULES.gdpr,
    jurisdiction: 'EU',
    message: messages.gdprMessage,
    question: messages.gdprQuestion,
    suggestedActions: [messages.gdprAction],
    evidence: [evidenceFor(null, null, messages.gdprMessage)],
    sourceRefs: gdprSource,
    confidence: null,
  }));

  let websiteScan = null;
  const limitations = [...messages.limitations, ...limits];
  if (url) {
    validatePageUrl(url);
    try {
      websiteScan = await scanUrl(url, { language, ...(requestImpl ? { requestImpl } : {}) });
      findings.push(...websiteScan.findings);
      limitations.push(...websiteScan.limitations);
    } catch (error) {
      websiteScan = { pages: [], error: error.message };
      limitations.push(messages.urlError(error.message));
    }
  } else {
    limitations.push(messages.urlMissing);
  }

  const revision = /^[a-f0-9]{7,40}$/i.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null;
  const document = {
    schema_version: '2.0.0',
    generated_at: new Date().toISOString(),
    source: { tool: 'openlegal', version },
    repository: { revision },
    assessment: (() => {
      const assessment = assessmentFor({ localScanComplete: limits.length === 0, framework, websiteRequested: Boolean(url), websiteComplete: Boolean(websiteScan && !websiteScan.error && websiteScan.inaccessible_pages.length === 0), findings });
      return { ...assessment, coverage_percent: assessment.score, framework };
    })(),
    verification_limitations: [...limitations, messages.count(files.length), ...(framework === 'Next.js' ? [] : [messages.nextjsUnknown]), messages.scoreLimit],
    findings,
  };
  return { document, scannedFiles: files.length, messages };
}

export function renderScanMarkdown(document, messages) {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
  const sortedFindings = [...document.findings].sort((left, right) => (severityOrder[left.priority] ?? 5) - (severityOrder[right.priority] ?? 5));
  const criticalFindings = sortedFindings.filter(({ priority }) => priority === 'critical');
  const lines = [
    `# ${messages.title}`, '',
    `${messages.schema}: ${document.schema_version}`,
    `${messages.generated}: ${document.generated_at}`,
    `${messages.revision}: ${document.repository.revision ?? 'unavailable'}`,
    '',
    `## ${messages.score}: ${document.assessment.readiness_score}/100`,
    `- ${messages.coverage}: ${document.assessment.coverage_percent}% (${document.assessment.completed_scopes.join(', ') || 'none'})`,
    `- ${messages.scoreFormula(document.assessment.readiness_penalties.finding_points, document.assessment.readiness_penalties.incomplete_scope_points, document.assessment.readiness_penalties.finding_points + document.assessment.readiness_penalties.incomplete_scope_points)}`,
    ...(document.assessment.unscanned_optional_scopes.length ? [`- ${messages.optionalScope}`] : []),
    `- ${messages.nextjs}: ${document.assessment.framework === 'Next.js' ? messages.nextjsDetected : messages.nextjsUnknown}`,
    `- ${messages.review}: ${messages.humanReviewRequired}`,
    '',
    `> ${messages.disclaimer}`, '',
  ];
  if (criticalFindings.length) {
    lines.push(`## ${messages.critical}`, '', ...criticalFindings.map(({ rule_id, description }) => `- **${rule_id}:** ${escapeMarkdown(description)}`), '');
  }
  lines.push(`## ${messages.findings}`, '');
  if (!document.findings.length) lines.push(messages.none, '');
  for (const item of sortedFindings) {
    lines.push(`### ${item.priority === 'critical' ? 'CRITICAL — ' : ''}${item.rule_id}`, '',
      `- ${messages.jurisdiction}: ${item.jurisdiction}`,
      `- ${messages.type}: ${item.finding_type}`,
      `- ${messages.priority}: ${item.priority}`,
      `- ${messages.review}: ${item.review_status.human_review}`,
      `- ${escapeMarkdown(item.description)}`);
    if (item.legal_question) lines.push(`- ${escapeMarkdown(item.legal_question)}`);
    if (item.suggested_actions?.length) {
      lines.push(`- ${messages.nextSteps}:`, ...item.suggested_actions.map((action) => `  - ${escapeMarkdown(action)}`));
    }
    for (const evidence of item.evidence) {
      const ref = evidence.source_reference;
      const location = ref.path
        ? `${ref.path}${ref.line_start ? `:${ref.line_start}` : ''}`
        : ref.kind === 'external_source' ? 'public website page' : 'repository scan scope';
      lines.push(`- ${messages.evidenceLabel}: ${escapeMarkdown(evidence.summary)} [${escapeMarkdown(location)}]`);
    }
    for (const source of item.legal_references) lines.push(`- ${messages.sourceLabel} (${source.verification_status}): ${escapeMarkdown(source.title)}${source.uri ? ` — ${escapeMarkdown(source.uri)}` : ''}`);
    lines.push('');
  }
  lines.push(`## ${messages.verification}`, '', ...document.verification_limitations.map((item) => `- ${item}`), '');
  return lines.join('\n');
}
