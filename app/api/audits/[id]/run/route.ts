import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const Body = z.object({
  selected_keywords: z.array(z.string()).min(1).max(10),
  user_modified: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('id, user_id, status, sections').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (audit.status !== 'pending') {
    return NextResponse.json({ error: 'wrong_status', status: audit.status }, { status: 409 });
  }

  const sections = audit.sections as Record<string, unknown>;
  const keywords = (sections.keywords ?? {}) as Record<string, unknown>;
  const newSections = {
    ...sections,
    keywords: {
      ...keywords,
      selected: parsed.data.selected_keywords,
      user_modified: parsed.data.user_modified,
    },
  };

  const { error: upErr } = await svc
    .from('audits')
    .update({ status: 'running', started_at: new Date().toISOString(), sections: newSections as any })
    .eq('id', id);
  if (upErr) return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 500 });

  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-audit`;
  let dispatch: Response;
  try {
    dispatch = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ audit_id: id }),
    });
  } catch (e) {
    await svc.from('audits').update({
      status: 'failed',
      error: `edge_dispatch_network: ${String(e).slice(0, 500)}`,
    }).eq('id', id);
    return NextResponse.json({ error: 'dispatch_failed', detail: String(e) }, { status: 502 });
  }

  if (!dispatch.ok) {
    const detail = await dispatch.text();
    await svc.from('audits').update({
      status: 'failed',
      error: `edge_dispatch_${dispatch.status}: ${detail.slice(0, 500)}`,
    }).eq('id', id);
    return NextResponse.json({ error: 'dispatch_failed', status: dispatch.status, detail }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
