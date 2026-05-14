import { Section } from './Section';
import { Favicon } from '@/components/ds/Favicon';

type Rec = {
  title: string;
  target_keyword?: string;
  angle?: string;
  why_it_ranks?: string;
  source_urls?: string[];
};
type Data = Rec[] | { error?: string };

function isArray(d: Data | undefined): d is Rec[] {
  return Array.isArray(d);
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

export function ArticleRecsGrid({ data }: { data?: Data }) {
  const error = !isArray(data) ? data?.error : undefined;
  const recs: Rec[] = isArray(data) ? data : [];
  const state = !data ? 'skeleton' : error ? (recs.length ? 'partial' : 'error') : 'complete';

  return (
    <Section
      num="07"
      title="Article topics to write"
      sub="Briefs ranked by the chance of winning a Gemini citation or a Google SERP slot. Each is grounded in pages we crawled."
      state={state}
      errorText={error}
      anchor="sec-articles"
      skeleton={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 240, borderRadius: 10 }} />
          ))}
        </div>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {recs.map((a, i) => (
          <article
            key={a.title + i}
            className="surface"
            style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {a.angle && (
                <span className="chip" style={{ background: 'var(--bg-3)' }}>
                  {a.angle.toUpperCase()}
                </span>
              )}
            </div>
            <h4
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
                color: 'var(--fg)',
              }}
            >
              {a.title}
            </h4>
            {a.target_keyword && (
              <div>
                <span className="pill selected" style={{ height: 24, fontSize: 11.5, padding: '0 10px' }}>
                  {a.target_keyword}
                </span>
              </div>
            )}
            {a.why_it_ranks && (
              <div style={{ paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                <div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
                  WHY IT&apos;LL RANK
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>{a.why_it_ranks}</div>
              </div>
            )}
            {(a.source_urls?.length ?? 0) > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                <div className="eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>
                  INSPIRED BY
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(a.source_urls ?? []).slice(0, 3).map((s) => {
                    const host = hostOf(s);
                    const label = host.length > 28 ? host.slice(0, 28) + '…' : host;
                    return (
                      <a
                        key={s}
                        href={s}
                        target="_blank"
                        rel="noreferrer"
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          padding: '3px 6px',
                          borderRadius: 3,
                          background: 'var(--bg-3)',
                          color: 'var(--fg-3)',
                          border: '1px solid var(--border)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Favicon domain={host} size={9} />
                        {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}
