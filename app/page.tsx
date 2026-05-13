'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import { isValidDomain, normalizeDomain } from '@/lib/domain';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingDomain, setPendingDomain] = useState<string | undefined>();
  const router = useRouter();
  const supabase = createClient();

  async function onAnalyze() {
    const normalized = normalizeDomain(domain);
    if (!isValidDomain(normalized)) {
      setError('Please enter a valid domain like example.com');
      return;
    }
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      router.push(`/auth/post-login?pending_domain=${encodeURIComponent(normalized)}`);
    } else {
      setPendingDomain(normalized);
      setAuthOpen(true);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-6">
        <div className="font-semibold">SEO + GEO Audit</div>
        <Button variant="ghost" size="sm" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-3">
          SEO + GEO Audit
        </h1>
        <p className="text-lg text-gray-600 text-center mb-8 max-w-md">
          See how Google and LLMs rank your site.
        </p>

        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
            placeholder="yourdomain.com"
            className="flex-1 h-12 px-4 border rounded-md text-base"
          />
          <Button size="lg" onClick={onAnalyze}>Analyze</Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <p className="text-sm text-gray-500 text-center mt-6 max-w-md">
          What you get: keywords · onsite + offsite SEO · LLM visibility · competitors · article ideas.
          Free, 1 per account.
        </p>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} pendingDomain={pendingDomain} />
    </main>
  );
}
