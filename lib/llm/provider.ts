export interface KeywordCandidate {
  term: string;
  relevance: number;
  type: 'head' | 'long-tail' | 'question';
}

export interface GroundedAnswer {
  text: string;
  citedUrls: { url: string; title: string }[];
}

export interface ArticleRecsInput {
  userDomain: string;
  userPageTitles: string[];
  citedPages: { url: string; title: string; metaDesc: string }[];
  selectedKeywords: string[];
}

export interface ArticleRecommendation {
  title: string;
  angle: string;
  target_keyword: string;
  why_it_ranks: string;
  source_urls: string[];
}

export interface LLMProvider {
  name: string;

  extractKeywords(siteText: string): Promise<KeywordCandidate[]>;
  describeDomain(domain: string, siteText: string): Promise<string>;
  groundedAnswer(prompt: string): Promise<GroundedAnswer>;
  summarizeCompetitor(domain: string, snippet: string): Promise<string>;
  recommendArticles(input: ArticleRecsInput): Promise<ArticleRecommendation[]>;
  generateNarrative(auditJson: unknown): Promise<string>;
}
