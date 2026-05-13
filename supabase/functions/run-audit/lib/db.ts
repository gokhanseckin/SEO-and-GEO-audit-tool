import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { AuditRow } from './types.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export function db() {
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadAudit(id: string): Promise<AuditRow> {
  const { data, error } = await db().from('audits').select('*').eq('id', id).single();
  if (error) throw error;
  return data as AuditRow;
}

export async function patchSection(auditId: string, key: string, value: unknown): Promise<void> {
  const supabase = db();
  const { data: current } = await supabase.from('audits').select('sections').eq('id', auditId).single();
  const sections = { ...(current?.sections ?? {}), [key]: value };
  const { error } = await supabase.from('audits').update({ sections }).eq('id', auditId);
  if (error) throw error;
}

export async function setStatus(
  auditId: string,
  status: 'running' | 'complete' | 'failed',
  extra: Partial<{ error: string; completed_at: string; last_heartbeat_at: string }> = {}
): Promise<void> {
  const { error } = await db().from('audits').update({ status, ...extra }).eq('id', auditId);
  if (error) throw error;
}

export async function getLastHeartbeat(auditId: string): Promise<string | null> {
  const { data } = await db().from('audits').select('last_heartbeat_at').eq('id', auditId).single();
  return (data?.last_heartbeat_at ?? null) as string | null;
}
