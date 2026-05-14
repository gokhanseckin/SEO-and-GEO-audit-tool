'use client';

import { useState, useMemo } from 'react';
import { Section } from './Section';
import { Favicon } from '@/components/ds/Favicon';

type SerpRow = { domain: string; appearances: number; avg_position?: number };
type LlmRow = { domain: string; appearances: number; cited_urls?: number };
type Enriched = { domain: string; sources?: string[]; title?: string; meta?: string; summary: string };
type Data = {
  serp_ranked?: SerpRow[];
  llm_ranked?: LlmRow[];
  enriched?: Enriched[];
  error?: string;
};

type Tab = 'serp' | 'llm';

export function CompetitorTabs({ data }: { data?: Data }) {
  const [tab, setTab] = useState<Tab>('llm');

  const serp = useMemo(() => data?.serp_ranked ?? [], [data?.serp_ranked]);
  const llm = useMemo(() => data?.llm_ranked ?? [], [data?.llm_ranked]);
  const enriched = data?.enriched ?? [];

  const { serpOnly, both, llmOnly } = useMemo(() => {
    const serpSet = new Set(serp.map((s) => s.domain));
    const llmSet = new Set(llm.map((s) => s.domain));
    const bothCount = [...serpSet].filter((d) => llmSet.has(d)).length;
    return {
      serpOnly: serpSet.size - bothCount,
      both: bothCount,
      llmOnly: llmSet.size - bothCount,
    };
  }, [serp, llm]);

  const hasAny = serp.length > 0 || llm.length > 0 || enriched.length > 0;
  const state = !data ? 'skeleton' : data.error ? (hasAny ? 'partial' : 'error') : 'complete';

  const list: Array<SerpRow | LlmRow> = tab === 'serp' ? serp : llm;

  return (
    <Section
      num="06"
      title="Competitors"
      sub="Who you're up against. Google rankings and LLM mentions disagree more often than you'd think."
      state={state}
      errorText={data?.error}
      anchor="sec-competitors"
      skeleton={
        <>
          <div className="skeleton" style={{ height: 110, borderRadius: 10, marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[0, 1].map((i) => (
              <div key={i} className="skeleton" style={{ height: 220, borderRadius: 10 }} />
            ))}
          </div>
        </>
      }
    >
      {hasAny && (
        <div
          className="surface"
          style={{
            padding: 22,
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 24,
            alignItems: 'center',
            background: 'var(--bg-1)',
          }}
        >
          <OverlapTile label="In SERP only" count={serpOnly} hint="Rank in Google but not cited by Gemini" />
          <OverlapTile label="In both arenas" count={both} highlight hint="Winning everywhere — your real competition" />
          <OverlapTile label="In LLM only" count={llmOnly} hint="Cited by Gemini, ranked weakly in Google" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }} className="comp-grid">
        <div>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 2,
              marginBottom: 12,
            }}
          >
            {(['serp', 'llm'] as Tab[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 12px',
                  fontSize: 12.5,
                  borderRadius: 4,
                  background: tab === id ? 'var(--bg-3)' : 'transparent',
                  color: tab === id ? 'var(--fg)' : 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {id === 'serp' ? `SERP-ranked (${serp.length})` : `LLM-cited (${llm.length})`}
              </button>
            ))}
          </div>
          <div className="surface" style={{ overflow: 'hidden' }}>
            {list.map((row, i) => (
              <div
                key={row.domain + i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0, 1fr) auto auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Favicon domain={row.domain} />
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      color: 'var(--fg)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.domain}
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {row.appearances}×
                </span>
                {tab === 'serp' ? (
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    avg #{(row as SerpRow).avg_position?.toFixed?.(1) ?? '—'}
                  </span>
                ) : (
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {(row as LlmRow).cited_urls ?? 0} cites
                  </span>
                )}
              </div>
            ))}
            {list.length === 0 && (
              <div style={{ padding: 18, fontSize: 12, color: 'var(--fg-4)' }}>No competitors in this list.</div>
            )}
          </div>
        </div>

        {enriched.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {enriched.map((e) => (
              <div key={e.domain} className="surface" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <Favicon domain={e.domain} size={18} />
                  <span className="mono" style={{ fontSize: 14, color: 'var(--fg)', fontWeight: 500 }}>
                    {e.domain}
                  </span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {(e.sources ?? []).includes('serp') && <span className="chip chip-info">SERP</span>}
                    {(e.sources ?? []).includes('llm') && <span className="chip chip-good">LLM</span>}
                  </div>
                </div>
                {e.title && (
                  <div style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500, marginBottom: 4 }}>{e.title}</div>
                )}
                {e.meta && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--fg-3)',
                      lineHeight: 1.5,
                      marginBottom: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{e.meta}&rdquo;
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--fg-2)',
                    lineHeight: 1.6,
                    paddingTop: 12,
                    borderTop: '1px dashed var(--border)',
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--signal-d)' }}>
                    OUR TAKE · GEMINI
                  </div>
                  {e.summary}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 900px) {
          .comp-grid { grid-template-columns: 380px minmax(0, 1fr) !important; }
        }
      `}</style>
    </Section>
  );
}

function OverlapTile({
  label,
  count,
  hint,
  highlight,
}: {
  label: string;
  count: number;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        className="eyebrow"
        style={{ marginBottom: 8, color: highlight ? 'var(--signal-d)' : 'var(--fg-3)' }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 56,
          fontWeight: 600,
          lineHeight: 1,
          color: highlight ? 'var(--signal)' : 'var(--fg)',
          letterSpacing: '-0.04em',
        }}
      >
        {count}
      </div>
      <div
        style={{ marginTop: 8, fontSize: 11.5, color: 'var(--fg-4)', lineHeight: 1.45, maxWidth: 220, margin: '8px auto 0' }}
      >
        {hint}
      </div>
    </div>
  );
}
