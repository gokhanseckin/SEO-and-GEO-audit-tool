import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('id, user_id').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await svc.from('audits').update({ last_heartbeat_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
