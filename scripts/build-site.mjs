import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog, loadTemplateContent, draftDisclaimer } from './catalog.mjs';
import { escapeHtml, renderMarkdownToHtml } from './markdown-renderer.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const labels = {
  en: { locale: 'English', code: 'en', home: 'Home', catalog: 'Browse templates', purpose: 'OpenLegal', intro: 'Public-interest legal-document discussion drafts for people building and operating online in Morocco.', warning: 'DRAFT — NOT LEGALLY REVIEWED', warningBody: 'These materials are discussion drafts. They are not legal advice and do not certify legal compliance. Consult qualified Moroccan counsel before relying on a document.', scope: '14 template packages · English, French, and Arabic · No recorded legal approvals', search: 'Search templates', searchHint: 'Search by title, identifier, category, or version', category: 'Category', allCategories: 'All categories', resultSingular: 'template', resultPlural: 'templates shown', noResults: 'No templates match these filters.', open: 'Read draft', status: 'Status', version: 'Version', languages: 'Languages', license: 'License', jurisdiction: 'Jurisdiction', updated: 'Last updated', legalReview: 'Legal review', languageReview: 'Language review', sources: 'Declared sources', sourcesNote: 'References are not legal approval or a determination that law is current or applies.', sourceStatus: 'Recorded source verification', reviewed: 'Human review', unknownRevision: 'Repository revision unavailable', sourceFile: 'View exact source at this revision', back: 'All templates', footer: 'Independent public-interest project, maintained by Base Workers. No government or professional endorsement is claimed.', docs: 'Project repository', notReady: 'Not ready to publish or rely on.', languagesShort: { en: 'English', fr: 'Français', ar: 'العربية' }, categories: { business: 'Business', employment: 'Employment', privacy: 'Privacy', software: 'Software' } },
  fr: { locale: 'Français', code: 'fr', home: 'Accueil', catalog: 'Parcourir les modèles', purpose: 'OpenLegal', intro: 'Projets de documents juridiques d’intérêt public pour les personnes qui créent et exploitent des services en ligne au Maroc.', warning: 'PROJET — NON EXAMINÉ PAR UN JURISTE', warningBody: 'Ces documents sont des projets de discussion. Ils ne constituent pas un conseil juridique et ne certifient pas la conformité. Consultez un juriste marocain qualifié avant de vous fier à un document.', scope: '14 modèles · anglais, français et arabe · aucune approbation juridique enregistrée', search: 'Rechercher des modèles', searchHint: 'Rechercher par titre, identifiant, catégorie ou version', category: 'Catégorie', allCategories: 'Toutes les catégories', resultSingular: 'modèle', resultPlural: 'modèles affichés', noResults: 'Aucun modèle ne correspond à ces filtres.', open: 'Lire le projet', status: 'Statut', version: 'Version', languages: 'Langues', license: 'Licence', jurisdiction: 'Juridiction', updated: 'Dernière mise à jour', legalReview: 'Examen juridique', languageReview: 'Examen linguistique', sources: 'Sources déclarées', sourcesNote: 'Les références ne constituent pas une approbation juridique et ne prouvent ni l’actualité ni l’applicabilité du droit.', sourceStatus: 'Vérification de source enregistrée', reviewed: 'Examen humain', unknownRevision: 'Révision du dépôt indisponible', sourceFile: 'Voir la source exacte à cette révision', back: 'Tous les modèles', footer: 'Projet indépendant d’intérêt public, maintenu par Base Workers. Aucune approbation gouvernementale ou professionnelle n’est revendiquée.', docs: 'Dépôt du projet', notReady: 'Ne pas publier ni utiliser comme document final.', languagesShort: { en: 'English', fr: 'Français', ar: 'العربية' }, categories: { business: 'Entreprise', employment: 'Emploi', privacy: 'Vie privée', software: 'Logiciels' } },
  ar: { locale: 'العربية', code: 'ar', home: 'الرئيسية', catalog: 'تصفّح النماذج', purpose: 'OpenLegal', intro: 'مسودات نقاش لوثائق قانونية ذات منفعة عامة للأشخاص الذين ينشئون خدمات عبر الإنترنت في المغرب أو يديرونها.', warning: 'مسودة — لم يراجعها محامٍ', warningBody: 'هذه المواد مسودات للنقاش وليست استشارة قانونية ولا تثبت الامتثال القانوني. استشر محامياً مغربياً مؤهلاً قبل الاعتماد على أي وثيقة.', scope: '14 حزمة نموذج · الإنجليزية والفرنسية والعربية · لا توجد موافقات قانونية مسجلة', search: 'ابحث في النماذج', searchHint: 'ابحث بالعنوان أو المعرّف أو الفئة أو الإصدار', category: 'الفئة', allCategories: 'جميع الفئات', resultSingular: 'نموذج', resultPlural: 'نماذج معروضة', noResults: 'لا توجد نماذج تطابق عوامل التصفية.', open: 'اقرأ المسودة', status: 'الحالة', version: 'الإصدار', languages: 'اللغات', license: 'الترخيص', jurisdiction: 'الاختصاص القضائي', updated: 'آخر تحديث', legalReview: 'المراجعة القانونية', languageReview: 'المراجعة اللغوية', sources: 'المصادر المعلنة', sourcesNote: 'الإشارات المرجعية لا تعني الموافقة القانونية ولا تثبت حداثة القانون أو انطباقه.', sourceStatus: 'حالة التحقق من المصدر المسجلة', reviewed: 'المراجعة البشرية', unknownRevision: 'مراجعة المستودع غير متاحة', sourceFile: 'عرض المصدر المحدد في هذه المراجعة', back: 'جميع النماذج', footer: 'مشروع مستقل ذو منفعة عامة، تديره Base Workers. لا ندّعي تأييداً حكومياً أو مهنياً.', docs: 'مستودع المشروع', notReady: 'غير جاهزة للنشر أو الاعتماد.', languagesShort: { en: 'English', fr: 'Français', ar: 'العربية' }, categories: { business: 'الأعمال', employment: 'التوظيف', privacy: 'الخصوصية', software: 'البرمجيات' } },
};

const categories = ['business', 'employment', 'privacy', 'software'];
const langNames = { en: 'English', fr: 'Français', ar: 'العربية' };
const languageFor = (lang) => labels[lang];
const routeFor = (lang, id) => id ? `/${lang}/templates/${id}/index.html` : `/${lang}/index.html`;

function safeBaseUrl(value) {
  if (!value) return null;
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) throw new Error('--base-url must be an HTTPS origin or path without query or fragment');
  return `${parsed.href.replace(/\/+$/, '')}/`;
}

function languageNav(lang, template, depth) {
  const links = Object.keys(labels).map((code) => {
    const href = `${'../'.repeat(depth)}${code}/${template ? `templates/${template.id}/` : ''}index.html`;
    const supported = !template || template.metadata.languages.includes(code);
    return supported
      ? `<a href="${href}"${code === lang ? ' aria-current="page"' : ''} lang="${code}">${langNames[code]}</a>`
      : `<span aria-disabled="true" lang="${code}">${langNames[code]}</span>`;
  }).join('');
  return `<nav class="language-nav" aria-label="${lang === 'ar' ? 'اختر اللغة' : lang === 'fr' ? 'Choisir la langue' : 'Choose language'}">${links}</nav>`;
}

function shell({ lang, title, description, body, depth, template, baseUrl, canonicalPath, script = false }) {
  const t = languageFor(lang);
  const prefix = '../'.repeat(depth);
  const canonical = baseUrl ? `<link rel="canonical" href="${escapeHtml(new URL(canonicalPath.replace(/^\//, ''), baseUrl).href)}">` : '';
  const direction = lang === 'ar' ? 'rtl' : 'ltr';
  const rootHref = `${prefix}index.html`;
  return `<!doctype html>
<html lang="${lang}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  ${canonical}
  <title>${escapeHtml(title)} · ${escapeHtml(t.purpose)}</title>
  <link rel="stylesheet" href="${prefix}assets/site.css">
</head>
<body>
  <a class="skip-link" href="#main">${lang === 'ar' ? 'انتقل إلى المحتوى' : lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a>
  <header class="site-header"><div class="header-inner"><a class="brand" href="${rootHref}">${escapeHtml(t.purpose)}</a>${languageNav(lang, template, depth)}</div></header>
  <main id="main">${body}</main>
  <footer class="site-footer"><div class="site-footer-inner"><p>${escapeHtml(t.footer)}</p><nav aria-label="${lang === 'ar' ? 'روابط المشروع' : lang === 'fr' ? 'Liens du projet' : 'Project links'}"><a href="https://github.com/BaseWorkers/openlegal-morocco">${escapeHtml(t.docs)}</a><a href="https://github.com/BaseWorkers/openlegal-morocco/blob/main/DISCLAIMER.md">${lang === 'ar' ? 'إخلاء المسؤولية' : lang === 'fr' ? 'Avis de non-responsabilité' : 'Disclaimer'}</a></nav></div></footer>
  ${script ? `<script src="${prefix}assets/catalog.js" defer></script>` : ''}
</body>
</html>
`;
}

function reviewValue(value) {
  if (!value) return 'not recorded';
  return typeof value === 'string' ? value : value.status ?? 'not recorded';
}

function catalogBody(lang, catalog) {
  const t = languageFor(lang);
  const localizedCategory = (category) => t.categories[category] ?? category;
  const rows = catalog.map((template) => {
    const title = template.metadata.title?.[lang] ?? template.id;
    const categoriesValue = template.metadata.category ?? [template.category];
    const searchText = [title, template.id, template.metadata.version, ...categoriesValue].join(' ').toLocaleLowerCase();
    const languageText = template.metadata.languages.map((code) => t.languagesShort[code]).join(', ');
    return { template, title, categories: categoriesValue, searchText, languageText };
  });
  const sections = categories.map((category) => {
    const items = rows.filter(({ template }) => template.category === category);
    if (!items.length) return '';
    return `<section class="catalog-section" data-category-section="${category}"><h2>${escapeHtml(localizedCategory(category))}<span>${items.length}</span></h2><ul class="catalog-list">${items.map(({ template, title, categories: cats, searchText, languageText }) => `<li class="template-row" data-template data-categories="${escapeHtml(cats.join(' '))}" data-search="${escapeHtml(searchText)}"><div><h3><a href="templates/${encodeURIComponent(template.id)}/index.html">${escapeHtml(title)}</a></h3><p>${escapeHtml(template.metadata.id)} · ${escapeHtml(languageText)}</p></div><div class="row-meta"><span class="pill">${escapeHtml(template.metadata.status)}</span><span>${escapeHtml(t.version)} ${escapeHtml(template.metadata.version)}</span></div></li>`).join('')}</ul></section>`;
  }).join('');
  const totalCount = rows.length;
  return `<div class="page-intro"><p class="eyebrow">${escapeHtml(t.purpose)}</p><h1>${escapeHtml(t.catalog)}</h1><p class="lead">${escapeHtml(t.intro)}</p><div class="notice" role="note"><strong>${escapeHtml(t.warning)}</strong>${escapeHtml(t.warningBody)}</div><p class="trust-line">${escapeHtml(t.scope)}</p></div>
<section class="toolbar" aria-label="${escapeHtml(t.search)}"><div class="field"><label for="catalog-search">${escapeHtml(t.search)}</label><input id="catalog-search" type="search" autocomplete="off" aria-describedby="search-hint result-count" placeholder="${escapeHtml(t.searchHint)}"><span id="search-hint">${escapeHtml(t.searchHint)}</span></div><div class="field"><label for="category-filter">${escapeHtml(t.category)}</label><select id="category-filter"><option value="">${escapeHtml(t.allCategories)}</option>${categories.map((category) => `<option value="${category}">${escapeHtml(localizedCategory(category))}</option>`).join('')}</select></div><p id="result-count" class="result-count" aria-live="polite" data-singular="${escapeHtml(t.resultSingular)}" data-plural="${escapeHtml(t.resultPlural)}">${totalCount} ${escapeHtml(t.resultPlural)}</p></section>
<div id="empty-state" class="empty-state" role="status" hidden>${escapeHtml(t.noResults)}</div>${sections}`;
}

function detailBody(lang, template, registryById, repositoryRef) {
  const t = languageFor(lang);
  const metadata = template.metadata;
  const title = metadata.title?.[lang] ?? template.id;
  const categoriesText = (metadata.category ?? [template.category]).map((category) => t.categories[category] ?? category).join(', ');
  const sourceRecords = template.sources.source_ids.map((id) => registryById.get(id)).filter(Boolean);
  const sourceList = sourceRecords.length
    ? `<ul class="source-list">${sourceRecords.map((source) => {
      const url = /^https:\/\//i.test(source.url ?? '') ? `<a href="${escapeHtml(source.url)}" rel="noreferrer noopener">${escapeHtml(source.title)}</a>` : escapeHtml(source.title);
      return `<li>${url}<small>${escapeHtml(source.id)} · ${escapeHtml(source.publisher ?? '')} · ${escapeHtml(t.sourceStatus)}: ${escapeHtml(source.verification_status ?? 'not recorded')} · ${escapeHtml(source.date_accessed ?? 'date not recorded')}</small></li>`;
    }).join('')}</ul>` : `<p>${lang === 'ar' ? 'لا توجد مصادر منظمة معلنة.' : lang === 'fr' ? 'Aucune source structurée déclarée.' : 'No structured sources declared.'}</p>`;
  const exactSource = /^[a-f0-9]{40}$/i.test(repositoryRef)
    ? `<p><a href="https://github.com/BaseWorkers/openlegal-morocco/blob/${repositoryRef}/templates/${template.category}/${template.id}/${lang}.md">${escapeHtml(t.sourceFile)}</a></p>`
    : `<p>${escapeHtml(t.unknownRevision)}</p>`;
  const languages = metadata.languages.map((code) => t.languagesShort[code]).join(', ');
  const languageLinks = metadata.languages.map((code) => `<a lang="${code}" href="../../../${code}/templates/${encodeURIComponent(template.id)}/index.html">${escapeHtml(t.languagesShort[code])}</a>`).join('');
  const meta = [
    [t.status, metadata.status], [t.version, metadata.version], [t.languages, languages],
    [t.jurisdiction, (metadata.jurisdiction ?? []).join(', ') || '—'], [t.license, metadata.license ?? 'not recorded'],
    [t.legalReview, reviewValue(metadata.legal_review)], [t.languageReview, reviewValue(metadata.language_review?.[lang])],
    [t.updated, metadata.last_updated ?? 'not recorded'],
  ].map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  return `<p class="breadcrumb"><a href="../../index.html">${escapeHtml(t.back)}</a> / ${escapeHtml(categoriesText)}</p>
<div class="page-intro"><p class="eyebrow">${escapeHtml(categoriesText)} · ${escapeHtml(template.id)}</p><h1>${escapeHtml(title)}</h1><div class="notice" role="note"><strong>${escapeHtml(t.warning)}</strong>${escapeHtml(t.notReady)} ${escapeHtml(draftDisclaimer)}</div><div class="language-links" aria-label="${escapeHtml(t.languages)}">${languageLinks}</div></div>
<div class="detail-grid"><article class="document-body" aria-label="${escapeHtml(title)}">${renderMarkdownToHtml(template.content, { headingOffset: 1 })}</article><aside class="metadata-panel"><h2>${lang === 'ar' ? 'بيانات النموذج' : lang === 'fr' ? 'Détails du modèle' : 'Template details'}</h2><dl class="metadata-list">${meta}</dl><h2>${escapeHtml(t.sources)}</h2><p>${escapeHtml(t.sourcesNote)}</p>${sourceList}${exactSource}</aside></div>`;
}

function landingBody() {
  return `<div class="legal-content"><p class="eyebrow">OpenLegal</p><h1>Choose a language · Choisir une langue · اختر اللغة</h1><p class="lead">Independent, public-interest legal-document discussion drafts for Morocco. The project does not provide legal advice or certify compliance.</p><div class="notice" role="note"><strong>DRAFT — NOT LEGALLY REVIEWED</strong>Do not publish or rely on these materials without review by qualified Moroccan counsel.</div><ul class="language-choice"><li><a href="en/index.html" lang="en">English catalog</a></li><li><a href="fr/index.html" lang="fr">Catalogue français</a></li><li><a href="ar/index.html" lang="ar" dir="rtl">الفهرس العربي</a></li></ul><p>Maintained by Base Workers. No government or professional endorsement is claimed.</p></div>`;
}

export async function buildStaticSite({ outputDirectory = resolve(root, 'dist/site'), repositoryRef = process.env.GITHUB_SHA || 'working-tree', baseUrl: rawBaseUrl = process.env.OLM_SITE_BASE_URL } = {}) {
  const baseUrl = safeBaseUrl(rawBaseUrl);
  const catalog = await loadCatalog(root);
  const registry = JSON.parse(await readFile(resolve(root, 'sources/registry.yaml'), 'utf8'));
  const registryById = new Map(registry.sources.map((source) => [source.id, source]));
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(resolve(root, 'site/assets/site.css'), resolve(outputDirectory, 'assets/site.css')).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(resolve(outputDirectory, 'assets'), { recursive: true });
    await copyFile(resolve(root, 'site/assets/site.css'), resolve(outputDirectory, 'assets/site.css'));
  });
  await copyFile(resolve(root, 'site/assets/catalog.js'), resolve(outputDirectory, 'assets/catalog.js'));
  const routes = ['/index.html'];
  const landing = landingBody();
  await writeFile(resolve(outputDirectory, 'index.html'), shell({ lang: 'en', title: 'Choose a language', description: 'OpenLegal public-interest legal-document discussion drafts. Choose English, French, or Arabic.', body: landing, depth: 0, baseUrl, canonicalPath: '/index.html' }));

  for (const lang of ['en', 'fr', 'ar']) {
    const t = languageFor(lang);
    const indexRoute = routeFor(lang);
    routes.push(indexRoute);
    const indexPath = resolve(outputDirectory, indexRoute.slice(1));
    await mkdir(dirname(indexPath), { recursive: true });
    await writeFile(indexPath, shell({ lang, title: t.catalog, description: t.intro, body: catalogBody(lang, catalog), depth: 1, baseUrl, canonicalPath: indexRoute, script: true }));
    for (const template of catalog) {
      if (!template.metadata.languages.includes(lang)) continue;
      const route = routeFor(lang, template.id);
      routes.push(route);
      const detailPath = resolve(outputDirectory, route.slice(1));
      await mkdir(dirname(detailPath), { recursive: true });
      const content = await loadTemplateContent(template, lang);
      await writeFile(detailPath, shell({ lang, title: template.metadata.title?.[lang] ?? template.id, description: t.warningBody, body: detailBody(lang, { ...template, content }, registryById, repositoryRef), depth: 3, template, baseUrl, canonicalPath: route }));
    }
  }

  await writeFile(resolve(outputDirectory, 'robots.txt'), `User-agent: *\nAllow: /\n${baseUrl ? `Sitemap: ${new URL('sitemap.xml', baseUrl).href}\n` : ''}`);
  if (baseUrl) {
    const xmlEscape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${xmlEscape(new URL(route.slice(1), baseUrl).href)}</loc></url>`).join('\n')}\n</urlset>\n`;
    await writeFile(resolve(outputDirectory, 'sitemap.xml'), sitemap);
  }
  await writeFile(resolve(outputDirectory, 'site-manifest.json'), `${JSON.stringify({ generated_at: new Date().toISOString(), repository_ref: repositoryRef, page_count: routes.length, languages: ['en', 'fr', 'ar'], base_url_configured: Boolean(baseUrl), verified: false }, null, 2)}\n`);
  return { pageCount: routes.length, outputDirectory, repositoryRef, baseUrlConfigured: Boolean(baseUrl) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    let baseUrl = process.env.OLM_SITE_BASE_URL;
    if (args.length) {
      if (args.length !== 2 || args[0] !== '--base-url') throw new Error('Usage: npm run build:site [-- --base-url https://your-domain.example]');
      baseUrl = args[1];
    }
    const result = await buildStaticSite({ baseUrl });
    process.stdout.write(`Generated ${result.pageCount} static pages at ${result.outputDirectory} for ${result.repositoryRef}.\n`);
    if (!result.baseUrlConfigured) process.stdout.write('Canonical URLs and sitemap are omitted until the owner configures the public base URL.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
