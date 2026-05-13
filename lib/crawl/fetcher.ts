export async function fetchHtml(url: string, timeoutMs = 5000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEO-GEO-Audit-Bot/1.0 (+contact: gokhanseckin@gmail.com)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new Error(`Not HTML: ${ct}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface CrawlResult {
  homepage: { url: string; html: string };
  pages: { url: string; html: string }[];
}

export async function crawlSite(domain: string, maxPages = 5): Promise<CrawlResult> {
  const root = `https://${domain}/`;
  const homepageHtml = await fetchHtml(root);
  const { extractInternalLinks } = await import('./parser');
  const links = extractInternalLinks(homepageHtml, root)
    .filter((u) => u !== root)
    .slice(0, maxPages);

  const settled = await Promise.allSettled(
    links.map(async (url) => ({ url, html: await fetchHtml(url) }))
  );
  const pages = settled
    .filter((r): r is PromiseFulfilledResult<{ url: string; html: string }> => r.status === 'fulfilled')
    .map((r) => r.value);

  return { homepage: { url: root, html: homepageHtml }, pages };
}
