import { ReactNode } from 'react';

export function SectionFrame({
  num,
  title,
  sub,
  tag,
  action,
  children,
  anchor,
}: {
  num: string;
  title: string;
  sub?: string;
  tag?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  anchor?: string;
}) {
  return (
    <section
      id={anchor}
      style={{
        padding: 'clamp(36px, 5vw, 64px) clamp(20px, 4vw, 40px)',
        borderTop: '1px solid var(--border)',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 24,
          maxWidth: 1280,
          margin: '0 auto',
        }}
        className="section-frame-grid"
      >
        <div className="section-frame-num">
          <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 12 }}>
            {num}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 6,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 'clamp(20px, 3vw, 24px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {title}
                {tag}
              </h2>
              {sub && (
                <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--fg-3)', maxWidth: 640, lineHeight: 1.55 }}>
                  {sub}
                </div>
              )}
            </div>
            {action}
          </div>
          <div style={{ marginTop: 28 }}>{children}</div>
        </div>
      </div>

      <style>{`
        @media (min-width: 720px) {
          .section-frame-grid {
            grid-template-columns: 60px minmax(0, 1fr) !important;
          }
        }
        @media (max-width: 720px) {
          .section-frame-num { display: none; }
        }
      `}</style>
    </section>
  );
}
