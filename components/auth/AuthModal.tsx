'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  pendingDomain?: string;
}

export function AuthModal({ open, onClose, pendingDomain }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    '/auth/post-login' + (pendingDomain ? `?pending_domain=${encodeURIComponent(pendingDomain)}` : '')
  )}`;

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function sendMagicLink() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-1">Sign in to see your report</h2>
        <p className="text-sm text-gray-500 mb-4">Free · No credit card · 1 audit per account</p>

        {sent ? (
          <p className="text-sm">Check your email for a sign-in link.</p>
        ) : (
          <>
            <Button onClick={signInWithGoogle} disabled={loading} className="w-full mb-3">
              Continue with Google
            </Button>
            <div className="text-center text-sm text-gray-400 my-3">— or —</div>
            <input
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 border rounded-md mb-2"
              disabled={loading}
            />
            <Button
              variant="secondary"
              onClick={sendMagicLink}
              disabled={loading || !email}
              className="w-full"
            >
              Send magic link
            </Button>
          </>
        )}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
