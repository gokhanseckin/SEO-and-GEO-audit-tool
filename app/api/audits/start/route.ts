import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import { isValidDomain, normalizeDomain } from '@/lib/domain';
import { crawlSite } from '@/lib/crawl/fetcher';
import { parsePage } from '@/lib/crawl/parser';
import { geminiProvider } from '@/lib/llm/gemini';

const Body = z.object({ domain: z.string().min(1).max(253) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const domain = normalizeDomain(parsed.data.domain);
  if (!isValidDomain(domain)) return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });

  // Dedup: if this user already has a pending/running audit for the same domain,
  // return its id instead of creating a duplicate row (closes BUG-006).
  const { data: existingForDomain } = await supabase
    .from('audits')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('domain', domain)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingForDomain) {
    return NextResponse.json({ audit_id: existingForDomain.id });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: existing } = await supabase
    .from('audits')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'quota_exceeded', existing_audit_id: existing.id }, { status: 409 });
  }

  // Phase 1: crawl + keyword extract
  let crawl;
  try { crawl = await crawlSite(domain, 5); }
  catch (e: any) {
    return NextResponse.json({ error: 'crawl_failed', detail: e.message }, { status: 422 });
  }

  const allPages = [crawl.homepage, ...crawl.pages].map((p) => parsePage(p.html, p.url));
  const combinedText = allPages.map((p) => `# ${p.title ?? ''}\n${p.text_content}`).join('\n\n');

  let candidates;
  try { candidates = await geminiProvider.extractKeywords(combinedText); }
  catch (e: any) {
    return NextResponse.json({ error: 'keyword_extract_failed', detail: e.message }, { status: 502 });
  }

  // Sort by relevance desc
  candidates.sort((a, b) => b.relevance - a.relevance);

  const cap = Number(process.env.SERPER_QUERY_CAP_DEFAULT ?? 15);

  const svc = createServiceClient();
  const { data: inserted, error: insErr } = await svc
    .from('audits')
    .insert({
      user_id: user.id,
      domain,
      status: 'pending',
      llm_provider: 'gemini',
      serper_query_cap: Math.min(cap, 20),
      sections: {
        keywords: { candidates, selected: [], user_modified: false },
        onsite_crawl_cache: allPages.map((p) => ({
          url: p.url, title: p.title, meta_desc: p.meta_desc, h1: p.h1, h2: p.h2,
          word_count: p.word_count, canonical: p.canonical, robots_meta: p.robots_meta,
          og_present: p.og_present, schema_jsonld_count: p.schema_jsonld_count,
          viewport_set: p.viewport_set, alt_coverage: p.alt_coverage, https: p.https,
          text_content: p.text_content,
        })),
      } as unknown as Json,
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.message.includes('quota_exceeded')) {
      return NextResponse.json({ error: 'quota_exceeded' }, { status: 409 });
    }
    return NextResponse.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ audit_id: inserted.id });
}
