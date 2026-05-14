import { patchSection } from '../lib/db.ts';
import { fetchJson, fetchText } from '../lib/fetch.ts';
import type { AuditRow, CrawledPage, OnsiteSection } from '../lib/types.ts';

async function fetchLighthouse(url: string): Promise<OnsiteSection['lighthouse']> {
  const key = Deno.env.get('PAGESPEED_API_KEY');
  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  const params = new URLSearchParams({ url, strategy: 'mobile' });
  for (const cat of ['performance', 'accessibility', 'seo', 'best-practices']) params.append('category', cat);
  if (key) params.set('key', key);
  const data = await fetchJson(`${base}?${params.toString()}`, 60000);
  const cats = data?.lighthouseResult?.categories ?? {};
  const audits = data?.lighthouseResult?.audits ?? {};
  const score = (k: string) => cats[k] ? Math.round(cats[k].score * 100) : null;
  const num = (k: string) => audits[k]?.numericValue ?? null;
  return {
    performance: score('performance'),
    accessibility: score('accessibility'),
    best_practices: score('best-practices'),
    seo: score('seo'),
    cwv: {
      lcp_ms: num('largest-contentful-paint'),
      cls: num('cumulative-layout-shift'),
      inp_ms: num('interaction-to-next-paint') ?? num('experimental-interaction-to-next-paint'),
    },
  };
}

async function checkSitemap(domain: string): Promise<{ found: boolean; url_count: number }> {
  try {
    const xml = await fetchText(`https://${domain}/sitemap.xml`, 5000);
    const urlCount = (xml.match(/<loc>/g) || []).length;
    return { found: urlCount > 0, url_count: urlCount };
  } catch { return { found: false, url_count: 0 }; }
}

function computeIssues(pages: CrawledPage[]): OnsiteSection['issues'] {
  const issues: OnsiteSection['issues'] = [];
  for (const p of pages) {
    if (!p.title) issues.push({ severity: 'high', message: 'Missing <title>', page: p.url });
    else if (p.title.length < 30) issues.push({ severity: 'med', message: `Title is short (${p.title.length} chars)`, page: p.url });
    else if (p.title.length > 65) issues.push({ severity: 'low', message: `Title is long (${p.title.length} chars)`, page: p.url });
    if (!p.meta_desc) issues.push({ severity: 'high', message: 'Missing meta description', page: p.url });
    if (p.h1.length === 0) issues.push({ severity: 'high', message: 'No H1 on page', page: p.url });
    if (p.h1.length > 1) issues.push({ severity: 'med', message: `Multiple H1s (${p.h1.length})`, page: p.url });
    if (!p.canonical) issues.push({ severity: 'low', message: 'No canonical URL', page: p.url });
    if (p.alt_coverage < 0.8) issues.push({ severity: 'med', message: `Alt coverage ${Math.round(p.alt_coverage * 100)}%`, page: p.url });
    if (!p.viewport_set) issues.push({ severity: 'high', message: 'Missing viewport meta', page: p.url });
    if (p.schema_jsonld_count === 0) issues.push({ severity: 'low', message: 'No schema.org JSON-LD found', page: p.url });
    if (!p.https) issues.push({ severity: 'high', message: 'Not served over HTTPS', page: p.url });
    if (p.robots_meta && /noindex/i.test(p.robots_meta)) {
      issues.push({ severity: 'high', message: 'Page is set to noindex', page: p.url });
    }
  }
  return issues;
}

export async function runOnsite(audit: AuditRow): Promise<void> {
  try {
    const cache = audit.sections.onsite_crawl_cache;
    if (!cache?.length) {
      await patchSection(audit.id, 'onsite', { error: 'no_crawl_cache' });
      return;
    }
    const [lighthouse, sitemap] = await Promise.all([
      fetchLighthouse(`https://${audit.domain}/`).catch((e) => { console.error('lighthouse failed', e); return ({
        performance: null, accessibility: null, best_practices: null, seo: null,
        cwv: { lcp_ms: null, cls: null, inp_ms: null },
      }); }),
      checkSitemap(audit.domain),
    ]);
    const issues = computeIssues(cache);
    const section: OnsiteSection = {
      pages_crawled: cache.map((p) => ({ ...p, text_content: undefined })),
      lighthouse,
      issues,
      sitemap_found: sitemap.found,
      sitemap_url_count: sitemap.url_count,
    };
    await patchSection(audit.id, 'onsite', section);
  } catch (e) {
    await patchSection(audit.id, 'onsite', { error: String(e) });
  }
}
