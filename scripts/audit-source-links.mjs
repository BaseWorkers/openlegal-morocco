import { readFile } from 'node:fs/promises';
import { classifySourceLinkStatus, isAllowedSourceLinkTarget, normalizeSourceUrl } from './source-link-policy.mjs';
import { requestPublicSource } from './source-link-network.mjs';

const registry = JSON.parse(await readFile(new URL('../sources/registry.yaml', import.meta.url), 'utf8'));
const concurrency = Math.max(1, Number.parseInt(process.env.OLM_LINK_AUDIT_CONCURRENCY ?? '6', 10) || 6);
const timeoutMs = Math.max(250, Number.parseInt(process.env.OLM_LINK_AUDIT_TIMEOUT_MS ?? '15000', 10) || 15000);
const retries = Math.max(0, Number.parseInt(process.env.OLM_LINK_AUDIT_RETRIES ?? '2', 10) || 0);
const maxRedirects = 10;

const urls = [...new Set(registry.sources.map((source) => normalizeSourceUrl(source.url)).filter(Boolean))].sort();
const invalid = registry.sources.filter((source) => !normalizeSourceUrl(source.url));
if (invalid.length) {
  for (const source of invalid) process.stderr.write(`Invalid HTTPS source URL: ${source.id}: ${source.url}\n`);
  process.exitCode = 1;
}

async function check(url) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let requestUrl = url;
      let redirects = 0;
      let response;
      while (true) {
        response = await requestPublicSource(requestUrl, {
          headers: {
            Range: 'bytes=0-0',
            'User-Agent': 'OpenLegalMoroccoSourceLinkAudit/1.0'
          },
          timeoutMs,
          signal: controller.signal
        });
        const status = response.statusCode;
        if (status < 300 || status >= 400) break;
        const location = response.headers.location;
        response.destroy();
        if (!location) return { url, status, classification: 'inconclusive', error: 'redirect response has no Location header', finalUrl: requestUrl };
        if (redirects >= maxRedirects) return { url, status, classification: 'inconclusive', error: `redirect limit exceeded (${maxRedirects})`, finalUrl: requestUrl };
        let nextUrl;
        try {
          nextUrl = new URL(location, requestUrl);
        } catch {
          return { url, status, classification: 'inconclusive', error: 'redirect Location is not a valid URL', finalUrl: requestUrl };
        }
        if (nextUrl.protocol !== 'https:') {
          return { url, status, classification: 'inconclusive', error: 'redirect target is not HTTPS', finalUrl: nextUrl.href };
        }
        if (!isAllowedSourceLinkTarget(nextUrl.href)) {
          return { url, status, classification: 'inconclusive', error: 'redirect target host is not allowlisted', finalUrl: nextUrl.href };
        }
        requestUrl = nextUrl.href;
        redirects += 1;
      }
      const status = response.statusCode;
      const result = { url, status, classification: classifySourceLinkStatus(status), finalUrl: requestUrl };
      response.destroy();
      if ((status >= 500 || status === 429) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      return result;
    } catch (error) {
      if (attempt === retries) return { url, classification: 'inconclusive', error: error.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error.message };
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
}

const results = [];
for (let index = 0; index < urls.length; index += concurrency) {
  results.push(...await Promise.all(urls.slice(index, index + concurrency).map(check)));
}

const missing = results.filter((result) => result.classification === 'missing');
const inconclusive = results.filter((result) => result.classification === 'inconclusive');
for (const result of results) {
  if (result.classification === 'missing') process.stderr.write(`BROKEN ${result.status} ${result.url}\n`);
  else if (result.classification === 'inconclusive') process.stdout.write(`INCONCLUSIVE ${result.status ?? result.error} ${result.url}\n`);
  else if (result.finalUrl !== result.url) process.stdout.write(`REDIRECT ${result.status} ${result.url} -> ${result.finalUrl}\n`);
}

process.stdout.write(`Checked ${urls.length} distinct source URLs (${registry.sources.length} registry records): ${results.length - missing.length - inconclusive.length} reachable, ${missing.length} missing, ${inconclusive.length} inconclusive.\n`);
if (missing.length) process.exitCode = 1;
