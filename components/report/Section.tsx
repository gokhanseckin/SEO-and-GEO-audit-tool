import { ReactNode } from 'react';
import { SectionFrame } from './SectionFrame';

export type SectionState = 'skeleton' | 'partial' | 'complete' | 'error';

export function Section({
  num,
  title,
  sub,
  state,
  errorText,
  tag,
  action,
  anchor,
  children,
  skeleton,
}: {
  num: string;
  title: string;
  sub?: string;
  state: SectionState;
  errorText?: string;
  tag?: ReactNode;
  action?: ReactNode;
  anchor?: string;
  children: ReactNode;
  skeleton?: ReactNode;
}) {
  return (
    <SectionFrame num={num} title={title} sub={sub} tag={tag} action={action} anchor={anchor}>
      {state === 'partial' && errorText && (
        <div
          style={{
            background: 'var(--amber-bg)',
            border: '1px solid oklch(0.4 0.08 75 / 0.5)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <span className="status status-partial">PARTIAL</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 500 }}>
              Partial data for this section
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{errorText}</div>
          </div>
        </div>
      )}
      {state === 'error' && errorText && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid oklch(0.38 0.12 25 / 0.5)',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500, marginBottom: 4 }}>
            Section failed
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{errorText}</div>
        </div>
      )}
      {state === 'skeleton' && skeleton ? skeleton : children}
    </SectionFrame>
  );
}

export function SkeletonLines({ lines = 3, widths = [95, 88, 72] }: { lines?: number; widths?: number[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 12, width: `${widths[i] ?? 70}%` }} />
      ))}
    </div>
  );
}
