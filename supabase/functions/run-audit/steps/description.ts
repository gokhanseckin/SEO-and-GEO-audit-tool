import { patchSection } from '../lib/db.ts';
import { describe } from '../lib/gemini.ts';
import type { AuditRow, CrawledPage } from '../lib/types.ts';

export async function runDescription(audit: AuditRow): Promise<void> {
  const cache = audit.sections.onsite_crawl_cache;
  const text = (cache ?? []).map((p) => `# ${p.title ?? ''}\n${p.text_content}`).join('\n\n');
  try {
    const blurb = await describe(audit.domain, text);
    await patchSection(audit.id, 'description', { blurb, completed_at: new Date().toISOString() });
  } catch (e) {
    await patchSection(audit.id, 'description', { error: String(e), completed_at: new Date().toISOString() });
  }
}
