import { describe, it, expect } from 'vitest';

const FETCH_ERROR_RE = /^(?:fetch failed|TypeError: Failed to fetch|HTTP \d{3}|timeout|Could not access|^The (?:URL|page) could not be)/i;

function safeSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (FETCH_ERROR_RE.test(t)) return null;
  if (t.length < 20) return null;
  return t;
}

describe('safeSummary', () => {
  it('filters fetch failed', () => expect(safeSummary('fetch failed')).toBeNull());
  it('filters HTTP errors', () => expect(safeSummary('HTTP 503')).toBeNull());
  it('filters TypeError', () => expect(safeSummary('TypeError: Failed to fetch')).toBeNull());
  it('filters timeout', () => expect(safeSummary('timeout exceeded for upstream')).toBeNull());
  it('filters short noise', () => expect(safeSummary('error')).toBeNull());
  it('filters whitespace-only', () => expect(safeSummary('   ')).toBeNull());
  it('handles null/undefined', () => {
    expect(safeSummary(null)).toBeNull();
    expect(safeSummary(undefined)).toBeNull();
  });
  it('keeps a real summary', () => {
    const real = 'Brand X is a leading provider of payment rails for emerging markets, founded in 2018.';
    expect(safeSummary(real)).toBe(real);
  });
});
