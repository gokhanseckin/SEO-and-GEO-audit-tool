'use client';

import { useMemo, useState } from 'react';
import { Section } from './Section';
import { Icon } from '@/components/ds/Icon';
import { Favicon } from '@/components/ds/Favicon';
import { VisibilityBar } from '@/components/ds/VisibilityBar';

type CitedUrl = { url: string; title?: string };
type Prompt = {
  prompt: string;
  user_domain_mentioned: boolean;
  user_domain_rank?: number | null;
  answer_text?: string;
  competitor_domains?: string[];
  cited_urls?: CitedUrl[];
};
type Data = {
  visibility_score?: number;
  prompts?: Prompt[];
  error?: string;
};

type Filter = 'all' | 'mentioned' | 'missing';

function highlight(answer: string, domain: string) {
  if (!domain) return [{ text: answer, mark: false }];
  // Build a regex matching the domain stem case-insensitively (with or without TLD).
  const stem = domain.split('.')[0];
  if (!stem) return [{ text: answer, mark: false }];
  const re = new RegExp(`(${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[a-z]{2,})?)`, 'gi');
  const parts: { text: string; mark: boolean }[] = [];
  let last = 0;
  for (const m of answer.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: answer.slice(last, start), mark: false });
    parts.push({ text: m[0], mark: true });
    last = start + m[0].length;
  }
  if (last < answer.length) parts.push({ text: answer.slice(last), mark: false });
  return parts.length ? parts : [{ text: answer, mark: false }];
}

export function GeoTable({ data, domain }: { data?: Data; domain?: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedIdx, setExpandedIdx] = useState<number>(-1);

  const prompts = useMemo(() => data?.prompts ?? [], [data?.prompts]);
  const total = prompts.length;
  const score = useMemo(
    () => prompts.filter((p) => p.user_domain_mentioned).length,
    [prompts]
  );
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const state = !data
    ? 'skeleton'
    : data.error
    ? prompts.length > 0
      ? 'partial'
      : 'error'
    : 'complete';

  const cells = prompts.map((p) => ({
    mentioned: !!p.user_domain_mentioned,
    rank: p.user_domain_rank ?? null,
    title: p.prompt,
  }));

  const filtered = prompts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) =>
      filter === 'all' ? true : filter === 'mentioned' ? p.user_domain_mentioned : !p.user_domain_mentioned
    );

  return (
    <Section
      num="05"
      title="Do LLMs recommend you?"
      sub="We asked Gemini 2.5 Flash with Search Grounding a set of queries a real prospect might ask. We count mentions, ranks, and who else got cited."
      state={state}
      errorText={data?.error}
      anchor="sec-geo"
      tag={<span className="chip chip-good">GEO · NEW</span>}
      skeleton={
        <>
          <div className="skeleton" style={{ height: 220, borderRadius: 10, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        </>
      }
    >
      <div
        style={{
          background: 'linear-gradient(180deg, oklch(0.20 0.018 130 / 0.4), var(--bg-1))',
          border: '1px solid oklch(0.42 0.10 130 / 0.4)',
          borderRadius: 10,
          padding: 'clamp(20px, 4vw, 32px)',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 240,
            height: 240,
            background: 'radial-gradient(circle at top right, oklch(0.86 0.19 130 / 0.08), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 40,
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: 'var(--signal-d)', marginBottom: 14 }}>
              VISIBILITY SCORE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span
                className="mono"
                style={{
                  fontSize: 'clamp(56px, 9vw, 96px)',
                  fontWeight: 600,
                  lineHeight: 0.9,
                  color: 'var(--signal)',
                  letterSpacing: '-0.04em',
                }}
              >
                {score}
              </span>
              <span className="mono" style={{ fontSize: 36, color: 'var(--fg-3)', fontWeight: 500 }}>
                / {total}
              </span>
              <span className="mono" style={{ fontSize: 16, color: 'var(--fg-3)', marginLeft: 12 }}>
                {pct}%
              </span>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--fg)', margin: 0, maxWidth: 420 }}>
              Gemini mentioned{' '}
              <span className="mono" style={{ color: 'var(--signal)', fontWeight: 600 }}>
                {domain}
              </span>{' '}
              in <span style={{ fontWeight: 600 }}>{score} of {total}</span> relevant questions.
            </p>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              PROMPT-BY-PROMPT
            </div>
            <VisibilityBar cells={cells} />
            {total > 0 && (
              <div
                className="mono"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--fg-4)',
                }}
              >
                <span>01</span>
                {total > 4 && <span>{Math.ceil(total / 2)}</span>}
                <span>{total}</span>
              </div>
            )}
            <div
              style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--signal)' }} />{' '}
                mentioned · {score}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                  }}
                />{' '}
                not mentioned · {total - score}
              </span>
            </div>
          </div>
        </div>
      </div>

      {prompts.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
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
              Prompt details
            </h3>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              {(
                [
                  { id: 'all', label: `All (${total})` },
                  { id: 'mentioned', label: `Mentioned (${score})` },
                  { id: 'missing', label: `Missing (${total - score})` },
                ] as { id: Filter; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '4px 12px',
                    fontSize: 12,
                    borderRadius: 4,
                    background: filter === t.id ? 'var(--bg-3)' : 'transparent',
                    color: filter === t.id ? 'var(--fg)' : 'var(--fg-3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="surface" style={{ overflow: 'hidden' }}>
            {filtered.map(({ p, i }, idx) => (
              <PromptRow
                key={i}
                prompt={p}
                idx={i}
                domain={domain}
                expanded={expandedIdx === i}
                onToggle={() => setExpandedIdx((e) => (e === i ? -1 : i))}
                first={idx === 0}
              />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function PromptRow({
  prompt,
  idx,
  expanded,
  onToggle,
  first,
  domain,
}: {
  prompt: Prompt;
  idx: number;
  expanded: boolean;
  onToggle: () => void;
  first: boolean;
  domain?: string;
}) {
  const p = prompt;
  const topCompetitor = p.competitor_domains?.[0];
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '30px 30px minmax(0,1fr) 110px 90px 30px',
          alignItems: 'center',
          gap: 14,
          padding: '14px 16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        <Icon.chevronR
          style={{
            color: 'var(--fg-4)',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 200ms',
          }}
        />
        <span style={{ fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.4, minWidth: 0 }}>{p.prompt}</span>
        {p.user_domain_mentioned ? (
          <span className="chip chip-good">
            <Icon.check style={{ width: 9, height: 9 }} /> MENTIONED
          </span>
        ) : (
          <span className="chip" style={{ background: 'var(--bg-3)', color: 'var(--fg-4)' }}>
            NOT MENTIONED
          </span>
        )}
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {p.user_domain_mentioned ? (
            <>
              RANK{' '}
              <span style={{ color: 'var(--signal)', fontWeight: 600, fontSize: 13 }}>
                #{p.user_domain_rank ?? '?'}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--fg-4)' }}>—</span>
          )}
        </span>
        {topCompetitor ? <Favicon domain={topCompetitor} /> : <span />}
      </button>
      {expanded && (
        <div
          style={{
            padding: '4px 16px 24px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 28,
          }}
          className="geo-expand"
        >
          {p.answer_text && (
            <div style={{ minWidth: 0 }}>
              <div
                className="eyebrow"
                style={{ color: 'var(--signal-d)', marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon.spark /> GEMINI ANSWER
              </div>
              <div
                style={{
                  padding: 18,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: 'var(--fg-2)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {highlight(p.answer_text, domain ?? '').map((part, j) =>
                  part.mark ? (
                    <mark
                      key={j}
                      style={{
                        background: 'oklch(0.86 0.19 130 / 0.22)',
                        color: 'var(--signal)',
                        padding: '0 4px',
                        borderRadius: 3,
                        fontWeight: 600,
                      }}
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={j}>{part.text}</span>
                  )
                )}
              </div>

              {(p.competitor_domains?.length ?? 0) > 0 && (
                <>
                  <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>
                    COMPETITORS MENTIONED · {p.competitor_domains?.length}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(p.competitor_domains ?? []).map((c) => (
                      <span
                        key={c}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 999,
                          background: c === domain ? 'var(--signal-bg)' : 'var(--bg-2)',
                          fontSize: 12,
                          color: 'var(--fg-2)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <Favicon domain={c} size={10} /> {c}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {(p.cited_urls?.length ?? 0) > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                CITED SOURCES · {p.cited_urls?.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(p.cited_urls ?? []).map((c) => {
                  let host = c.url;
                  try {
                    host = new URL(c.url).hostname;
                  } catch {
                    /* ignore */
                  }
                  return (
                    <a
                      key={c.url}
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="surface"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        textDecoration: 'none',
                        fontSize: 12.5,
                        color: 'var(--fg-2)',
                      }}
                    >
                      <Favicon domain={host} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: 'var(--fg)',
                            fontSize: 12.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.title || c.url}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10.5,
                            color: 'var(--fg-4)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.url}
                        </div>
                      </div>
                      <Icon.ext style={{ color: 'var(--fg-4)' }} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <style>{`
            @media (min-width: 960px) {
              .geo-expand {
                grid-template-columns: minmax(0, 1fr) 320px !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
