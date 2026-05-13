import { patchSection } from '../lib/db.ts';
import { grounded } from '../lib/gemini.ts';
import { domainFromUrl } from '../lib/serper.ts';
import type { AuditRow } from '../lib/types.ts';

interface PromptResult {
  prompt: string;
  answer_text: string;
  user_domain_mentioned: boolean;
  user_domain_rank: number | null;
  competitor_domains: string[];
  cited_urls: { url: string; title: string }[];
}

function templateForKeyword(kw: string): string {
  if (/\?$/.test(kw) || /^(how|what|why|when|where|who|which)\b/i.test(kw)) return kw;
  if (/best|top|review/i.test(kw)) return `What are the ${kw}?`;
  return `Recommend the best options for: ${kw}.`;
}

function findUserMention(text: string, urls: { url: string; title: string }[], userDomain: string): {
  mentioned: boolean; rank: number | null;
} {
  const re = new RegExp(`\\b${userDomain.replace(/[.]/g, '\\.')}\\b`, 'i');
  const inText = re.test(text);
  const unique: string[] = [];
  for (const u of urls) {
    const d = domainFromUrl(u.url);
    if (d && !unique.includes(d)) unique.push(d);
  }
  const idx = unique.indexOf(userDomain);
  const rank = idx >= 0 ? idx + 1 : null;
  return { mentioned: inText || rank !== null, rank };
}

function extractCompetitorDomains(text: string, urls: { url: string; title: string }[], userDomain: string): string[] {
  const set = new Set<string>();
  for (const u of urls) {
    const d = domainFromUrl(u.url);
    if (d && d !== userDomain) set.add(d);
  }
  const re = /\b([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const d = m[1].toLowerCase();
    if (d !== userDomain && !d.startsWith('www.')) set.add(d);
  }
  return Array.from(set).slice(0, 20);
}

const MAX_PROMPTS = 8;
const BATCH_SIZE = 5;

async function runOne(prompt: string, userDomain: string): Promise<PromptResult> {
  try {
    const r = await grounded(prompt);
    return {
      prompt,
      answer_text: r.text,
      user_domain_mentioned: findUserMention(r.text, r.citedUrls, userDomain).mentioned,
      user_domain_rank: findUserMention(r.text, r.citedUrls, userDomain).rank,
      competitor_domains: extractCompetitorDomains(r.text, r.citedUrls, userDomain),
      cited_urls: r.citedUrls,
    };
  } catch (e) {
    return {
      prompt, answer_text: `ERROR: ${e}`,
      user_domain_mentioned: false, user_domain_rank: null,
      competitor_domains: [], cited_urls: [],
    };
  }
}

export async function runGeo(audit: AuditRow): Promise<{ citedUrls: { url: string; title: string }[] }> {
  const selected: string[] = ((audit.sections as any).keywords?.selected ?? []) as string[];
  const prompts = selected.slice(0, MAX_PROMPTS).map(templateForKeyword);
  const results: PromptResult[] = [];
  const allCited: { url: string; title: string }[] = [];

  for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
    const batch = prompts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((p) => runOne(p, audit.domain)));
    results.push(...batchResults);
    for (const r of batchResults) allCited.push(...r.cited_urls);
    await patchSection(audit.id, 'geo', {
      prompts: results,
      visibility_score: results.length
        ? Math.round((results.filter((x) => x.user_domain_mentioned).length / results.length) * 100)
        : 0,
    });
  }

  return { citedUrls: allCited };
}
