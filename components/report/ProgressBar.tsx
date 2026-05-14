const EXPECTED = [
  'description',
  'keywords',
  'onsite',
  'offsite',
  'geo',
  'competitors',
  'article_recommendations',
];

export function countSectionsReady(sections: Record<string, unknown>): number {
  return EXPECTED.filter((k) => k in sections).length;
}

export const TOTAL_SECTIONS = EXPECTED.length;

export function ProgressBar({ sections }: { sections: Record<string, unknown> }) {
  const have = countSectionsReady(sections);
  const pct = Math.round((have / EXPECTED.length) * 100);
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--fg-4)',
          marginBottom: 6,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}
      >
        <span>Audit progress</span>
        <span>
          {have} / {EXPECTED.length}
        </span>
      </div>
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
            width: `${pct}%`,
            height: '100%',
            background: 'var(--signal)',
            boxShadow: '0 0 10px oklch(0.86 0.19 130 / 0.5)',
            transition: 'width 400ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  );
}
