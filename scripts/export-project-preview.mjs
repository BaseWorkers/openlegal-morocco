import { access, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInternalMarkdownDocument } from './project-export-policy.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectVersion = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')).version;
const outputArgument = process.argv[2];
const previewFlag = process.argv.includes('--preview');

function usage() {
  throw new Error('Usage: npm run export:project-preview -- <new-output-directory> --preview');
}

function assertOutsideRepository(repositoryPath, outputPath) {
  const pathFromRoot = relative(repositoryPath, outputPath);
  if (pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot))) {
    throw new Error('Choose an output directory outside the working repository.');
  }
}

async function copyTree(source, target, { skipReadmes = false } = {}) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Refusing to export a symbolic link: ${source}`);
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (skipReadmes && entry.isFile() && entry.name.toLowerCase() === 'readme.md') continue;
      await copyTree(join(source, entry.name), join(target, entry.name), { skipReadmes });
    }
    return;
  }
  if (!info.isFile()) throw new Error(`Refusing to export a non-regular file: ${source}`);
  await mkdir(dirname(target), { recursive: true });
  const content = await readFile(source);
  await writeFile(target, content, { flag: 'wx' });
}

async function assertNoInternalMarkdown(sources) {
  for (const source of sources) {
    const info = await lstat(source);
    if (info.isSymbolicLink()) throw new Error(`Refusing to export a symbolic link: ${source}`);
    if (info.isDirectory()) {
      for (const entry of await readdir(source, { withFileTypes: true })) {
        await assertNoInternalMarkdown([join(source, entry.name)]);
      }
      continue;
    }
    if (info.isFile() && source.toLowerCase().endsWith('.md')) {
      const filename = source.split(sep).at(-1);
      const contents = await readFile(source, 'utf8');
      if (isInternalMarkdownDocument(filename, contents) && relative(repositoryRoot, source).split(sep).join('/') !== 'INTEGRATIONS.md') {
        throw new Error(`Refusing project-only export because Markdown content contains an internal planning or build reference: ${source}`);
      }
    }
  }
}

async function readTemplateMetadata(directory) {
  return JSON.parse(await readFile(join(directory, 'metadata.yaml'), 'utf8'));
}

async function writeProjectLicenseFiles(outputPath) {
  await mkdir(join(outputPath, 'LICENSES'), { recursive: true });
  const sourceScopes = JSON.parse(await readFile(join(repositoryRoot, 'LICENSES/scopes.json'), 'utf8'));
  const allowedPatterns = new Set([
    'templates/**', 'clauses/**', 'research/**', 'sources/**', 'reviews/**',
    'README.md', 'README.fr.md', 'README.ar.md', 'RELEASE_NOTES.md', 'INTEGRATIONS.md', 'CODE_OF_CONDUCT.md', 'DISCLAIMER.md', 'GOVERNANCE.md', 'REVIEWING.md', 'docs/REVIEWER_ONBOARDING.md',
    'SECURITY.md', 'CONTRIBUTING.md', '.github/ISSUE_TEMPLATE/**',
    '.github/PULL_REQUEST_TEMPLATE.md', 'LICENSES/README.md', 'LICENSES/scopes.json',
    'scripts/**', 'schemas/**', 'tests/**', 'docs/**', '.github/workflows/**',
    'package.json', '.gitignore', 'tests/fixtures/template-package/**',
    'LICENSES/CC0-1.0.txt', 'LICENSES/MIT.txt'
  ]);
  const scopes = {
    ...sourceScopes,
    rules: sourceScopes.rules.map((rule) => ({
      ...rule,
      patterns: rule.patterns.filter((pattern) => allowedPatterns.has(pattern))
    })).filter((rule) => rule.patterns.length > 0)
  };
  await writeFile(join(outputPath, 'LICENSES/scopes.json'), `${JSON.stringify(scopes, null, 2)}\n`, { flag: 'wx' });
  await writeFile(join(outputPath, 'LICENSES/README.md'), [
    '# License policy',
    '',
    'The project uses separate intended licenses for original legal content and software:',
    '',
    '- Project-authored templates, clauses, research prose, source records, and review metadata: CC0-1.0.',
    '- Project-authored scripts, schemas, tests, workflow files, package metadata, and repository configuration: MIT.',
    '- The included CC0-1.0 and MIT license texts retain their own notices.',
    '',
    'The path map in [`scopes.json`](scopes.json) describes intended scope only. It does not establish ownership, clear third-party rights, or apply the project license to material with separate rights or notices. Reviewer-authored submissions retain their own rights unless an authorized agreement states otherwise. Template source declarations and attribution requirements remain in effect.',
    '',
    `This v${projectVersion} tooling preview publishes the stated license targets to invite review and contribution. The path map and ownership review remain provisional; this notice does not establish ownership or clear third-party rights. Please do not contribute material unless you have the right to share it under the applicable project license.`,
    '',
    'See [`CC0-1.0.txt`](CC0-1.0.txt) and [`MIT.txt`](MIT.txt) for license texts. Canonical sources: [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) and [Open Source Initiative MIT License](https://opensource.org/license/mit).',
    ''
  ].join('\n'), { flag: 'wx' });
}

function makeReadme(packages) {
  const groups = new Map();
  for (const { category, metadata } of packages) {
    const group = category[0].toUpperCase() + category.slice(1);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(metadata);
  }

  const lines = [
    '# Open Legal Morocco',
    '',
    '[English](README.md) · [Français](README.fr.md) · [العربية](README.ar.md)',
    '',
    `**v${projectVersion} · Local tooling test preview**`,
    '',
    'An independent, public-interest project building reusable legal-document resources to help Moroccan startups and other teams operating online recognize common legal questions and prepare discussion drafts for qualified Moroccan counsel. The project has no profit-making aim; this describes its purpose, not a registered legal status. The project is open to community contribution and adaptation, and its license terms allow reuse, including commercial reuse.',
    '',
    'We welcome Moroccan lawyers and legal researchers, Arabic/French/English translators, founders, and software contributors to help review, improve, translate, or adapt the project. To apply as a legal reviewer, language reviewer, research reviewer, or community moderator, use the [reviewer interest form](https://github.com/BaseWorkers/openlegal-morocco/issues/new?template=reviewer-interest.yml) and read the [onboarding guide](docs/REVIEWER_ONBOARDING.md). The form and replies are public; do not submit private documents or contact details. For other contributions, open **Issues → New issue → Offer a contribution**. See [Contributing](CONTRIBUTING.md) and [release notes](RELEASE_NOTES.md).',
    '',
    '## Local tools',
    '',
    'Try the [CLI and MCP smoke tests](INTEGRATIONS.md) against this local checkout. Both tools are read-only; their output does not count as professional review.',
    '',
    '## Current status',
    '',
    `This v${projectVersion} preview contains ${packages.length} structured template packages shared for community review and contribution. They are not ready for public reliance. No template is marked \`LEGAL_REVIEWED\` or \`RELEASED\`, and no authorized human legal or language review is recorded.`,
    '',
    'The files are working drafts. They may be incomplete, outdated, or unsuitable for a specific person, transaction, or business. The project does not certify that a business or document is legally compliant. Do not sign or rely on them without qualified Moroccan legal advice.',
    '',
    '## Browse templates',
    ''
  ];

  for (const [group, entries] of groups) {
    lines.push(`### ${group}`, '');
    for (const metadata of entries) {
      const id = metadata.id;
      const packagePath = packages.find((item) => item.metadata.id === id)?.relativePath;
      if (!packagePath) continue;
      const title = metadata.title.en;
      lines.push(`- [${title}](${packagePath}/en.md) · [FR](${packagePath}/fr.md) · [AR](${packagePath}/ar.md) — ${metadata.status}; v${metadata.version}`);
    }
    lines.push('');
  }

  lines.push(
    '## Sources and limitations',
    '',
    'Each package includes its own source declarations, assumptions, and review notes. The source registry and Morocco research folder provide additional provenance. Source references do not mean that a template has been legally approved or that a cited rule is current.',
    '',
    'Machine-readable review ledgers and the reviewer authorization registry are included for provenance. Their current empty state means no human review approval is recorded. The included schemas describe the project data formats.',
    '',
    'This repository also includes the project validation and export tools, automated GitHub checks, and test fixtures that support the template and provenance system.',
    '',
    '## Project policies',
    '',
    '- [Governance](GOVERNANCE.md)',
    '- [Contributing](CONTRIBUTING.md)',
    '- [Reviewing and feedback](REVIEWING.md)',
    '- [Code of Conduct](CODE_OF_CONDUCT.md)',
    '- [Security policy](SECURITY.md)',
    '- [License policy](LICENSES/README.md)',
    '- [CLI and MCP testing](INTEGRATIONS.md)',
    '',
    'Read [DISCLAIMER.md](DISCLAIMER.md) before using any material. Original legal content, research prose, and template packages are intended for CC0-1.0 ([license text](LICENSES/CC0-1.0.txt)); included schemas and tooling are intended for MIT ([license text](LICENSES/MIT.txt)). The scope map is provisional and does not clear third-party material or reviewer submissions, which remain subject to their own rights and notices. Only contribute material you have the right to share under the applicable license.',
    ''
  );
  return lines.join('\n');
}

function makeFrenchReadme(packages) {
  return [
    '# Open Legal Morocco — Français',
    '',
    '[English](README.md) · [Français](README.fr.md) · [العربية](README.ar.md)',
    '',
    `**v${projectVersion} · Aperçu de test des outils locaux**`,
    '',
    'Projet open source indépendant, d’intérêt public, qui aide les startups marocaines et les autres équipes opérant en ligne à repérer les questions juridiques courantes et à préparer des projets de documents à discuter avec un professionnel qualifié en droit marocain. Le projet n’a pas de but lucratif ; cela décrit son objectif sans affirmer qu’il possède un statut juridique enregistré d’organisme sans but lucratif. Les licences prévues autorisent la réutilisation, y compris commerciale, selon leurs conditions.',
    '',
    `Cette version comprend ${packages.length} dossiers de modèles structurés en anglais, français et arabe. Tous sont à l’état de brouillon. Aucun n’est marqué comme révisé par un juriste ni comme publié, et aucun évaluateur juridique ou linguistique n’est actuellement autorisé.`,
    '',
    'Les documents peuvent être incomplets, dépassés ou inadaptés à une situation donnée. Le projet ne certifie pas la conformité juridique d’une entreprise ou d’un document. Ces textes ne constituent pas un conseil juridique ; consultez un professionnel qualifié en droit marocain avant de vous y fier ou de les signer.',
    '',
    'Les contributions sont les bienvenues en recherche juridique, vérification des sources, révision linguistique, accessibilité, adaptation et logiciel. Pour demander à rejoindre l’équipe de révision ou de modération, utilisez le formulaire public d’intérêt ([reviewer interest form](https://github.com/BaseWorkers/openlegal-morocco/issues/new?template=reviewer-interest.yml)) et consultez le [guide d’intégration](docs/REVIEWER_ONBOARDING.md). Le formulaire et les réponses sont publics ; ne publiez pas de documents privés ni de coordonnées personnelles. Pour les autres contributions, ouvrez **Issues → New issue → Offer a contribution**. Consultez [Contribuer](CONTRIBUTING.md), [Révision et retours](REVIEWING.md) et les [notes de version](RELEASE_NOTES.md).',
    '',
    'La carte des licences et l’examen des droits restent provisoires. Les droits et avis propres aux tiers restent applicables. Consultez la [politique de licence](LICENSES/README.md), la [gouvernance](GOVERNANCE.md) et l’[avertissement](DISCLAIMER.md).',
    '',
    'Cette présentation française est un texte de projet non validé séparément. Les corrections et améliorations linguistiques sont bienvenues.',
    ''
  ].join('\n');
}

function makeArabicReadme(packages) {
  return [
    '# Open Legal Morocco — العربية',
    '',
    '[English](README.md) · [Français](README.fr.md) · [العربية](README.ar.md)',
    '',
    `**v${projectVersion} · معاينة لاختبار الأدوات المحلية**`,
    '',
    'مشروع مستقل ومفتوح المصدر ذو غاية ذات نفع عام، يهدف إلى مساعدة الشركات الناشئة المغربية والفرق الأخرى التي تعمل عبر الإنترنت على التعرّف على المسائل القانونية الشائعة وإعداد مسودات للنقاش مع مهني مؤهل في القانون المغربي. لا يهدف المشروع إلى تحقيق الربح؛ وهذا يصف غايته ولا يعني أنه مسجل كجمعية أو يتمتع بصفة قانونية غير ربحية. وتسمح التراخيص المستهدفة بإعادة الاستخدام، بما في ذلك الاستخدام التجاري، وفق شروط كل ترخيص.',
    '',
    `تتضمن هذه النسخة ${packages.length} حزمة منظمة من مسودات النماذج بالإنجليزية والفرنسية والعربية. جميعها في حالة مسودة. لم تُصنّف أي منها على أنها مراجعة قانونيا أو منشورة، ولا يوجد حاليا مراجع قانوني أو لغوي معتمد.`,
    '',
    'قد تكون الوثائق ناقصة أو غير محدثة أو غير مناسبة لحالة معينة. ولا يشهد المشروع بأن أي شركة أو وثيقة متوافقة مع القانون. هذه النصوص لا تشكل استشارة قانونية؛ استشر مهنيا مؤهلا في القانون المغربي قبل الاعتماد عليها أو توقيعها.',
    '',
    'نرحب بالمساهمات في البحث القانوني والتحقق من المصادر والمراجعة اللغوية وإمكانية الوصول والتكييف والبرمجيات. للتقدم كمراجع قانوني أو لغوي أو مشرف مجتمعي، استخدم [استمارة إبداء الاهتمام العامة](https://github.com/BaseWorkers/openlegal-morocco/issues/new?template=reviewer-interest.yml) واطلع على [دليل الانضمام](docs/REVIEWER_ONBOARDING.md). الاستمارة والردود علنية؛ لا تنشر وثائق خاصة أو بيانات اتصال شخصية. للمساهمات الأخرى، افتح **Issues → New issue → Offer a contribution**. راجع أدلة [المساهمة](CONTRIBUTING.md) و[المراجعة وإبداء الملاحظات](REVIEWING.md) و[ملاحظات الإصدار](RELEASE_NOTES.md).',
    '',
    'ما زال توزيع التراخيص ومراجعة الحقوق مؤقتين. وتظل الحقوق والإشعارات الخاصة بمواد الغير سارية. راجع [سياسة الترخيص](LICENSES/README.md) و[الحوكمة](GOVERNANCE.md) و[إخلاء المسؤولية](DISCLAIMER.md).',
    '',
    'هذا التعريف العربي نصٌّ للمشروع لم يخضع لمراجعة مستقلة. نرحب بالتصحيحات والتحسينات اللغوية.',
    ''
  ].join('\n');
}

async function collectPackages() {
  const templateRoot = join(repositoryRoot, 'templates');
  const packages = [];
  for (const categoryEntry of await readdir(templateRoot, { withFileTypes: true })) {
    if (!categoryEntry.isDirectory()) continue;
    const category = categoryEntry.name;
    const categoryPath = join(templateRoot, category);
    for (const packageEntry of await readdir(categoryPath, { withFileTypes: true })) {
      if (!packageEntry.isDirectory()) continue;
      const packageDirectory = join(categoryPath, packageEntry.name);
      const metadata = await readTemplateMetadata(packageDirectory);
      packages.push({
        category,
        metadata,
        relativePath: `templates/${category}/${packageEntry.name}`,
        sourcePath: packageDirectory
      });
    }
  }
  return packages.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function main() {
  if (!outputArgument || !previewFlag) usage();
  const outputPath = resolve(outputArgument);
  assertOutsideRepository(repositoryRoot, outputPath);
  try {
    await access(outputPath);
    throw new Error(`Output already exists; choose a new empty path: ${outputPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const [canonicalRepositoryRoot, canonicalOutputParent] = await Promise.all([
    realpath(repositoryRoot),
    realpath(dirname(outputPath)).catch(async (error) => {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(dirname(outputPath), { recursive: true });
      return realpath(dirname(outputPath));
    })
  ]);
  const canonicalOutputPath = join(canonicalOutputParent, outputPath.split(sep).at(-1));
  assertOutsideRepository(canonicalRepositoryRoot, canonicalOutputPath);
  try {
    await access(canonicalOutputPath);
    throw new Error(`Output already exists; choose a new empty path: ${canonicalOutputPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const packages = await collectPackages();
  if (packages.length === 0) throw new Error('No template packages were found.');
  const includedSources = [
    ...packages.map(({ sourcePath }) => sourcePath),
    ...[
      'research/morocco',
      'research/comparative/reusable-template-candidates.md',
      'sources/registry.yaml',
      'sources/official-morocco.yaml',
      'clauses/catalog.yaml',
      'reviews/records.json',
      'reviews/research-records.json',
      'reviews/authorized-reviewers.yaml',
      'LICENSES/CC0-1.0.txt',
      'LICENSES/MIT.txt',
      'package.json',
      '.gitignore',
      'scripts',
      'tests',
      'CODE_OF_CONDUCT.md',
      'RELEASE_NOTES.md', 'INTEGRATIONS.md',
      'CONTRIBUTING.md',
      'REVIEWING.md',
      'docs/REVIEWER_ONBOARDING.md',
      'GOVERNANCE.md',
      'SECURITY.md',
      '.github/ISSUE_TEMPLATE',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/workflows/ci.yml'
    ].map((path) => join(repositoryRoot, path)),
    join(repositoryRoot, 'schemas')
  ];
  await assertNoInternalMarkdown(includedSources);
  await mkdir(canonicalOutputPath, { recursive: false });

  for (const { relativePath, sourcePath } of packages) {
    await copyTree(sourcePath, join(canonicalOutputPath, relativePath));
  }
  for (const path of [
    'research/morocco',
    'research/comparative/reusable-template-candidates.md',
    'sources/registry.yaml',
    'sources/official-morocco.yaml',
    'clauses/catalog.yaml',
    'reviews/records.json',
    'reviews/research-records.json',
    'reviews/authorized-reviewers.yaml',
    'schemas'
  ]) {
    await copyTree(join(repositoryRoot, path), join(canonicalOutputPath, path), { skipReadmes: path === 'research/morocco' || path === 'schemas' });
  }
  for (const path of ['package.json', '.gitignore', 'scripts', 'tests', 'CODE_OF_CONDUCT.md', 'RELEASE_NOTES.md', 'INTEGRATIONS.md', 'CONTRIBUTING.md', 'REVIEWING.md', 'docs/REVIEWER_ONBOARDING.md', 'GOVERNANCE.md', 'SECURITY.md', '.github/ISSUE_TEMPLATE', '.github/PULL_REQUEST_TEMPLATE.md', '.github/workflows/ci.yml']) {
    await copyTree(join(repositoryRoot, path), join(canonicalOutputPath, path));
  }
  await writeProjectLicenseFiles(canonicalOutputPath);
  const intellectualPropertyNote = join(canonicalOutputPath, 'research/morocco/intellectual-property.md');
  const intellectualPropertyText = await readFile(intellectualPropertyNote, 'utf8');
  const oldRegistryLink = '[source registry](../../sources/README.md)';
  const exportedRegistryLink = '[source registry](../../sources/registry.yaml)';
  if (intellectualPropertyText.includes(oldRegistryLink)) {
    await writeFile(
      intellectualPropertyNote,
      intellectualPropertyText.replace(oldRegistryLink, exportedRegistryLink),
      { flag: 'w' }
    );
  } else if (!intellectualPropertyText.includes(exportedRegistryLink)) {
    throw new Error('Expected source-registry link was not found in the exported research note.');
  }
  await copyTree(join(repositoryRoot, 'LICENSES/CC0-1.0.txt'), join(canonicalOutputPath, 'LICENSES/CC0-1.0.txt'));
  await copyTree(join(repositoryRoot, 'LICENSES/MIT.txt'), join(canonicalOutputPath, 'LICENSES/MIT.txt'));
  await writeFile(join(canonicalOutputPath, 'README.md'), makeReadme(packages), { flag: 'wx' });
  await writeFile(join(canonicalOutputPath, 'README.fr.md'), makeFrenchReadme(packages), { flag: 'wx' });
  await writeFile(join(canonicalOutputPath, 'README.ar.md'), makeArabicReadme(packages), { flag: 'wx' });
  await writeFile(join(canonicalOutputPath, 'DISCLAIMER.md'), [
    '# Disclaimer',
    '',
    'Open Legal Morocco provides informational materials and discussion drafts, not legal advice. The project does not create an attorney-client relationship and does not guarantee that any document is valid, enforceable, current, suitable, or compliant for a particular transaction.',
    '',
    'Moroccan law and its interpretation can change. Review the sources, assumptions, version, and review status for the exact document. Consult a qualified Moroccan legal professional before relying on, adapting, or signing a template.',
    '',
    'No government, regulator, CNDP, or professional endorsement should be inferred. Automated drafting, validation, or translation does not constitute legal or language review.',
    ''
  ].join('\n'), { flag: 'wx' });

  const unreleasedCount = packages.filter(({ metadata }) => metadata.status !== 'RELEASED').length;
  console.log(`Created project-only preview at ${canonicalOutputPath}`);
  console.log(`Included ${packages.length} template packages and ${unreleasedCount} packages not marked RELEASED.`);
  console.log('This is an early contribution release candidate, not legal or language approval. Roadmaps, Codex notes, and development setup documentation are excluded.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
