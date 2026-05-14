export function Logo({ size = 16, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size + 2} height={size + 2} viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="17" height="17" rx="4" stroke="var(--fg)" strokeOpacity="0.85" />
        <circle cx="9" cy="9" r="2.4" fill="var(--signal)" />
        <circle cx="9" cy="9" r="5.2" stroke="var(--signal)" strokeOpacity="0.4" />
      </svg>
      {withWord && (
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.02em" }}>
          SEO GEO<span style={{ color: "var(--fg-3)" }}> AUDIT</span>
        </span>
      )}
    </span>
  );
}
