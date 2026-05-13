const KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GroundedResult {
  text: string;
  citedUrls: { url: string; title: string }[];
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
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
  const parsed = JSON.parse(stripFences(raw));
  return Array.isArray(parsed) ? parsed : [];
}
