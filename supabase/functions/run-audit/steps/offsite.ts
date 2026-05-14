import { patchSection } from '../lib/db.ts';
import { fetchJson } from '../lib/fetch.ts';
import { serperSearch, SerperBudget, domainFromUrl } from '../lib/serper.ts';
import type { AuditRow } from '../lib/types.ts';

const KNOWN_DIRECTORIES = [
  { name: 'Wikipedia', pattern: /wikipedia\.org\/wiki/i },
  { name: 'Crunchbase', pattern: /crunchbase\.com\/organization/i },
  { name: 'LinkedIn', pattern: /linkedin\.com\/company/i },
  { name: 'X (Twitter)', pattern: /(?:twitter|x)\.com\// },
  { name: 'Facebook', pattern: /facebook\.com\// },
  { name: 'YouTube', pattern: /youtube\.com\/(?:c|@|channel|user)/i },
];

async function domainAge(domain: string): Promise<number | null> {
  try {
    const data = await fetchJson(`https://rdap.org/domain/${domain}`, 5000);
    const events = data?.events ?? [];
    const reg = events.find((e: any) => e.eventAction === 'registration');
    if (!reg?.eventDate) return null;
    const days = (Date.now() - new Date(reg.eventDate).getTime()) / 86400000;
    return Math.floor(days);
  } catch { return null; }
}

export async function runOffsite(audit: AuditRow, budget: SerperBudget): Promise<void> {
  try {
    const [age, siteSerp, brandSerp] = await Promise.all([
      domainAge(audit.domain),
      serperSearch(`site:${audit.domain}`, budget).catch(() => null),
      serperSearch(audit.domain.split('.')[0], budget).catch(() => null),
    ]);

    const rawTotal = siteSerp?.searchInformation?.totalResults;
    const parsedTotal = rawTotal != null ? Number(rawTotal) : NaN;
    const indexedPagesEstimate = Number.isFinite(parsedTotal)
      ? parsedTotal
      : siteSerp?.organic?.length ?? 0;
    const brandMentions = brandSerp?.organic?.filter(
      (r) => domainFromUrl(r.link ?? '') === audit.domain
    ).length ?? 0;

    const directorySnippets = [
      ...(siteSerp?.organic ?? []),
      ...(brandSerp?.organic ?? []),
    ].map((r) => r.link ?? '');

    const directory_presence = KNOWN_DIRECTORIES.map((d) => {
      const hit = directorySnippets.find((u) => d.pattern.test(u));
      return { name: d.name, found: !!hit, url: hit ?? null };
    });

    await patchSection(audit.id, 'offsite', {
      domain_age_days: age,
      https: true,
      indexed_pages_estimate: indexedPagesEstimate,
      directory_presence,
      brand_serp_mentions: brandMentions,
    });
  } catch (e) {
    await patchSection(audit.id, 'offsite', { error: String(e) });
  }
}
