'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReportHeader } from '@/components/report/ReportHeader';
import { DescriptionCard } from '@/components/report/DescriptionCard';
import { KeywordsList } from '@/components/report/KeywordsList';
import { OnsiteCard } from '@/components/report/OnsiteCard';
import { OffsiteCard } from '@/components/report/OffsiteCard';
import { GeoTable } from '@/components/report/GeoTable';
import { CompetitorTabs } from '@/components/report/CompetitorTabs';
import { ArticleRecsGrid } from '@/components/report/ArticleRecsGrid';
import { ReportFailed } from '@/components/report/ReportFailed';
import { countSectionsReady, TOTAL_SECTIONS } from '@/components/report/ProgressBar';
import type { AuditStatus } from '@/components/ds/StatusPill';

type AuditPayload = {
  id: string;
  domain: string;
  status: string;
  error?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  sections?: unknown;
};

function formatStarted(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatElapsed(audit: AuditPayload, now: number) {
  const startMs = audit.started_at ? Date.parse(audit.started_at) : audit.created_at ? Date.parse(audit.created_at) : NaN;
  if (Number.isNaN(startMs)) return null;
  const endMs = audit.completed_at ? Date.parse(audit.completed_at) : now;
  const sec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function toStatusPill(audit: AuditPayload): AuditStatus {
  if (audit.status === 'complete') return 'complete';
  if (audit.status === 'failed') return 'failed';
  if (audit.status === 'partial') return 'partial';
  return 'running';
}

export function ReportClient({ initialAudit, userEmail }: { initialAudit: AuditPayload; userEmail?: string | null }) {
  const [audit, setAudit] = useState<AuditPayload>(initialAudit);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`audit-${audit.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${audit.id}` },
        (payload) => setAudit(payload.new as AuditPayload)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [audit.id, supabase]);

  useEffect(() => {
    if (audit.status === 'complete' || audit.status === 'failed') return;
    const ping = () => {
      fetch(`/api/audits/${audit.id}/heartbeat`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 15_000);
    return () => clearInterval(id);
  }, [audit.id, audit.status]);

  useEffect(() => {
    if (audit.status === 'complete' || audit.status === 'failed') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [audit.status]);

  const sections = (audit.sections ?? {}) as Record<string, unknown>;
  const sectionsReady = countSectionsReady(sections);
  const startedAt = formatStarted(audit.started_at ?? audit.created_at);
  const elapsed = formatElapsed(audit, now);

  const isFailed = audit.status === 'failed';

  // typed accessors
  type DescriptionData = { blurb?: string; error?: string } | undefined;
  type KeywordsData = Parameters<typeof KeywordsList>[0]['data'];
  type OnsiteData = Parameters<typeof OnsiteCard>[0]['data'];
  type OffsiteData = Parameters<typeof OffsiteCard>[0]['data'];
  type GeoData = Parameters<typeof GeoTable>[0]['data'];
  type CompetitorsData = Parameters<typeof CompetitorTabs>[0]['data'];
  type ArticlesData = Parameters<typeof ArticleRecsGrid>[0]['data'];

  async function retry() {
    setRetryBusy(true); setRetryMsg(null);
    try {
      const r = await fetch(`/api/audits/${audit.id}/retry`, { method: 'POST' });
      const j = await r.json();
      setRetryMsg(r.ok ? 'Retry dispatched — refresh in a few seconds.' : `Failed: ${j.error}`);
    } finally { setRetryBusy(false); }
  }

  async function sendPdf() {
    setPdfBusy(true);
    setPdfMsg(null);
    try {
      const r = await fetch(`/api/audits/${audit.id}/send-pdf`, { method: 'POST' });
      const j = await r.json();
      setPdfMsg(r.ok ? `Sent to ${userEmail}` : `Failed: ${j.error}`);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <ReportHeader
        domain={audit.domain}
        status={toStatusPill(audit)}
        sectionsReady={sectionsReady}
        total={TOTAL_SECTIONS}
        startedAt={startedAt}
        elapsed={elapsed}
        auditId={audit.id}
        userEmail={userEmail}
      />

      {audit.status === 'complete' && userEmail && (
        <div style={{ padding: '0 clamp(20px, 4vw, 40px) 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={sendPdf} disabled={pdfBusy} className="btn btn-secondary btn-sm">
            {pdfBusy ? 'Sending…' : 'Email PDF to me'}
          </button>
          {pdfMsg && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{pdfMsg}</span>}
        </div>
      )}

      {audit.status === 'failed' && (
        <div style={{ padding: '0 clamp(20px, 4vw, 40px) 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={retry} disabled={retryBusy} className="btn btn-secondary btn-sm">
            {retryBusy ? 'Retrying…' : 'Retry audit'}
          </button>
          {retryMsg && <span className="text-sm">{retryMsg}</span>}
        </div>
      )}

      {isFailed ? (
        <ReportFailed
          message={audit.error}
          onRetry={() => router.push(`/analyze?domain=${encodeURIComponent(audit.domain)}`)}
        />
      ) : (
        <>
          <DescriptionCard data={sections.description as DescriptionData} />
          <KeywordsList data={sections.keywords as KeywordsData} />
          <OnsiteCard data={sections.onsite as OnsiteData} />
          <OffsiteCard data={sections.offsite as OffsiteData} />
          <GeoTable data={sections.geo as GeoData} domain={audit.domain} />
          <CompetitorTabs data={sections.competitors as CompetitorsData} />
          <ArticleRecsGrid data={sections.article_recommendations as ArticlesData} />
        </>
      )}

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '32px clamp(20px, 4vw, 40px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-4)',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span>
            Audit <span className="mono" style={{ color: 'var(--fg-2)' }}>{audit.id.slice(0, 8)}</span>
          </span>
          {startedAt && (
            <>
              <span>·</span>
              <span>Run {startedAt}{elapsed ? ` · ${elapsed}` : ''}</span>
            </>
          )}
        </div>
      </footer>
    </main>
  );
}
