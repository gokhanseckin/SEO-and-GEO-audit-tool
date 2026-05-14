export function ProgressRing({ done, total, size = 18 }: { done: number; total: number; size?: number }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-3)" strokeWidth={2} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--signal)"
        strokeWidth={2}
        fill="none"
        strokeDasharray={`${pct * c} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
