import { describe, it, expect } from 'vitest';
import { parseKeywordsResponse } from '@/lib/llm/gemini';

describe('parseKeywordsResponse', () => {
  it('parses a clean JSON array', () => {
    const raw = '[{"term":"running shoes","relevance":0.95,"type":"head"}]';
    expect(parseKeywordsResponse(raw)).toEqual([
      { term: 'running shoes', relevance: 0.95, type: 'head' },
    ]);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n[{"term":"x","relevance":0.5,"type":"head"}]\n```';
    expect(parseKeywordsResponse(raw)).toHaveLength(1);
  });

  it('filters invalid entries', () => {
    const raw = '[{"term":"ok","relevance":0.5,"type":"head"},{"term":""},{"relevance":1}]';
    expect(parseKeywordsResponse(raw)).toHaveLength(1);
  });

  it('clamps relevance to 0..1', () => {
    const raw = '[{"term":"x","relevance":2,"type":"head"},{"term":"y","relevance":-1,"type":"head"}]';
    const out = parseKeywordsResponse(raw);
    expect(out[0].relevance).toBe(1);
    expect(out[1].relevance).toBe(0);
  });

  it('defaults type to "head" if missing', () => {
    const raw = '[{"term":"x","relevance":0.5}]';
    expect(parseKeywordsResponse(raw)[0].type).toBe('head');
  });

  it('throws on non-array', () => {
    expect(() => parseKeywordsResponse('{}')).toThrow();
  });
});
