export type VisibilityCell = {
  mentioned: boolean;
  rank?: number | null;
  title?: string;
};

export function VisibilityBar({ cells, height = 36 }: { cells: VisibilityCell[]; height?: number }) {
  if (!cells.length) return null;
  return (
    <div style={{ display: "flex", gap: 4, width: "100%" }}>
      {cells.map((p, i) => (
        <div
          key={i}
          title={p.title}
          style={{
            flex: 1,
            height,
            borderRadius: 3,
            background: p.mentioned ? "var(--signal)" : "var(--bg-3)",
            boxShadow: p.mentioned ? "0 0 12px -2px oklch(0.86 0.19 130 / 0.6)" : "none",
            border: p.mentioned ? "1px solid oklch(0.92 0.18 130)" : "1px solid var(--border)",
            position: "relative",
          }}
        >
          {p.mentioned && p.rank ? (
            <span
              className="mono"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "oklch(0.18 0.02 130)",
              }}
            >
              #{p.rank}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
