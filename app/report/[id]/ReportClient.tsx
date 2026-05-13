'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/report/ProgressBar';
import { DescriptionCard } from '@/components/report/DescriptionCard';
import { KeywordsList } from '@/components/report/KeywordsList';
import { OnsiteCard } from '@/components/report/OnsiteCard';
import { OffsiteCard } from '@/components/report/OffsiteCard';
import { GeoTable } from '@/components/report/GeoTable';
import { CompetitorTabs } from '@/components/report/CompetitorTabs';
import { ArticleRecsGrid } from '@/components/report/ArticleRecsGrid';

export function ReportClient({ initialAudit }: { initialAudit: any }) {
  const [audit, setAudit] = useState(initialAudit);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`audit-${audit.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${audit.id}` },
        (payload) => setAudit(payload.new)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const s = audit.sections ?? {};

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-semibold">{audit.domain}</h1>
          <Button
            disabled={audit.status !== 'complete'}
            onClick={async () => {
              const r = await fetch(`/api/audits/${audit.id}/send-pdf`, { method: 'POST' });
              if (r.ok) alert('PDF queued — check your email.');
              else alert('Failed to queue PDF.');
            }}
          >
            Send PDF to my email
          </Button>
        </div>
        <ProgressBar sections={s} />
      </header>

      <DescriptionCard data={s.description} />
      <KeywordsList data={s.keywords} />
      <OnsiteCard data={s.onsite} />
      <OffsiteCard data={s.offsite} />
      <GeoTable data={s.geo} />
      <CompetitorTabs data={s.competitors} />
      <ArticleRecsGrid data={s.article_recommendations} />

      {audit.status === 'failed' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
          <div className="font-medium text-red-700 mb-1">Audit failed</div>
          <div className="text-sm text-red-600">{audit.error}</div>
        </div>
      )}
    </main>
  );
}
