'use client';

import { useState } from 'react';
import { Section } from './Section';
import { ScoreGauge } from '@/components/ds/ScoreGauge';
import { CWVBadge, CWVTier } from '@/components/ds/CWVBadge';
import { Icon } from '@/components/ds/Icon';

type Issue = { severity: 'high' | 'med' | 'low'; message: string; page: string };
type Page = {
  url: string;
  title?: string;
  meta?: boolean;
  h1?: number;
  alt?: number;
  words?: number;
  schema?: number | string;
  canonical?: string;
  robots?: string;
};
type Lighthouse = {
  performance?: number;
  accessibility?: number;
  best_practices?: number;
  seo?: number;
  cwv?: { lcp_ms?: number; cls?: number; inp_ms?: number };
};
type Data = {
  lighthouse?: Lighthouse;
  issues?: Issue[];
  pages?: Page[];
  sitemap_url_count?: number;
  sitemap_detected?: boolean;
  error?: string;
};

function cwvLCP(ms?: number): CWVTier {
  if (ms == null) return 'warn';
  return ms < 2500 ? 'good' : ms < 4000 ? 'warn' : 'bad';
}
function cwvCLS(v?: number): CWVTier {
  if (v == null) return 'warn';
  return v < 0.1 ? 'good' : v < 0.25 ? 'warn' : 'bad';
}
function cwvINP(ms?: number): CWVTier {
  if (ms == null) return 'warn';
  return ms < 200 ? 'good' : ms < 500 ? 'warn' : 'bad';
}

function shortenPath(u: string) {
  try {
    return new URL(u).pathname || '/';
  } catch {
    return u;
  }
}

export function OnsiteCard({ data }: { data?: Data }) {
  const state = !data
    ? 'skeleton'
    : data.error
    ? data.lighthouse || (data.pages && data.pages.length)
      ? 'partial'
      : 'error'
    : 'complete';

  const L = data?.lighthouse ?? {};
  const cwv = L.cwv ?? {};
  const issues = data?.issues ?? [];
  const pages = data?.pages ?? [];

  return (
    <Section
      num="03"
      title="On-site SEO health"
      sub="Lighthouse + a real crawl across sampled pages."
      state={state}
      errorText={data?.error}
      anchor="sec-onsite"
      skeleton={
        <>
          <div
            className="surface"
            style={{
              padding: 28,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <ScoreGauge key={i} partial size={104} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="surface"
                style={{ padding: 14, flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div className="skeleton" style={{ width: 60, height: 10 }} />
                <div className="skeleton" style={{ width: 90, height: 28 }} />
                <div className="skeleton" style={{ width: 70, height: 10 }} />
              </div>
            ))}
          </div>
        </>
      }
    >
      {L.performance != null && (
        <div
          className="surface"
          style={{
            padding: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          <ScoreGauge label="Performance" value={L.performance} size={104} />
          <ScoreGauge label="Accessibility" value={L.accessibility ?? 0} size={104} />
          <ScoreGauge label="Best Practices" value={L.best_practices ?? 0} size={104} />
          <ScoreGauge label="SEO" value={L.seo ?? 0} size={104} />
        </div>
      )}

      {(cwv.lcp_ms != null || cwv.cls != null || cwv.inp_ms != null) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <CWVBadge
            label="LCP"
            value={cwv.lcp_ms != null ? (cwv.lcp_ms / 1000).toFixed(2) : '—'}
            unit="s"
            tier={cwvLCP(cwv.lcp_ms)}
            target="≤ 2.5s"
          />
          <CWVBadge
            label="CLS"
            value={cwv.cls != null ? cwv.cls.toFixed(2) : '—'}
            unit=""
            tier={cwvCLS(cwv.cls)}
            target="≤ 0.10"
          />
          <CWVBadge
            label="INP"
            value={cwv.inp_ms != null ? Math.round(cwv.inp_ms).toString() : '—'}
            unit="ms"
            tier={cwvINP(cwv.inp_ms)}
            target="≤ 200ms"
          />
        </div>
      )}

      {issues.length > 0 && (
        <>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              margin: '36px 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--fg-3)',
            }}
          >
            Issues found · {issues.length}
          </h3>
          <div className="surface" style={{ overflow: 'hidden' }}>
            {issues.map((it, i) => (
              <IssueRow key={i} item={it} first={i === 0} />
            ))}
          </div>
        </>
      )}

      {pages.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              margin: '36px 0 12px',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--fg-3)',
              }}
            >
              Crawled pages · {pages.length}
            </h3>
            {data?.sitemap_url_count != null && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                Sampled from {data.sitemap_url_count}-URL sitemap
              </div>
            )}
          </div>

          <div className="surface" style={{ overflow: 'hidden' }}>
            <div className="onsite-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Title</th>
                    <th style={{ textAlign: 'center', width: 60 }}>Meta</th>
                    <th style={{ textAlign: 'center', width: 50 }}>H1</th>
                    <th style={{ textAlign: 'right', width: 70 }}>Alt %</th>
                    <th style={{ textAlign: 'right', width: 80 }}>Words</th>
                    <th style={{ width: 110 }}>Canonical</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ color: 'var(--fg)' }}>
                        {shortenPath(p.url)}
                      </td>
                      <td
                        style={{
                          color: 'var(--fg-2)',
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.title ?? '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {p.meta ? (
                          <Icon.check style={{ color: 'var(--signal)' }} />
                        ) : (
                          <Icon.x style={{ color: 'var(--danger)' }} />
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'center' }}>
                        {p.h1 ?? '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {p.alt != null ? (
                          <span
                            style={{
                              color:
                                p.alt >= 90
                                  ? 'var(--signal)'
                                  : p.alt >= 60
                                  ? 'var(--amber)'
                                  : 'var(--danger)',
                            }}
                          >
                            {p.alt}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {p.words != null ? p.words.toLocaleString() : '—'}
                      </td>
                      <td>
                        <span className={`chip ${p.canonical === 'self' ? 'chip-good' : 'chip-bad'}`}>
                          {p.canonical === 'self' ? 'SELF' : (p.canonical ?? 'MISSING')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {data?.sitemap_url_count != null && (
        <div
          className="surface"
          style={{
            marginTop: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'oklch(0.20 0.012 250 / 0.6)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon.check style={{ color: 'var(--signal)', width: 14, height: 14 }} />
            <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
              Sitemap detected at{' '}
              <span className="mono" style={{ color: 'var(--fg)' }}>
                /sitemap.xml
              </span>
            </span>
          </div>
          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {data.sitemap_url_count} URLs
          </span>
        </div>
      )}
    </Section>
  );
}

function IssueRow({ item, first }: { item: Issue; first?: boolean }) {
  const [open, setOpen] = useState(false);
  const sevMap: Record<Issue['severity'], { cls: string; label: string }> = {
    high: { cls: 'chip-bad', label: 'HIGH' },
    med: { cls: 'chip-warn', label: 'MED' },
    low: { cls: 'chip-info', label: 'LOW' },
  };
  const meta = sevMap[item.severity] ?? sevMap.low;
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Icon.chevronR
          style={{
            color: 'var(--fg-4)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 200ms',
          }}
        />
        <span className={`chip ${meta.cls}`} style={{ width: 50, justifyContent: 'center' }}>
          {meta.label}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--fg-2)' }}>{item.message}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>
          {shortenPath(item.page)}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px 60px', fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6 }}>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-4)', marginBottom: 6 }}>
            FULL PAGE URL
          </div>
          <span className="mono" style={{ color: 'var(--info)' }}>
            {item.page}
          </span>
        </div>
      )}
    </div>
  );
}
