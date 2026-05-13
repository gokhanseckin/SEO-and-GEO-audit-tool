import { describe, it, expect } from 'vitest';
import { parsePage, extractInternalLinks } from '@/lib/crawl/parser';

const SAMPLE = `
<html>
<head>
  <title>Hello World</title>
  <meta name="description" content="A test page" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://example.com/" />
  <meta name="viewport" content="width=device-width" />
  <meta property="og:title" content="Hello" />
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head>
<body>
  <h1>Main Heading</h1>
  <h2>Sub</h2>
  <p>Some text content here.</p>
  <img src="/a.jpg" alt="alt text" />
  <img src="/b.jpg" />
  <a href="/about">About</a>
  <a href="https://example.com/contact">Contact</a>
  <a href="https://other.com/x">External</a>
</body>
</html>`;

describe('parsePage', () => {
  it('extracts title', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').title).toBe('Hello World');
  });
  it('extracts meta description', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').meta_desc).toBe('A test page');
  });
  it('extracts H1', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').h1).toEqual(['Main Heading']);
  });
  it('detects schema.org JSON-LD count', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').schema_jsonld_count).toBe(1);
  });
  it('computes alt coverage', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').alt_coverage).toBe(0.5);
  });
  it('detects viewport', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').viewport_set).toBe(true);
  });
  it('extracts canonical', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').canonical).toBe('https://example.com/');
  });
});

describe('extractInternalLinks', () => {
  it('returns only same-host links, absolute URLs', () => {
    const links = extractInternalLinks(SAMPLE, 'https://example.com/');
    expect(links).toContain('https://example.com/about');
    expect(links).toContain('https://example.com/contact');
    expect(links).not.toContain('https://other.com/x');
  });
});
