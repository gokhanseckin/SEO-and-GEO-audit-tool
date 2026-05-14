import { Icon } from "./Icon";

export function StepDot({ done, active }: { done?: boolean; active?: boolean }) {
  if (done) {
    return (
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "var(--signal-bg)",
          border: "1px solid oklch(0.42 0.10 130 / 0.5)",
          color: "var(--signal)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon.check style={{ width: 10, height: 10 }} />
      </span>
    );
  }
  if (active) {
    return (
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1.5px solid var(--info)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "50%",
            background: "var(--info)",
            animation: "pulse 1.4s ease-out infinite",
          }}
        />
      </span>
    );
  }
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "1px dashed var(--border-strong)",
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

export function LoadingDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "currentColor",
        animation: "pulse 1.4s infinite",
      }}
    />
  );
}
