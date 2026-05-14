export interface KeywordCandidate { term: string; relevance: number; type: string; }

export interface CrawledPage {
  url: string; title: string | null; meta_desc: string | null;
  h1: string[]; h2: string[]; word_count: number;
  canonical: string | null; robots_meta: string | null;
  og_present: boolean; schema_jsonld_count: number;
  viewport_set: boolean; alt_coverage: number; https: boolean;
  text_content: string;
}

// === Section payload shapes ===

export interface KeywordsSection {
  candidates?: KeywordCandidate[];
  selected?: string[];
  user_modified?: boolean;
  error?: string;
}

export interface DescriptionSection {
  blurb?: string;
  completed_at?: string;
  error?: string;
}

export interface OnsiteSection {
  pages_crawled?: CrawledPage[];
  lighthouse?: {
    performance: number | null;
    accessibility: number | null;
    best_practices: number | null;
    seo: number | null;
    cwv: { lcp_ms: number | null; cls: number | null; inp_ms: number | null };
  };
  issues?: { severity: 'high' | 'med' | 'low'; message: string; page: string }[];
  sitemap_found?: boolean;
  sitemap_url_count?: number;
  error?: string;
}

export interface OffsiteSection {
  domain_age_days?: number | null;
  https?: boolean;
  indexed_pages_estimate?: number;
  directory_presence?: { name: string; found: boolean; url: string | null }[];
  brand_serp_mentions?: number;
  error?: string;
}

export interface GeoPromptResult {
  prompt: string;
  answer_text: string;
  user_domain_mentioned: boolean;
  user_domain_rank: number | null;
  competitor_domains: string[];
  cited_urls: { url: string; title: string }[];
}

export interface GeoSection {
  prompts?: GeoPromptResult[];
  visibility_score?: number;
  error?: string;
}

export interface CompetitorEnriched {
  domain: string;
  title: string;
  meta_desc: string;
  summary: string | null;
  sources: string[];
}

export interface CompetitorSerpRanked {
  domain: string;
  appearances: number;
  avg_position: number;
}

export interface CompetitorLlmRanked {
  domain: string;
  appearances: number;
  cited_urls: number;
}

export interface CompetitorsSection {
  serp_ranked?: CompetitorSerpRanked[];
  llm_ranked?: CompetitorLlmRanked[];
  enriched?: CompetitorEnriched[];
  error?: string;
}

export interface ArticleRec {
  title: string;
  angle: string;
  target_keyword: string;
  why_it_ranks: string;
  source_urls: string[];
}

// article_recommendations is stored as an array at the top level (not nested object)
export type ArticleRecsSection = ArticleRec[] | { error: string };

export interface AuditSections {
  keywords?: KeywordsSection;
  onsite_crawl_cache?: CrawledPage[];
  description?: DescriptionSection;
  onsite?: OnsiteSection;
  offsite?: OffsiteSection;
  geo?: GeoSection;
  competitors?: CompetitorsSection;
  article_recommendations?: ArticleRecsSection;
}

export interface AuditRow {
  id: string;
  user_id: string;
  domain: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  serper_query_cap: number;
  sections: AuditSections;
  last_heartbeat_at: string | null;
  error?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  llm_provider?: string;
}
