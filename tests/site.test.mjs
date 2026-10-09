import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildStaticSite } from '../scripts/build-site.mjs';
import { loadCatalog } from '../scripts/catalog.mjs';

async function htmlFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

test('static catalog builds one detail route per template language with visible draft and source metadata', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'olm-site-test-'));
  try {
    const catalog = await loadCatalog();
    const expectedPages = 1 + 3 + (5 * 3) + catalog.reduce((count, template) => count + template.metadata.languages.length, 0);
    const result = await buildStaticSite({ outputDirectory, repositoryRef: 'a'.repeat(40) });
    assert.equal(result.pageCount, expectedPages);
    const root = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    assert.match(root, /Choose a language/);
    assert.match(root, /DRAFT — NOT LEGALLY REVIEWED/);
    for (const lang of ['en', 'fr', 'ar']) {
      const index = await readFile(join(outputDirectory, lang, 'index.html'), 'utf8');
      assert.match(index, new RegExp(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`));
      assert.equal((index.match(/data-template(?:\s|>)/g) ?? []).length, catalog.length);
      for (const slug of ['developers', 'reviewers', 'contribute', 'updates', 'about']) {
        const page = await readFile(join(outputDirectory, lang, 'resources', slug, 'index.html'), 'utf8');
        assert.match(page, new RegExp('<html lang="' + lang + '"'));
        assert.match(page, /Project resources|Ressources du projet|موارد المشروع/);
        assert.match(page, /DRAFT|PROJET|مسودة/);
      }

    }
    const detail = await readFile(join(outputDirectory, 'en/templates/privacy-policy/index.html'), 'utf8');
    assert.match(detail, /DRAFT/);
    assert.match(detail, /pending/);
    assert.match(detail, /cndp-loi-09-08/);
    assert.match(detail, new RegExp(`blob/${'a'.repeat(40)}/templates/privacy/privacy-policy/en.md`));
    assert.match(detail, /content="index,follow"/);
    assert.equal((await readdir(join(outputDirectory, 'assets'))).sort().join(','), 'catalog.js,site.css');
    assert.match(await readFile(join(outputDirectory, 'robots.txt'), 'utf8'), /User-agent: \*/);
    for (const page of await htmlFiles(outputDirectory)) {
      const html = await readFile(page, 'utf8');
      const h1s = html.match(/<h1\b/g) ?? [];
      assert.equal(h1s.length, 1, `${page} must have one page heading`);
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (/^(?:https?:|#|mailto:)/i.test(href)) continue;
        const resolved = fileURLToPath(new URL(href, pathToFileURL(page)));
        await stat(resolved);
      }
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('site emits absolute canonical URLs and an absolute sitemap only for configured HTTPS base URLs', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'olm-site-sitemap-'));
  try {
    await buildStaticSite({ outputDirectory, repositoryRef: 'revision', baseUrl: 'https://catalog.example.test/open-legal' });
    const detail = await readFile(join(outputDirectory, 'fr/templates/privacy-policy/index.html'), 'utf8');
    const sitemap = await readFile(join(outputDirectory, 'sitemap.xml'), 'utf8');
    const robots = await readFile(join(outputDirectory, 'robots.txt'), 'utf8');
    assert.match(detail, /rel="canonical" href="https:\/\/catalog\.example\.test\/open-legal\/fr\/templates\/privacy-policy\/index\.html"/);
    assert.match(sitemap, /<loc>https:\/\/catalog\.example\.test\/open-legal\/fr\/index\.html<\/loc>/);
    assert.match(robots, /Sitemap: https:\/\/catalog\.example\.test\/open-legal\/sitemap\.xml/);
    await assert.rejects(buildStaticSite({ outputDirectory, baseUrl: 'http://catalog.example.test' }), /HTTPS/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
