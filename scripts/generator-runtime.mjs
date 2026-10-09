import { escapeMarkdownValue, renderTemplateText } from './generator-core.mjs';
import { validateGeneratorVariablePolicy } from './generator-policy.mjs';
import { validateTemplateSourceUsePolicy } from './template-source-use-policy.mjs';
import { escapeHtml, renderMarkdownToHtml } from './markdown-renderer.mjs';

export function isGeneratorEligible(template) {
  if (!template || !template.metadata || !Array.isArray(template.variables) || !Array.isArray(template.metadata.languages)) return false;
  if (template.sources !== undefined && !Array.isArray(template.sources)) return false;
  const { metadata, variables } = template;
  const sourceUses = template.sources ?? [];
  const sourceIds = sourceUses.map((source) => source.source_id);
  return metadata.status === 'RELEASED'
    && metadata.legal_review?.status === 'reviewed'
    && metadata.generator_enabled === true
    && metadata.languages.every((language) => metadata.language_review?.[language] === 'reviewed')
    && validateGeneratorVariablePolicy(variables).length === 0
    && validateTemplateSourceUsePolicy({ source_ids: sourceIds, source_uses: sourceUses }, sourceUses).length === 0;
}

function markdownUrl(value) {
  return new URL(value).href.replaceAll('(', '%28').replaceAll(')', '%29');
}

function thirdPartyNotice(template) {
  const reused = (template.sources ?? []).filter((source) => source.use === 'reused-wording');
  if (reused.length === 0) return '';
  const notices = reused.map((source) => [
    `**Attribution:** [${escapeMarkdownValue(source.attribution)}](${markdownUrl(source.url)})`,
    `**License:** [${escapeMarkdownValue(source.reuse_license)}](${markdownUrl(source.license_url)})`,
    `**Scope:** ${escapeMarkdownValue(source.scope)}`,
    `**Modifications:** ${escapeMarkdownValue(source.modifications)}`,
    `This third-party material retains its source license and is not relicensed under the project-created content license target.`
  ].join('  \n')).join('\n\n');
  return `\n\n---\n\n### Third-party attribution and license notices (not contract terms)\n\n${notices}`;
}

export function renderGeneratedMarkdown(template, language, values) {
  if (!isGeneratorEligible(template)) throw new Error('This template has not passed all release and generator input gates.');
  if (!template.metadata.languages.includes(language) || template.metadata.language_review?.[language] !== 'reviewed') {
    throw new Error(`Language ${language} is not approved for generation.`);
  }
  const body = renderTemplateText(template.contents[language], template.variables, values);
  const title = escapeMarkdownValue(template.metadata.title[language]);
  const contentLicense = `**Project-created content license target (not a contract clause):** ${escapeMarkdownValue(template.metadata.license)}; any third-party material keeps its source license and notices.`;
  return `${body.trimEnd()}\n\n---\n\n**Document metadata (not a contract clause):** ${title} · ${escapeMarkdownValue(template.metadata.id)} · v${escapeMarkdownValue(template.metadata.version)} · ${escapeMarkdownValue(language)}\n\n${contentLicense}${thirdPartyNotice(template)}\n`;
}

export function renderGeneratedHtml(template, language, markdown) {
  const title = template.metadata.title[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const rendered = renderMarkdownToHtml(markdown);
  return `<!doctype html>
<html lang="${escapeHtml(language)}" dir="${direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; form-action 'none'">
<style>@page{size:A4;margin:20mm}body{font:16px/1.6 system-ui,sans-serif;color:#172a3a;margin:0 auto;max-width:50rem;padding:2rem 1rem}.document{white-space:normal}.document h2{border-bottom:1px solid #d3dde4;padding-bottom:.25rem;margin-top:2rem}.document h2,.document h3,.document h4{break-after:avoid}.document p,.document li,.document tr{orphans:3;widows:3}.document table{border-collapse:collapse;width:100%;break-inside:avoid}.document th,.document td{border:1px solid #d3dde4;padding:.5rem;text-align:start}.document-footer{border-top:1px solid #d3dde4;color:#526474;margin-top:3rem;padding-top:1rem}@media print{body{max-width:none;padding:0}.document-footer{position:fixed;bottom:0;inset-inline:0;margin:0;padding:.35rem 0;background:#fff}}</style></head>
<body><main class="document">${rendered}</main><footer class="document-footer">${escapeHtml(title)} · ${escapeHtml(template.metadata.id)} · v${escapeHtml(template.metadata.version)} · ${escapeHtml(language)} · OpenLegal</footer></body></html>`;
}
