import { patchSection } from '../lib/db.ts';
import { fetchText } from '../lib/fetch.ts';
import { summarizeCompetitor } from '../lib/gemini.ts';
import { serperSearch, SerperBudget, domainFromUrl } from '../lib/serper.ts';
import type { AuditRow, GeoSection } from '../lib/types.ts';

const FETCH_ERROR_RE = /^(?:fetch failed|TypeError: Failed to fetch|HTTP \d{3}|timeout|Could not access|^The (?:URL|page) could not be)/i;

function safeSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (FETCH_ERROR_RE.test(t)) return null;
  if (t.length < 20) return null; // implausibly short → likely error
  return t;
}

function htmlMeta(html: string): { title: string; meta: string } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? '';
  return { title: t, meta: m };
}

export async function runCompetitors(audit: AuditRow, budget: SerperBudget): Promise<void> {
  try {
    const selected: string[] = audit.sections.keywords?.selected ?? [];
    const geo: GeoSection | undefined = audit.sections.geo;

    const serpDomainTally = new Map<string, { appearances: number; sumPos: number }>();
    for (const kw of selected) {
      if (!budget.canSpend()) break;
      const r = await serperSearch(kw, budget);
      const organic = r?.organic ?? [];
      for (const item of organic) {
        const d = domainFromUrl(item.link ?? '');
        if (!d || d === audit.domain) continue;
        const cur = serpDomainTally.get(d) ?? { appearances: 0, sumPos: 0 };
        cur.appearances += 1;
        cur.sumPos += item.position ?? organic.indexOf(item) + 1;
        serpDomainTally.set(d, cur);
      }
    }
    const serp_ranked = Array.from(serpDomainTally.entries())
      .map(([domain, v]) => ({ domain, appearances: v.appearances, avg_position: v.sumPos / v.appearances }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 20);

    const llmTally = new Map<string, { appearances: number; cited: Set<string> }>();
    for (const p of geo?.prompts ?? []) {
      for (const d of p.competitor_domains) {
        const cur = llmTally.get(d) ?? { appearances: 0, cited: new Set<string>() };
        cur.appearances += 1;
        for (const u of p.cited_urls ?? []) {
          const dom = domainFromUrl(u.url);
          if (dom === d) cur.cited.add(u.url);
        }
        llmTally.set(d, cur);
      }
    }
    const llm_ranked = Array.from(llmTally.entries())
      .map(([domain, v]) => ({ domain, appearances: v.appearances, cited_urls: v.cited.size }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 20);

    const combined = new Map<string, { serp: number; llm: number }>();
    for (const r of serp_ranked) combined.set(r.domain, { serp: r.appearances, llm: combined.get(r.domain)?.llm ?? 0 });
    for (const r of llm_ranked) combined.set(r.domain, { ...combined.get(r.domain) ?? { serp: 0, llm: 0 }, llm: r.appearances });
    const topDomains = Array.from(combined.entries())
      .sort((a, b) => (b[1].serp + b[1].llm) - (a[1].serp + a[1].llm))
      .slice(0, 5)
      .map(([d]) => d);

    const enriched = [];
    for (const d of topDomains) {
      try {
        const html = await fetchText(`https://${d}/`, 5000);
        const { title, meta } = htmlMeta(html);
        const summary = safeSummary(await summarizeCompetitor(d, `${title}\n\n${meta}\n\n${html.slice(0, 3000)}`));
        const sources: string[] = [];
        if (combined.get(d)?.serp) sources.push('serp');
        if (combined.get(d)?.llm) sources.push('llm');
        enriched.push({ domain: d, title, meta_desc: meta, summary, sources });
      } catch (e) {
        enriched.push({ domain: d, title: '', meta_desc: '', summary: null, sources: [] });
      }
    }

    await patchSection(audit.id, 'competitors', { serp_ranked, llm_ranked, enriched });
  } catch (e) {
    await patchSection(audit.id, 'competitors', { error: String(e) });
  }
}
