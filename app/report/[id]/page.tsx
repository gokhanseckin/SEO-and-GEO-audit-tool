import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReportClient } from './ReportClient';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: audit, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !audit) notFound();
  if (audit.user_id !== user.id) notFound();

  const selected =
    (audit.sections as { keywords?: { selected?: string[] } } | null)?.keywords?.selected ?? [];
  if (audit.status === 'pending' && selected.length === 0) {
    redirect(`/analyze?domain=${encodeURIComponent(audit.domain)}`);
  }

  return <ReportClient initialAudit={audit} userEmail={user.email ?? null} />;
}
