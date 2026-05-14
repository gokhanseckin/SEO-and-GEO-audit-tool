import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: audit } = await sb.from('audits').select('id, user_id, status').eq('id', id).single();
  if (!audit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (audit.status !== 'failed') return NextResponse.json({ error: 'not_retryable' }, { status: 409 });

  const { error: updateError } = await sb.from('audits').update({
    status: 'pending',
    sections: {},
    error: null,
    completed_at: null,
    last_heartbeat_at: null,
  }).eq('id', id);
  if (updateError) return NextResponse.json({ error: 'reset_failed' }, { status: 500 });

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-audit`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audit_id: id }),
  });
  if (!r.ok) return NextResponse.json({ error: 'dispatch_failed', detail: await r.text() }, { status: 502 });

  return NextResponse.json({ ok: true });
}
