import { describe, it, expect } from 'vitest';

// Inline copy of supabase/functions/run-audit/steps/onsite.ts:computeIssues for Node-side testing.
// If you change the Edge Function version, mirror the change here.
// Severity values match the source: 'high' | 'med' | 'low'
type CrawledPage = {
  url: string;
  title?: string;
  meta_desc?: string;
  h1: string[];
  canonical?: string;
  alt_coverage: number;
  viewport_set: boolean;
  schema_jsonld_count: number;
  https: boolean;
  robots_meta?: string;
};

type Issue = { severity: 'high' | 'med' | 'low'; message: string; page: string };

function computeIssues(pages: CrawledPage[]): Issue[] {
  const issues: Issue[] = [];
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

// A page that has all required fields set to "healthy" values so the only issue
// that fires is the one we're explicitly testing.
const healthyBase: Omit<CrawledPage, 'robots_meta'> = {
  url: 'https://x.com/a',
  title: 'This is a perfectly sized title tag here',
  meta_desc: 'A meta description',
  h1: ['One H1'],
  canonical: 'https://x.com/a',
  alt_coverage: 1,
  viewport_set: true,
  schema_jsonld_count: 1,
  https: true,
};

describe('computeIssues — noindex regression', () => {
  it('flags pages with robots_meta containing noindex', () => {
    const issues = computeIssues([{ ...healthyBase, robots_meta: 'noindex,follow' }]);
    expect(issues.some((i) => i.message === 'Page is set to noindex')).toBe(true);
  });

  it('flags case-insensitively (NOINDEX)', () => {
    const issues = computeIssues([{ ...healthyBase, robots_meta: 'NOINDEX' }]);
    expect(issues.some((i) => i.message === 'Page is set to noindex')).toBe(true);
  });

  it('flags case-insensitively (NoIndex)', () => {
    const issues = computeIssues([{ ...healthyBase, robots_meta: 'NoIndex,nofollow' }]);
    expect(issues.some((i) => i.message === 'Page is set to noindex')).toBe(true);
  });

  it('does NOT flag when robots_meta is index,follow', () => {
    const issues = computeIssues([{ ...healthyBase, robots_meta: 'index,follow' }]);
    expect(issues.some((i) => i.message === 'Page is set to noindex')).toBe(false);
  });

  it('does NOT flag when robots_meta is absent', () => {
    const issues = computeIssues([{ ...healthyBase }]);
    expect(issues.some((i) => i.message === 'Page is set to noindex')).toBe(false);
  });

  it('noindex issue has severity high', () => {
    const issues = computeIssues([{ ...healthyBase, robots_meta: 'noindex' }]);
    const noindexIssue = issues.find((i) => i.message === 'Page is set to noindex');
    expect(noindexIssue?.severity).toBe('high');
  });
});
