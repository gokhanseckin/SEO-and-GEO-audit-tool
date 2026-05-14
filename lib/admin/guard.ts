import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/?next=/admin');
  const { data } = await sb.from('admin_emails').select('email').eq('email', user.email!).maybeSingle();
  if (!data) redirect('/');
  return { userId: user.id, email: user.email! };
}
