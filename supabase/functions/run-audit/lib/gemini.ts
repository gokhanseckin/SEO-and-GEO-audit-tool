const KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GroundedResult {
  text: string;
  citedUrls: { url: string; title: string }[];
}

function extractJson(s: string): string {
  // 1. Prefer a triple-fenced block.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  // 2. Otherwise slurp the first balanced [..] or {..}.
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

async function call(prompt: string, grounding = false): Promise<any> {
  const body: any = { contents: [{ parts: [{ text: prompt }] }] };
  if (grounding) body.tools = [{ google_search: {} }];
  const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  return await res.json();
}

export async function describe(domain: string, siteText: string): Promise<string> {
  const prompt = `In 2-3 sentences, describe what ${domain} is and what it offers. Be neutral.\n\nSITE TEXT:\n${siteText.slice(0, 6000)}`;
  const data = await call(prompt);
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

export async function grounded(prompt: string): Promise<GroundedResult> {
  const data = await call(prompt, true);
  const cand = data.candidates?.[0];
  const text: string = cand?.content?.parts?.[0]?.text ?? '';
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  const citedUrls = chunks
    .map((c: any) => c.web)
    .filter((w: any) => w?.uri)
    .map((w: any) => ({ url: w.uri, title: w.title || w.uri }));
  return { text, citedUrls };
}

export async function summarizeCompetitor(domain: string, snippet: string): Promise<string> {
  const prompt = `In 2-3 sentences, summarize what ${domain} does, based on its homepage content. Be neutral.\n\n${snippet.slice(0, 4000)}`;
  const data = await call(prompt);
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

const GROUNDING_HOST_RE = /\/grounding-api-redirect\//i;

export async function resolveGroundingUrl(url: string, timeoutMs = 6000): Promise<string> {
  if (!GROUNDING_HOST_RE.test(url)) return url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    return r.url || url;
  } catch {
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
      r.body?.cancel();
      return r.url || url;
    } catch {
      return url;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function recommendArticles(input: {
  userDomain: string;
  userPageTitles: string[];
  citedPages: { url: string; title: string; metaDesc: string }[];
  selectedKeywords: string[];
}): Promise<any[]> {
  const prompt = `You are a content strategist. The site ${input.userDomain} targets these keywords: ${input.selectedKeywords.join(', ')}.
LLMs cite these pages when answering related questions:
${input.citedPages.map((p) => `- ${p.title} — ${p.url}\n  ${p.metaDesc}`).join('\n')}

Existing user pages:
${input.userPageTitles.map((t) => `- ${t}`).join('\n')}

Propose 8-12 NEW article ideas the user should write (do NOT duplicate existing pages). Return ONLY a JSON array of
{"title":string,"angle":string,"target_keyword":string,"why_it_ranks":string,"source_urls":string[]}.`;
  const data = await call(prompt);
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  try {
    const parsed = JSON.parse(extractJson(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
