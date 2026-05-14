import { db } from './db.ts';

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendCompletionEmail(auditId: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
  if (!key || !from) {
    console.warn('completion email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL missing');
    return;
  }

  const sb = db();
  const { data: audit, error } = await sb
    .from('audits')
    .select('id, domain, user_id, completed_at')
    .eq('id', auditId)
    .single();
  if (error || !audit) {
    console.error('email: audit not found', error);
    return;
  }

  // Resolve recipient email. Try profiles.email first; fall back to auth.users.email.
  let to: string | null = null;
  const { data: profile } = await sb
    .from('profiles')
    .select('email')
    .eq('id', (audit as any).user_id)
    .maybeSingle();
  to = (profile as any)?.email ?? null;

  if (!to) {
    // Fallback to auth.users via admin API (requires service-role client)
    const { data: { user } } = await sb.auth.admin.getUserById((audit as any).user_id);
    to = user?.email ?? null;
  }

  if (!to) {
    console.warn('email: recipient email not found for user', (audit as any).user_id);
    return;
  }

  const reportUrl = `${appUrl}/report/${(audit as any).id}`;
  const subject = `Your SEO+GEO audit for ${(audit as any).domain} is ready`;
  const html = `<p>Your audit for <strong>${(audit as any).domain}</strong> is complete.</p>
                <p><a href="${reportUrl}">View the report</a></p>`;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    console.error('resend send failed', res.status, await res.text());
  }
}
