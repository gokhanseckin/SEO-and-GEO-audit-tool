import { Icon } from '@/components/ds/Icon';

export function ReportFailed({
  message,
  errorCode,
  onRetry,
}: {
  message?: string | null;
  errorCode?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div style={{ maxWidth: 800, margin: '64px auto', padding: '0 clamp(20px, 4vw, 40px)' }}>
      <div
        style={{
          background: 'var(--danger-bg)',
          border: '1px solid oklch(0.38 0.12 25 / 0.5)',
          borderRadius: 10,
          padding: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span className="status status-failed">AUDIT FAILED</span>
        </div>
        <h2
          style={{
            margin: '0 0 10px',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'var(--fg)',
          }}
        >
          We couldn&apos;t finish your audit
        </h2>
        <p style={{ margin: 0, color: 'var(--fg-2)', fontSize: 14, lineHeight: 1.6 }}>
          {message ||
            "Something went wrong while running this audit. We couldn't recover — your free audit is still available."}
        </p>

        {errorCode && (
          <div
            className="mono"
            style={{
              marginTop: 18,
              padding: 14,
              background: 'oklch(0.16 0.012 25 / 0.5)',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--fg-3)',
              lineHeight: 1.6,
              border: '1px solid oklch(0.32 0.10 25 / 0.4)',
              wordBreak: 'break-word',
            }}
          >
            <div style={{ color: 'var(--danger)', marginBottom: 6 }}>[ERR] {errorCode}</div>
          </div>
        )}

        {onRetry && (
          <div style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onRetry}>
              <Icon.arrowR /> Retry audit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
