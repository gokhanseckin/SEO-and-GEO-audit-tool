export function Favicon({ domain, size = 14 }: { domain: string; size?: number }) {
  const safe = domain || "?";
  const hue = Math.abs(safe.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  const letter = (safe[0] || "?").toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: `oklch(0.55 0.13 ${hue})`,
        color: "white",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.6,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: "var(--font-mono)",
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
