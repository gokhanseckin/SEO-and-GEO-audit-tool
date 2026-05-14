'use client';

import { Logo } from '@/components/ds/Logo';
import { Icon } from '@/components/ds/Icon';
import { Favicon } from '@/components/ds/Favicon';
import { StatusPill, AuditStatus } from '@/components/ds/StatusPill';
import { ProgressRing } from '@/components/ds/ProgressRing';

const SECTION_NAV = [
  { n: '01', label: 'Description', anchor: 'sec-description' },
  { n: '02', label: 'Keywords', anchor: 'sec-keywords' },
  { n: '03', label: 'On-site', anchor: 'sec-onsite' },
  { n: '04', label: 'Off-site', anchor: 'sec-offsite' },
  { n: '05', label: 'GEO visibility', anchor: 'sec-geo' },
  { n: '06', label: 'Competitors', anchor: 'sec-competitors' },
  { n: '07', label: 'Articles', anchor: 'sec-articles' },
];

export function ReportHeader({
  domain,
  status,
  sectionsReady,
  total = 7,
  startedAt,
  elapsed,
  auditId,
  userEmail,
}: {
  domain: string;
  status: AuditStatus;
  sectionsReady: number;
  total?: number;
  startedAt?: string | null;
  elapsed?: string | null;
  auditId: string;
  userEmail?: string | null;
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'oklch(0.155 0.006 250 / 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px clamp(20px, 4vw, 40px)',
          borderBottom: '1px solid var(--border)',
          gap: 12,
          flexWrap: 'wrap',
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
            <span>/report</span>
            <Icon.chevronR style={{ opacity: 0.4 }} />
            <span className="mono" style={{ color: 'var(--fg-2)' }}>
              {auditId.slice(0, 8)}
            </span>
          </div>
        </div>
        {userEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              {userEmail}
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          padding: '20px clamp(20px, 4vw, 40px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <Favicon domain={domain} size={20} />
            <h1
              className="mono"
              style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {domain}
            </h1>
            <StatusPill status={status} />
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-4)',
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            {startedAt && (
              <span>
                Started <span className="mono" style={{ color: 'var(--fg-3)' }}>{startedAt}</span>
              </span>
            )}
            {elapsed && (
              <>
                <span>·</span>
                <span>
                  Elapsed <span className="mono" style={{ color: 'var(--fg-3)' }}>{elapsed}</span>
                </span>
              </>
            )}
            <span>·</span>
            <span>
              ID <span className="mono" style={{ color: 'var(--fg-3)' }}>{auditId.slice(0, 8)}</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="surface" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProgressRing done={sectionsReady} total={total} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-2)' }}>
              <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{sectionsReady}</span> of {total} ready
            </span>
          </div>
        </div>
      </div>

      <nav
        style={{
          padding: '0 clamp(20px, 4vw, 40px)',
          display: 'flex',
          gap: 4,
          borderTop: '1px solid var(--border)',
          overflowX: 'auto',
        }}
      >
        {SECTION_NAV.map((it) => (
          <a
            key={it.n}
            href={`#${it.anchor}`}
            style={{
              padding: '12px 14px',
              color: 'var(--fg-3)',
              fontSize: 13,
              cursor: 'pointer',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>
              {it.n}
            </span>
            {it.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
