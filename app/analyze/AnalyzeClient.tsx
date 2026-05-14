'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ds/Logo';
import { Icon } from '@/components/ds/Icon';
import { StepDot, LoadingDot } from '@/components/ds/StepDot';

type Candidate = { term: string; relevance: number; type: string };

export function AnalyzeClient({ initialDomain }: { initialDomain: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'starting' | 'choosing' | 'running' | 'error'>('starting');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalTop10, setOriginalTop10] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pagesCrawled, setPagesCrawled] = useState<number | null>(null);
  const [sitemapCount, setSitemapCount] = useState<number | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);

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
        const sections = (audit as { sections?: Record<string, unknown> } | null)?.sections ?? {};
        const kw = (sections as { keywords?: { candidates?: Candidate[] } }).keywords;
        const onsite = (sections as { onsite?: { pages?: unknown[]; sitemap_url_count?: number } }).onsite;
        const cands: Candidate[] = kw?.candidates ?? [];
        setCandidates(cands);
        if (Array.isArray(onsite?.pages)) setPagesCrawled(onsite.pages.length);
        if (typeof onsite?.sitemap_url_count === 'number') setSitemapCount(onsite.sitemap_url_count);
        const top10 = cands.slice(0, 10).map((c) => c.term);
        setSelected(new Set(top10));
        setOriginalTop10(new Set(top10));
        setPhase('choosing');
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unexpected error');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px clamp(20px, 4vw, 48px)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Logo />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--fg-4)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>/audit</span>
            <Icon.chevronR style={{ opacity: 0.4 }} />
            <span style={{ color: 'var(--fg-2)' }}>{initialDomain}</span>
            <Icon.chevronR style={{ opacity: 0.4 }} />
            <span style={{ color: 'var(--fg-3)' }}>keywords</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 48px) 80px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 36,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div className="eyebrow">Step 1 of 2 · keyword confirmation</div>
            <h1
              style={{
                fontSize: 'clamp(24px, 4vw, 36px)',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                margin: '10px 0 4px',
              }}
            >
              Auditing{' '}
              <span className="mono" style={{ fontWeight: 500 }}>
                {initialDomain}
              </span>
            </h1>
            <div style={{ color: 'var(--fg-3)', fontSize: 14 }}>
              Gemini read your site. Confirm the keywords we&apos;ll measure visibility against.
            </div>
          </div>
          {phase === 'choosing' && (
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>
              Cancel
            </button>
          )}
        </div>

        {phase === 'starting' && <AnalyzeLoading domain={initialDomain} />}
        {phase === 'error' && <AnalyzeError message={error} onBack={() => router.push('/')} />}
        {(phase === 'choosing' || phase === 'running') && (
          <AnalyzeLoaded
            candidates={candidates}
            selected={selected}
            originalTop10={originalTop10}
            onToggle={toggle}
            onRun={runFull}
            running={phase === 'running'}
            pagesCrawled={pagesCrawled}
            sitemapCount={sitemapCount}
            explainerOpen={explainerOpen}
            setExplainerOpen={setExplainerOpen}
            error={error}
          />
        )}
      </div>
    </main>
  );
}

function AnalyzeLoading({ domain }: { domain: string }) {
  return (
    <div className="surface" style={{ padding: 32, maxWidth: 780 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Reading your site
          </div>
          <div style={{ fontSize: 15, color: 'var(--fg-2)' }}>
            We&apos;re crawling{' '}
            <span className="mono" style={{ color: 'var(--fg)' }}>
              {domain}
            </span>{' '}
            and asking Gemini what you&apos;re about.
          </div>
        </div>
        <span className="status status-running">
          <span className="pulse" /> Running
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0' }}>
        <StepDot active />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, color: 'var(--fg)', fontWeight: 500 }}>
            Extracting keywords with Gemini 2.5
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>
            Fetching pages · parsing HTML · ranking candidates by topical relevance
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--info)' }}>
          running…
        </span>
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            height: 4,
            background: 'var(--bg-3)',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '40%',
              background: 'var(--signal)',
              boxShadow: '0 0 10px oklch(0.86 0.19 130 / 0.5)',
              animation: 'shimmer 1.6s linear infinite',
              backgroundImage:
                'linear-gradient(90deg, var(--signal) 0%, oklch(0.92 0.18 130) 50%, var(--signal) 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
        <div
          className="mono"
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--fg-4)' }}
        >
          <span>working</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LoadingDot /> ~10s
          </span>
        </div>
      </div>
    </div>
  );
}

function AnalyzeError({ message, onBack }: { message: string | null; onBack: () => void }) {
  return (
    <div
      className="surface"
      style={{
        maxWidth: 640,
        padding: 28,
        background: 'var(--danger-bg)',
        borderColor: 'oklch(0.38 0.12 25 / 0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="status status-failed">AUDIT FAILED</span>
      </div>
      <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--fg)' }}>
        We couldn&apos;t start your audit
      </h2>
      <p style={{ margin: 0, color: 'var(--fg-2)', fontSize: 14, lineHeight: 1.6 }}>
        {message || 'An unexpected error happened. No quota was consumed.'}
      </p>
      <div style={{ marginTop: 22, display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          Back to home
        </button>
      </div>
    </div>
  );
}

function AnalyzeLoaded({
  candidates,
  selected,
  onToggle,
  onRun,
  running,
  pagesCrawled,
  sitemapCount,
  explainerOpen,
  setExplainerOpen,
  error,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  originalTop10: Set<string>;
  onToggle: (term: string) => void;
  onRun: () => void;
  running: boolean;
  pagesCrawled: number | null;
  sitemapCount: number | null;
  explainerOpen: boolean;
  setExplainerOpen: (v: boolean) => void;
  error: string | null;
}) {
  const count = selected.size;
  const top10Set = new Set(candidates.slice(0, 10).map((c) => c.term));
  const primary = candidates.filter((c) => top10Set.has(c.term));
  const alternates = candidates.filter((c) => !top10Set.has(c.term));

  const renderChip = (k: Candidate) => {
    const sel = selected.has(k.term);
    const typeShort = k.type === 'long-tail' ? 'long' : k.type === 'question' ? 'q' : 'head';
    const relColor =
      k.relevance > 0.75 ? 'var(--signal)' : k.relevance > 0.55 ? 'var(--amber)' : 'var(--fg-4)';
    return (
      <button
        key={k.term}
        type="button"
        onClick={() => onToggle(k.term)}
        className={`pill ${sel ? 'selected' : 'ghost'}`}
        style={{ height: 32, padding: '0 14px', fontSize: 13 }}
        title={`relevance ${k.relevance?.toFixed?.(2) ?? '?'} · ${k.type}`}
      >
        {sel && <Icon.check style={{ width: 10, height: 10 }} />}
        {k.term}
        <span className="tag" style={{ marginLeft: 6 }}>
          {typeShort}
        </span>
        <span className="dot" style={{ background: relColor }} />
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 32,
        alignItems: 'flex-start',
      }}
      className="analyze-grid"
    >
      <div style={{ minWidth: 0 }}>
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em', margin: 0 }}>
              Primary keywords
              <span
                className="mono"
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  color: 'var(--fg-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 400,
                }}
              >
                top 10 · pre-selected
              </span>
            </h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExplainerOpen(!explainerOpen)}
            >
              Why these keywords?{' '}
              <Icon.chevron
                style={{
                  transform: explainerOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 200ms',
                }}
              />
            </button>
          </div>
          {explainerOpen && (
            <div
              className="surface"
              style={{
                padding: 16,
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--fg-2)',
                lineHeight: 1.55,
                background: 'var(--bg-2)',
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--signal)' }}>
                Methodology
              </div>
              Gemini 2.5 read up to 5 pages on your domain, then proposed terms weighted by frequency,
              position, and topical centrality. Relevance dots are scored 0–1 inside Gemini&apos;s
              response. Swap any term for a candidate below — we&apos;ll measure visibility against
              your final list of up to 10.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{primary.map(renderChip)}</div>
        </section>

        {alternates.length > 0 && (
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>
              Other candidates
              <span
                className="mono"
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  color: 'var(--fg-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 400,
                }}
              >
                {alternates.length} alternates
              </span>
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{alternates.map(renderChip)}</div>
          </section>
        )}

        {error && (
          <div style={{ marginTop: 20, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
        )}
      </div>

      <aside style={{ position: 'sticky', top: 24 }} className="analyze-rail">
        <div className="surface-hi" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Selection
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span
              className="mono"
              style={{
                fontSize: 44,
                fontWeight: 600,
                color: count > 0 ? 'var(--fg)' : 'var(--fg-4)',
                lineHeight: 1,
              }}
            >
              {count}
            </span>
            <span className="mono" style={{ fontSize: 18, color: 'var(--fg-3)' }}>
              / 10
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>keywords picked for measurement</div>

          <div
            style={{
              marginTop: 14,
              height: 4,
              background: 'var(--bg-3)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(count / 10) * 100}%`,
                height: '100%',
                background: 'var(--signal)',
                transition: 'width 250ms',
              }}
            />
          </div>

          <hr className="hr" style={{ margin: '20px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <Stat label="Pages crawled" value={pagesCrawled != null ? String(pagesCrawled) : '—'} />
            <Stat label="Sitemap URLs" value={sitemapCount != null ? String(sitemapCount) : '—'} />
            <Stat label="GEO prompts" value="15" />
            <Stat label="Est. duration" value="~2 min" />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', height: 42 }}
            disabled={count === 0 || running}
            onClick={onRun}
          >
            {running ? (
              <>
                <LoadingDot /> Starting audit
              </>
            ) : (
              <>
                Run full audit <Icon.arrowR />
              </>
            )}
          </button>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--fg-4)',
              textAlign: 'center',
              marginTop: 10,
              letterSpacing: '0.04em',
            }}
          >
            This is your one free audit. No undo.
          </div>
        </div>

        <div style={{ padding: 16, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.7 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Legend
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)' }} /> high
            relevance
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} /> medium
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-4)' }} /> low
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10 }}>
              HEAD
            </span>{' '}
            broad terms ·{' '}
            <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10 }}>
              LONG
            </span>{' '}
            long-tail ·{' '}
            <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10 }}>
              Q
            </span>{' '}
            question
          </div>
        </div>
      </aside>

      <style jsx>{`
        @media (max-width: 900px) {
          .analyze-grid {
            grid-template-columns: 1fr !important;
          }
          .analyze-rail {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
