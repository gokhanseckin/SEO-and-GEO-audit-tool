import { patchSection } from '../lib/db.ts';
import { fetchText } from '../lib/fetch.ts';
import { recommendArticles } from '../lib/gemini.ts';
import type { AuditRow } from '../lib/types.ts';

function htmlMeta(html: string): { title: string; meta: string } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? '';
  return { title: t, meta: m };
}

export async function runArticleRecs(audit: AuditRow, allCitedUrls: { url: string; title: string }[]): Promise<void> {
  try {
    const selected: string[] = audit.sections.keywords?.selected ?? [];
    const crawl = audit.sections.onsite_crawl_cache;
    const userTitles = (crawl ?? []).map((p) => p.title ?? p.url);

    const seen = new Set<string>();
    const unique = allCitedUrls.filter((u) => {
      if (seen.has(u.url)) return false;
      seen.add(u.url);
      return true;
    }).slice(0, 20);

    const enriched = await Promise.all(
      unique.map(async (u) => {
        try {
          const html = await fetchText(u.url, 5000);
          const { title, meta } = htmlMeta(html);
          return { url: u.url, title: title || u.title, metaDesc: meta };
        } catch {
          return { url: u.url, title: u.title, metaDesc: '' };
        }
      })
    );

    const recs = await recommendArticles({
      userDomain: audit.domain,
      userPageTitles: userTitles,
      citedPages: enriched,
      selectedKeywords: selected,
    });

    await patchSection(audit.id, 'article_recommendations', recs);
  } catch (e) {
    await patchSection(audit.id, 'article_recommendations', { error: String(e) });
  }
}
