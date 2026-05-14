import { describe, it, expect } from 'vitest';

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const idx = s.search(/[\[{]/);
  if (idx < 0) return s.trim();
  const open = s[idx];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let end = -1;
  for (let i = idx; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return end > 0 ? s.slice(idx, end + 1) : s.trim();
}

describe('extractJson', () => {
  it('extracts simple fenced JSON', () => {
    expect(extractJson('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });
  it('handles preamble before fenced block', () => {
    expect(extractJson('Here is the JSON:\n```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });
  it('extracts balanced object when unfenced', () => {
    expect(extractJson('Random preamble {"a":{"b":2}} trailing')).toBe('{"a":{"b":2}}');
  });
  it('extracts balanced array when unfenced', () => {
    expect(extractJson('Prefix [1, 2, [3, 4]] suffix')).toBe('[1, 2, [3, 4]]');
  });
  it('returns trimmed input when no JSON markers found', () => {
    expect(extractJson('  no json here  ')).toBe('no json here');
  });
  it('handles plain ```...``` without json label', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
