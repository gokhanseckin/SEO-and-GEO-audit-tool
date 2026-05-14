import { Section } from './Section';
import { Icon } from '@/components/ds/Icon';

type Directory = { name: string; found: boolean; url?: string };
type Data = {
  domain_age_days?: number;
  https?: boolean;
  indexed_pages_estimate?: number;
  brand_serp_mentions?: number;
  directory_presence?: Directory[];
  error?: string;
};

export function OffsiteCard({ data }: { data?: Data }) {
  const hasData = !!data && (data.domain_age_days != null || data.https != null || (data.directory_presence?.length ?? 0) > 0);
  const state = !data
    ? 'skeleton'
    : data.error
    ? hasData
      ? 'partial'
      : 'error'
    : 'complete';

  return (
    <Section
      num="04"
      title="Off-site signals"
      sub="Domain footprint outside your site — what aggregators and trust signals say about you."
      state={state}
      errorText={data?.error}
      anchor="sec-offsite"
      skeleton={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface" style={{ padding: 18 }}>
              <div className="skeleton" style={{ width: 80, height: 10, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: 100, height: 28, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 120, height: 10 }} />
            </div>
          ))}
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile
          label="Domain age"
          value={data?.domain_age_days != null ? Math.floor(data.domain_age_days / 365) : '—'}
          unit={
            data?.domain_age_days != null ? `y · ${data.domain_age_days % 365}d` : ''
          }
          note={data?.domain_age_days != null ? `${data.domain_age_days} days` : ''}
        />
        <StatTile
          label="HTTPS"
          value={data?.https == null ? '—' : data.https ? 'Yes' : 'No'}
          good={data?.https}
          note="TLS"
        />
        <StatTile
          label="Indexed pages"
          value={
            data?.indexed_pages_estimate != null
              ? data.indexed_pages_estimate.toLocaleString()
              : '—'
          }
          unit=""
          note="Google site: query estimate"
        />
        <StatTile
          label="Brand mentions"
          value={data?.brand_serp_mentions ?? '—'}
          unit={data?.brand_serp_mentions != null ? 'SERP' : ''}
          note="Across selected keywords"
        />
      </div>

      {(data?.directory_presence?.length ?? 0) > 0 && (
        <>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              margin: '32px 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--fg-3)',
            }}
          >
            Directory presence
          </h3>
          <div
            className="surface"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', padding: 0 }}
          >
            {(data?.directory_presence ?? []).map((d, i) => (
              <div
                key={d.name + i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {d.found ? (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'var(--signal-bg)',
                        color: 'var(--signal)',
                        border: '1px solid oklch(0.42 0.10 130 / 0.5)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon.check style={{ width: 10, height: 10 }} />
                    </span>
                  ) : (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: '1px dashed var(--border-strong)',
                        color: 'var(--fg-4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon.x />
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: d.found ? 'var(--fg)' : 'var(--fg-4)' }}>{d.name}</span>
                </div>
                {d.found && d.url ? (
                  <a
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--info)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.url.replace(/^https?:\/\//, '').slice(0, 32)}
                    {d.url.length > 40 ? '…' : ''} <Icon.ext />
                  </a>
                ) : (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                    not found
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function StatTile({
  label,
  value,
  unit,
  note,
  good,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
  good?: boolean;
}) {
  const isEmpty = value == null || value === '' || value === '—';
  const valueColor =
    good === false ? 'var(--danger)' : good === true ? 'var(--signal)' : 'var(--fg)';
  return (
    <div className="surface" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: valueColor }}>
          {isEmpty ? '—' : value}
        </span>
        {!isEmpty && unit && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {unit}
          </span>
        )}
      </div>
      {!isEmpty && note && (
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>
          {note}
        </div>
      )}
    </div>
  );
}
