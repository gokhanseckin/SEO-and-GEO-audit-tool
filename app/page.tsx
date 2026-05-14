'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { AuthModal } from '@/components/auth/AuthModal';
import { isValidDomain, normalizeDomain } from '@/lib/domain';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/ds/Logo';
import { Icon } from '@/components/ds/Icon';
import { Favicon } from '@/components/ds/Favicon';
import { ScoreGauge } from '@/components/ds/ScoreGauge';
import { VisibilityBar } from '@/components/ds/VisibilityBar';
import { LoadingDot } from '@/components/ds/StepDot';

const PREVIEW_GEO_CELLS = [
  { mentioned: true, rank: 1 },
  { mentioned: false },
  { mentioned: true, rank: 3 },
  { mentioned: false },
  { mentioned: false },
  { mentioned: true, rank: 2 },
  { mentioned: false },
  { mentioned: false },
  { mentioned: false },
  { mentioned: false },
  { mentioned: true, rank: 5 },
  { mentioned: false },
  { mentioned: false },
  { mentioned: false },
  { mentioned: false },
];

const PREVIEW_COMPETITORS = [
  { domain: 'circle.com', appearances: 9 },
  { domain: 'coinbase.com', appearances: 7 },
  { domain: 'stripe.com', appearances: 5 },
  { domain: 'mercury.com', appearances: 4 },
];

export default function HomePage() {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingDomain, setPendingDomain] = useState<string | undefined>();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  async function onAnalyze() {
    const normalized = normalizeDomain(domain);
    if (!isValidDomain(normalized)) {
      setError("That doesn't look like a domain. Try example.com without spaces or paths.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push(`/auth/post-login?pending_domain=${encodeURIComponent(normalized)}`);
      } else {
        setPendingDomain(normalized);
        setAuthOpen(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const trimmed = domain.trim();
  const looksValid = trimmed.length > 2 && isValidDomain(normalizeDomain(trimmed));
  const hasError = !!error;

  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div
        className="grid-bg"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.6,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px clamp(20px, 4vw, 48px)',
        }}
      >
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="eyebrow hidden sm:inline">v1 · free · 1 audit per account</span>
          {user ? (
            <>
              <span className="eyebrow hidden sm:inline" style={{ color: 'var(--fg-3)' }} title={user.email ?? ''}>
                {user.email}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onSignOut} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <section style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 clamp(20px, 4vw, 48px)' }}>
        <div style={{ paddingTop: 'clamp(48px, 8vw, 96px)', paddingBottom: 64, width: '100%', maxWidth: 720, textAlign: 'center' }}>
          <div className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <Icon.spark style={{ color: 'var(--signal)' }} />
            SEO + GEO audit · powered by Gemini 2.5
          </div>
          <h1
            style={{
              fontSize: 'clamp(34px, 6vw, 56px)',
              lineHeight: 1.04,
              letterSpacing: '-0.035em',
              fontWeight: 600,
              margin: '0 0 20px',
              color: 'var(--fg)',
            }}
          >
            How well does your site rank
            <br />
            in Google <span style={{ color: 'var(--fg-3)' }}>and</span> in LLM answers?
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--fg-3)', margin: '0 0 40px' }}>
            One scan. Real Lighthouse data, on-site signals, off-site presence, and 15 Gemini prompts
            to see whether AI assistants recommend your domain.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAnalyze();
            }}
            style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <span
                className="mono"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--fg-4)',
                  fontSize: 14,
                  pointerEvents: 'none',
                }}
              >
                https://
              </span>
              <input
                className={`input ${hasError ? 'error' : ''}`}
                style={{ width: '100%', paddingLeft: 68, fontFamily: 'var(--font-mono)', fontSize: 14 }}
                placeholder="yourdomain.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={hasError}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              style={{ minWidth: 132 }}
            >
              {submitting ? (
                <>
                  <LoadingDot /> Analyzing
                </>
              ) : (
                <>
                  Analyze <Icon.arrowR />
                </>
              )}
            </button>
          </form>

          {hasError && (
            <div
              style={{
                marginTop: 12,
                color: 'var(--danger)',
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {error}
            </div>
          )}
          {!hasError && looksValid && !submitting && (
            <div
              style={{
                marginTop: 12,
                color: 'var(--fg-4)',
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Looks good. We&apos;ll crawl up to 5 pages.
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 24, color: 'var(--fg-4)', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon.check style={{ color: 'var(--signal)' }} /> No card
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon.check style={{ color: 'var(--signal)' }} /> ~2 min
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon.check style={{ color: 'var(--signal)' }} /> One free audit per account
            </span>
          </div>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 1080,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginTop: 24,
            marginBottom: 80,
          }}
        >
          <PreviewCard
            num="01"
            title="SEO health"
            sub="Lighthouse, Core Web Vitals, on-page checks, sitemap."
            footer="Performance · A11y · BP · SEO"
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <ScoreGauge value={78} size={56} />
              <ScoreGauge value={92} size={56} />
              <ScoreGauge value={84} size={56} />
              <ScoreGauge value={96} size={56} />
            </div>
          </PreviewCard>

          <PreviewCard
            num="02"
            title="GEO visibility"
            sub="15 prompts to Gemini 2.5 with Search Grounding. We count the citations."
            footer="Mention rate across 15 grounded answers"
            highlight
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="mono" style={{ fontSize: 44, fontWeight: 600, color: 'var(--signal)' }}>
                  4
                </span>
                <span className="mono" style={{ fontSize: 16, color: 'var(--fg-3)' }}>
                  / 15
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 'auto' }}>
                  27% VIS
                </span>
              </div>
              <VisibilityBar cells={PREVIEW_GEO_CELLS} />
            </div>
          </PreviewCard>

          <PreviewCard
            num="03"
            title="Competitors + articles"
            sub="Who actually wins your queries, and what to write next."
            footer="SERP appearances across your keywords"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, width: '100%' }}>
              {PREVIEW_COMPETITORS.map((c, i) => (
                <div key={c.domain} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ color: 'var(--fg-4)', width: 14 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Favicon domain={c.domain} />
                  <span className="mono" style={{ color: 'var(--fg-2)', flex: 1 }}>
                    {c.domain}
                  </span>
                  <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 11 }}>
                    {c.appearances}×
                  </span>
                </div>
              ))}
            </div>
          </PreviewCard>
        </div>
      </section>

      <footer
        style={{
          position: 'relative',
          borderTop: '1px solid var(--border)',
          padding: '20px clamp(20px, 4vw, 48px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--fg-4)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span>© 2026 SEO GEO AUDIT</span>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span>Privacy</span>
          <span>Terms</span>
          <span>Methodology</span>
          <span>
            Developed by{' '}
            <a
              href="https://github.com/gokhanseckin"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--fg-2)', textDecoration: 'none' }}
            >
              Gokhan Seckin
            </a>
          </span>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} pendingDomain={pendingDomain} />
    </main>
  );
}

function PreviewCard({
  num,
  title,
  sub,
  footer,
  highlight,
  children,
}: {
  num: string;
  title: string;
  sub: string;
  footer: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="surface"
      style={{
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 220,
        borderColor: highlight ? 'oklch(0.42 0.10 130 / 0.5)' : 'var(--border)',
        background: highlight
          ? 'linear-gradient(180deg, oklch(0.20 0.02 130 / 0.4), var(--bg-1) 60%)'
          : 'var(--bg-1)',
        position: 'relative',
      }}
    >
      {highlight && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 22,
            right: 22,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--signal), transparent)',
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="section-num">{num}</div>
          <h3 style={{ margin: '4px 0 6px', fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>
            {title}
          </h3>
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.5, maxWidth: 280 }}>{sub}</div>
        </div>
        {highlight && <span className="chip chip-good">DIFFERENTIATOR</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{children}</div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--fg-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderTop: '1px dashed var(--border)',
          paddingTop: 10,
        }}
      >
        {footer}
      </div>
    </div>
  );
}
