'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Candidate = { term: string; relevance: number; type: string };

export function AnalyzeClient({ initialDomain }: { initialDomain: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'starting' | 'choosing' | 'running' | 'error'>('starting');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalTop10, setOriginalTop10] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/audits/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: initialDomain }),
        });
        if (cancelled) return;
        if (res.status === 409) {
          const b = await res.json();
          router.replace(`/report/${b.existing_audit_id}?flash=already_used`);
          return;
        }
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setError(b.detail || b.error || `Error ${res.status}`);
          setPhase('error');
          return;
        }
        const b = await res.json();
        setAuditId(b.audit_id);
        const sup = (await import('@/lib/supabase/client')).createClient();
        const { data: audit } = await sup.from('audits').select('sections').eq('id', b.audit_id).single();
        const cands: Candidate[] = (audit as any)?.sections?.keywords?.candidates ?? [];
        setCandidates(cands);
        const top10 = cands.slice(0, 10).map((c) => c.term);
        setSelected(new Set(top10));
        setOriginalTop10(new Set(top10));
        setPhase('choosing');
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setPhase('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [initialDomain, router]);

  function toggle(term: string) {
    const next = new Set(selected);
    if (next.has(term)) next.delete(term);
    else if (next.size < 10) next.add(term);
    setSelected(next);
  }

  async function runFull() {
    if (!auditId || selected.size === 0) return;
    setPhase('running');
    const userModified =
      selected.size !== originalTop10.size ||
      Array.from(selected).some((t) => !originalTop10.has(t));
    const res = await fetch(`/api/audits/${auditId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_keywords: Array.from(selected), user_modified: userModified }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.detail || b.error || `Error ${res.status}`);
      setPhase('error');
      return;
    }
    router.push(`/report/${auditId}`);
  }

  if (phase === 'starting') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-pulse mb-3">Reading {initialDomain}...</div>
          <p className="text-sm text-gray-500">Extracting keywords — this takes ~10 seconds.</p>
        </div>
      </main>
    );
  }
  if (phase === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/')}>Back to home</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Analyzing {initialDomain}</h1>
      <p className="text-gray-600 mb-6">
        We found {candidates.length} keyword candidates. Pick up to 10 to audit (we picked the top 10 for you).
        Selected: <strong>{selected.size}/10</strong>
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {candidates.map((c) => {
          const on = selected.has(c.term);
          return (
            <button
              key={c.term}
              onClick={() => toggle(c.term)}
              className={`px-3 py-1.5 text-sm rounded-full border ${
                on ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
              title={`relevance ${c.relevance.toFixed(2)} · ${c.type}`}
            >
              {c.term}
            </button>
          );
        })}
      </div>

      <Button size="lg" onClick={runFull} disabled={phase === 'running' || selected.size === 0}>
        {phase === 'running' ? 'Starting audit...' : 'Run Full Audit →'}
      </Button>
    </main>
  );
}
