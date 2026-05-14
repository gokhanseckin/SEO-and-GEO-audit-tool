import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type JSXElementConstructor, type ReactElement } from 'react';
import { AuditReportPdf } from '@/lib/pdf/AuditReportPdf';
import { resend, fromAddress } from '@/lib/email/resend';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: audit, error } = await sb.from('audits').select('*').eq('id', id).single();
  if (error || !audit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (audit.status !== 'complete') return NextResponse.json({ error: 'not_ready' }, { status: 409 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfElement = createElement(AuditReportPdf, { audit: audit as any }) as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>;
  const pdfBuffer = await renderToBuffer(pdfElement);

  const result = await resend().emails.send({
    from: fromAddress(),
    to: user.email!,
    subject: `Your SEO+GEO audit for ${audit.domain}`,
    text: `Attached is the PDF report for ${audit.domain}. View online: ${process.env.APP_URL}/report/${audit.id}`,
    attachments: [
      {
        filename: `audit-${audit.domain}-${audit.id.slice(0, 8)}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });

  if (result.error)
    return NextResponse.json(
      { error: 'send_failed', detail: result.error.message },
      { status: 502 },
    );

  return NextResponse.json({ ok: true, message_id: result.data?.id });
}
