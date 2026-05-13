export interface ParsedPage {
  url: string;
  title: string | null;
  meta_desc: string | null;
  h1: string[];
  h2: string[];
  word_count: number;
  canonical: string | null;
  robots_meta: string | null;
  og_present: boolean;
  schema_jsonld_count: number;
  viewport_set: boolean;
  alt_coverage: number;            // 0..1
  https: boolean;
  text_content: string;            // truncated body text
}

function match1(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

function matchAll(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1].trim());
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
             .replace(/<style[\s\S]*?<\/style>/gi, ' ')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ').trim();
}

export function parsePage(html: string, url: string): ParsedPage {
  const title = match1(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta_desc = match1(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const h1 = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags);
  const h2 = matchAll(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(stripTags);
  const canonical = match1(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots_meta = match1(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  const og_present = /<meta\s+property=["']og:/i.test(html);
  const schema_jsonld_count = (html.match(/<script[^>]*type=["']application\/ld\+json["']/gi) || []).length;
  const viewport_set = /<meta\s+name=["']viewport["']/i.test(html);

  const imgs = matchAll(html, /<img\b([^>]*)>/gi);
  const withAlt = imgs.filter((attrs) => /\balt\s*=\s*["'][^"']+["']/i.test(attrs)).length;
  const alt_coverage = imgs.length === 0 ? 1 : withAlt / imgs.length;

  const text_content = stripTags(html).slice(0, 8000);
  const word_count = text_content.split(/\s+/).filter(Boolean).length;

  return {
    url, title, meta_desc, h1, h2, word_count, canonical, robots_meta,
    og_present, schema_jsonld_count, viewport_set, alt_coverage,
    https: url.startsWith('https://'),
    text_content,
  };
}

export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const out = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.host === base.host && u.protocol.startsWith('http')) {
        u.hash = ''; u.search = '';
        out.add(u.toString());
      }
    } catch { /* malformed href */ }
  }
  return Array.from(out);
}
