export type AuditStatus = "running" | "complete" | "failed" | "partial" | "pending";

const MAP: Record<AuditStatus, { cls: string; label: string; pulse: boolean }> = {
  running: { cls: "status-running", label: "Running", pulse: true },
  pending: { cls: "status-running", label: "Pending", pulse: true },
  complete: { cls: "status-complete", label: "Complete", pulse: false },
  failed: { cls: "status-failed", label: "Failed", pulse: false },
  partial: { cls: "status-partial", label: "Partial", pulse: false },
};

export function StatusPill({ status }: { status: AuditStatus }) {
  const s = MAP[status] ?? MAP.running;
  return (
    <span className={`status ${s.cls}`}>
      {s.pulse ? (
        <span className="pulse" />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      )}
      {s.label}
    </span>
  );
}
