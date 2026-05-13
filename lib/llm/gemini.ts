import type {
  LLMProvider,
  KeywordCandidate,
  GroundedAnswer,
  ArticleRecsInput,
  ArticleRecommendation,
} from './provider';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash';

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

export function parseKeywordsResponse(raw: string): KeywordCandidate[] {
  const cleaned = stripFences(raw);
  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  const out: KeywordCandidate[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.term !== 'string' || !o.term) continue;
    const rel = typeof o.relevance === 'number' ? Math.max(0, Math.min(1, o.relevance)) : 0.5;
    const type: KeywordCandidate['type'] =
      o.type === 'long-tail' || o.type === 'question' ? o.type : 'head';
    out.push({ term: o.term, relevance: rel, type });
  }
  return out;
}

async function callGemini(
  prompt: string,
  opts: { grounding?: boolean } = {},
): Promise<{
  text: string;
  groundingMetadata?: { groundingChunks?: { web?: { uri: string; title: string } }[] };
}> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (opts.grounding) body.tools = [{ google_search: {} }];

  const url = `${GEMINI_ENDPOINT}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';
  return { text, groundingMetadata: candidate?.groundingMetadata };
}

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async extractKeywords(siteText: string): Promise<KeywordCandidate[]> {
    const prompt = `You are an SEO analyst. From the website text below, extract 20-30 candidate keywords for SEO targeting.
Mix head terms, long-tail phrases, and question-style queries. For each, estimate relevance 0..1 based on how clearly the site is about that topic.
Return ONLY valid JSON: an array of {"term": string, "relevance": number, "type": "head"|"long-tail"|"question"}. No prose.

WEBSITE TEXT:
${siteText.slice(0, 12000)}`;
    const { text } = await callGemini(prompt);
    return parseKeywordsResponse(text);
  },

  async describeDomain(domain: string, siteText: string): Promise<string> {
    const prompt = `In 2-3 sentences, describe what ${domain} is and what it offers, written for someone unfamiliar with the brand. Be neutral and factual.

WEBSITE TEXT:
${siteText.slice(0, 6000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },

  async groundedAnswer(prompt: string): Promise<GroundedAnswer> {
    const { text, groundingMetadata } = await callGemini(prompt, { grounding: true });
    const citedUrls = (groundingMetadata?.groundingChunks ?? [])
      .map((c) => c.web)
      .filter((w): w is { uri: string; title: string } => !!w?.uri)
      .map((w) => ({ url: w.uri, title: w.title || w.uri }));
    return { text, citedUrls };
  },

  async summarizeCompetitor(domain: string, snippet: string): Promise<string> {
    const prompt = `In 2-3 sentences, summarize what ${domain} does, based on this homepage content. Be neutral.\n\n${snippet.slice(0, 4000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },

  async recommendArticles(input: ArticleRecsInput): Promise<ArticleRecommendation[]> {
    const prompt = `You are a content strategist. The site ${input.userDomain} targets these keywords: ${input.selectedKeywords.join(', ')}.
LLMs are citing these articles when answering related questions:
${input.citedPages.map((p) => `- ${p.title} — ${p.url}\n  ${p.metaDesc}`).join('\n')}

The user's site currently has pages titled:
${input.userPageTitles.map((t) => `- ${t}`).join('\n')}

Propose 8-12 NEW article ideas this user should write. Each idea must NOT duplicate an existing user page. Return ONLY valid JSON: an array of
{"title": string, "angle": string, "target_keyword": string, "why_it_ranks": string, "source_urls": string[]}.`;
    const { text } = await callGemini(prompt);
    const parsed = JSON.parse(stripFences(text));
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed as ArticleRecommendation[];
  },

  async generateNarrative(auditJson: unknown): Promise<string> {
    const prompt = `You are an SEO consultant writing a client report. Given the audit data below as JSON, produce a clear, structured markdown report with sections:
1. Executive Summary (2-3 paragraphs)
2. What Your Site Does (use the description)
3. Keyword Coverage
4. Onsite SEO Findings
5. Off-site Signals
6. LLM Visibility (GEO)
7. Competitors
8. Recommended Content
End with a "Top 5 Actions" prioritized list.
No preamble. Begin with the H1.

AUDIT DATA:
${JSON.stringify(auditJson).slice(0, 40000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },
};
