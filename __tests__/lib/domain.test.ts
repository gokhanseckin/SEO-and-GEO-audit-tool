import { describe, it, expect } from 'vitest';
import { normalizeDomain, isValidDomain } from '@/lib/domain';

describe('normalizeDomain', () => {
  it('lowercases', () => { expect(normalizeDomain('Example.COM')).toBe('example.com'); });
  it('strips protocol', () => { expect(normalizeDomain('https://example.com')).toBe('example.com'); });
  it('strips trailing slash', () => { expect(normalizeDomain('example.com/')).toBe('example.com'); });
  it('strips path', () => { expect(normalizeDomain('example.com/foo/bar')).toBe('example.com'); });
  it('strips www', () => { expect(normalizeDomain('www.example.com')).toBe('example.com'); });
  it('strips trailing dot', () => { expect(normalizeDomain('example.com.')).toBe('example.com'); });
  it('trims whitespace', () => { expect(normalizeDomain('  example.com ')).toBe('example.com'); });
});

describe('isValidDomain', () => {
  it('accepts a simple domain', () => { expect(isValidDomain('example.com')).toBe(true); });
  it('accepts subdomains', () => { expect(isValidDomain('app.example.com')).toBe(true); });
  it('rejects empty', () => { expect(isValidDomain('')).toBe(false); });
  it('rejects no TLD', () => { expect(isValidDomain('example')).toBe(false); });
  it('rejects spaces', () => { expect(isValidDomain('exa mple.com')).toBe(false); });
  it('rejects protocol prefix', () => { expect(isValidDomain('http://example.com')).toBe(false); });
});
