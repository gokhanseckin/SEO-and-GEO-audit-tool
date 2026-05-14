export function ScoreGauge({
  label,
  value,
  size = 88,
  partial = false,
}: {
  label?: string;
  value?: number;
  size?: number;
  partial?: boolean;
}) {
  if (partial || typeof value !== "number") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="skeleton" style={{ width: size, height: size, borderRadius: "50%" }} />
        <div className="skeleton" style={{ width: 64, height: 10 }} />
      </div>
    );
  }
  const tier = value >= 90 ? "good" : value >= 50 ? "warn" : "bad";
  const color = tier === "good" ? "var(--signal)" : tier === "warn" ? "var(--amber)" : "var(--danger)";
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} stroke="var(--bg-3)" strokeWidth={5} fill="none" />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={5}
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span className="gauge-num" style={{ fontSize: size * 0.32, color }}>
            {value}
          </span>
        </div>
      </div>
      {label !== undefined && (
        <div style={{ fontSize: 11.5, color: "var(--fg-2)", textAlign: "center" }}>{label}</div>
      )}
    </div>
  );
}
