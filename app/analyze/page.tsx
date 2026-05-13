import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyzeClient } from './AnalyzeClient';

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { domain } = await searchParams;
  if (!domain) redirect('/');

  return <AnalyzeClient initialDomain={domain} />;
}
