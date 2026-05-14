'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/ds/Logo';
import { Icon } from '@/components/ds/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  pendingDomain?: string;
}

export function AuthModal({ open, onClose, pendingDomain }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    '/auth/post-login' + (pendingDomain ? `?pending_domain=${encodeURIComponent(pendingDomain)}` : '')
  )}`;

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (signInErr) {
      setError(signInErr.message);
      setLoading(false);
    }
  }

  async function sendMagicLink(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (otpErr) setError(otpErr.message);
    else {
      setSentEmail(email);
      setSent(true);
    }
  }

  function resetToForm() {
    setSent(false);
    setSentEmail('');
    setEmail('');
    setError(null);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0.10 0.005 250 / 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="surface-hi"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '100%',
          padding: sent ? 32 : 28,
          boxShadow: '0 24px 60px -16px oklch(0 0 0 / 0.6), 0 0 0 1px var(--border)',
          textAlign: sent ? 'center' : 'left',
        }}
      >
        {sent ? (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--signal-bg)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                border: '1px solid oklch(0.42 0.10 130 / 0.5)',
              }}
            >
              <span style={{ color: 'var(--signal)' }}>
                <Icon.check style={{ width: 20, height: 20 }} />
              </span>
            </div>
            <h2 id="auth-modal-title" style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>
              Check your email
            </h2>
            <p style={{ color: 'var(--fg-3)', fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.6 }}>
              Sent a link to{' '}
              <span className="mono" style={{ color: 'var(--fg)' }}>
                {sentEmail}
              </span>
              .<br />
              The link expires in 10 minutes.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={resetToForm}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Logo withWord={false} size={20} />
              <button
                aria-label="Close"
                className="btn btn-ghost btn-sm"
                style={{ height: 24, width: 24, padding: 0 }}
                onClick={onClose}
              >
                <Icon.x />
              </button>
            </div>
            <h2 id="auth-modal-title" style={{ margin: '12px 0 6px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Sign in to run your audit
            </h2>
            <p style={{ margin: '0 0 22px', color: 'var(--fg-3)', fontSize: 13.5, lineHeight: 1.5 }}>
              Free, one-time. We email you the results when they&apos;re ready.
            </p>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', height: 44 }}
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <Icon.google /> Continue with Google
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '20px 0',
                color: 'var(--fg-4)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              OR
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <form onSubmit={sendMagicLink}>
              <label
                className="mono"
                style={{ fontSize: 10.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                htmlFor="auth-email"
              >
                Email magic link
              </label>
              <input
                id="auth-email"
                className="input"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', marginTop: 8 }}
                disabled={loading}
                autoComplete="email"
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', height: 44, marginTop: 12 }}
                disabled={loading || !email}
              >
                Send magic link <Icon.arrowR />
              </button>
            </form>

            {pendingDomain && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px dashed var(--border)',
                  fontSize: 11.5,
                  color: 'var(--fg-4)',
                  lineHeight: 1.5,
                }}
              >
                We&apos;ll pick up{' '}
                <span className="mono" style={{ color: 'var(--fg-2)' }}>
                  {pendingDomain}
                </span>{' '}
                from your earlier input — no need to retype.
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: 14,
                  color: 'var(--danger)',
                  fontSize: 12.5,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
