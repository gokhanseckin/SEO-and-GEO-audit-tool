export type CWVTier = "good" | "warn" | "bad";

export function CWVBadge({
  label,
  value,
  unit,
  tier,
  target,
}: {
  label: string;
  value: string | number;
  unit: string;
  tier: CWVTier;
  target: string;
}) {
  const cls = tier === "good" ? "chip-good" : tier === "warn" ? "chip-warn" : "chip-bad";
  const badge = tier === "good" ? "PASS" : tier === "warn" ? "NEEDS WORK" : "POOR";
  return (
    <div className="surface" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.08em" }}>{label}</div>
        <span className={`chip ${cls}`}>{badge}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--fg)" }}>{value}</span>
        <span className="mono" style={{ fontSize: 13, color: "var(--fg-3)" }}>{unit}</span>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>target {target}</div>
    </div>
  );
}
