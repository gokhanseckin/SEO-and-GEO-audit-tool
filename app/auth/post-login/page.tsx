import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ pending_domain?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, audits_used')
    .eq('id', user.id)
    .single();

  const { data: existingAudit } = await supabase
    .from('audits')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { pending_domain } = await searchParams;
  const isAdmin = profile?.role === 'admin';

  if (pending_domain) {
    if (isAdmin || !existingAudit) {
      redirect(`/analyze?domain=${encodeURIComponent(pending_domain)}`);
    }
    redirect(`/report/${existingAudit.id}?flash=already_used`);
  }

  if (existingAudit) redirect(`/report/${existingAudit.id}`);
  if (isAdmin) redirect('/dashboard');
  redirect('/');
}
