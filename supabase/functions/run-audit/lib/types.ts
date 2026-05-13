export interface AuditRow {
  id: string;
  user_id: string;
  domain: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  serper_query_cap: number;
  sections: Record<string, unknown>;
  last_heartbeat_at: string | null;
}

export interface KeywordCandidate { term: string; relevance: number; type: string; }
export interface CrawledPage {
  url: string; title: string | null; meta_desc: string | null;
  h1: string[]; h2: string[]; word_count: number;
  canonical: string | null; robots_meta: string | null;
  og_present: boolean; schema_jsonld_count: number;
  viewport_set: boolean; alt_coverage: number; https: boolean;
  text_content: string;
}
