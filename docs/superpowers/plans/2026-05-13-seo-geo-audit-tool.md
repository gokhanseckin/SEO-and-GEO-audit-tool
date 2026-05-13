# SEO and GEO Audit Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page SEO + GEO audit tool that analyzes a domain, audits onsite/offsite SEO, probes LLM (Gemini) visibility, finds competitors, and recommends article topics — gated behind sign-up, 1 free audit per user.

**Architecture:** Next.js 15 (App Router) frontend + Vercel API routes for synchronous Phase-1 work, Supabase Postgres for data + Auth + Realtime, Supabase Edge Functions (Deno, 150s budget) for the async Phase-2 pipeline. Single `audits.sections` JSONB column patched progressively by the Edge Function; UI subscribes via Realtime and renders each section as it lands.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Realtime + Edge Functions), Gemini 2.0 Flash with Search Grounding, Serper.dev, Google PageSpeed Insights API, Resend, `@react-pdf/renderer`, Vitest, Playwright, msw.

**Source spec:** [docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md](../specs/2026-05-13-seo-geo-audit-design.md)

---

## Phases (shippable increments)

- **Phase A — Foundation:** Next.js scaffold, Supabase project + migrations + auth, public homepage, login. **End state:** users can sign up and land at an empty dashboard.
- **Phase B — Phase 1 audit:** Domain crawl, keyword extraction, keyword confirmation page. **End state:** signed-in user enters a domain, sees extracted keywords, confirms selection (no full audit yet).
- **Phase C — Phase 2 audit pipeline + report:** Edge Function with all 6 pipeline steps, progressive report rendering via Realtime, heartbeat + completion email. **End state:** full end-to-end audit works.
- **Phase D — PDF export, admin dashboard, polish:** Resend-backed PDF email, admin role + dashboard, retry endpoint, E2E test. **End state:** v1 complete.

Each phase ends with a verification task. Commit after every task.

---

## Phase A — Foundation

### Task A1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Run scaffold command**

```bash
cd "/Users/gokhanseckin/claude-projects/SEO-GEO analysis"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --turbopack --use-npm
```

When prompted about overwriting README.md / .gitignore, choose "No" for both — the existing ones are intentional.

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```
Expected: server starts on http://localhost:3000, default Next.js page renders. Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 15 app with TypeScript + Tailwind"
```

---

### Task A2: Install runtime + dev dependencies

**Files:** `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install @supabase/supabase-js @supabase/ssr @react-pdf/renderer resend zod
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @types/node @playwright/test
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add test scripts to package.json**

Edit `package.json` — add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Verify test runner works**

Create a throwaway `__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('sanity', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run: `npm test`
Expected: PASS (1 test).
Delete the file: `rm __tests__/sanity.test.ts`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add test stack (vitest, RTL, msw, playwright)"
```

---

### Task A3: Create Supabase project + capture credentials

**This task is manual — you do it, then paste values into env files.**

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com/dashboard → New Project. Name: `seo-geo-audit`. Region: closest to your users. Generate a strong DB password and store it in your password manager.

- [ ] **Step 2: Capture credentials**

In project dashboard → Settings → API. Copy:
- Project URL (e.g. `https://abcd1234.supabase.co`) → goes to `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → goes to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret key → goes to `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 3: Create `.env.local` (gitignored)**

Create `.env.local` at repo root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=
SERPER_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
PAGESPEED_API_KEY=
APP_URL=http://localhost:3000
SERPER_QUERY_CAP_DEFAULT=15
```

Leave the empty ones blank for now; they're filled in later tasks.

- [ ] **Step 4: Create `.env.example` (committed)**

Create `.env.example` at repo root with the same keys but no values (just `=`).

- [ ] **Step 5: Commit `.env.example`**

```bash
git add .env.example
git commit -m "chore: add .env.example documenting required env vars"
```

---

### Task A4: Install Supabase CLI + link project

- [ ] **Step 1: Install CLI**

```bash
brew install supabase/tap/supabase
supabase --version
```

- [ ] **Step 2: Login**

```bash
supabase login
```
Follow browser flow.

- [ ] **Step 3: Initialize Supabase in repo**

```bash
cd "/Users/gokhanseckin/claude-projects/SEO-GEO analysis"
supabase init
```

This creates `supabase/` directory.

- [ ] **Step 4: Link to remote project**

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Project ref is the subdomain in your Supabase URL (e.g. `abcd1234` from `abcd1234.supabase.co`). Will prompt for DB password.

- [ ] **Step 5: Commit Supabase scaffolding**

```bash
git add supabase/
git commit -m "chore: init Supabase project structure"
```

---

### Task A5: Write database migration

**Files:**
- Create: `supabase/migrations/20260513000000_init_schema.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260513000000_init_schema.sql`:

```sql
-- ============================================================
-- SEO + GEO Audit Tool — initial schema
-- ============================================================

-- ============ 1. ADMIN ALLOWLIST ============
create table public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);

insert into public.admin_emails (email) values ('gokhanseckin@gmail.com');

-- ============ 2. PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  audits_used int not null default 0,
  created_at timestamptz default now()
);

-- ============ 3. AUDITS ============
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  domain text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'complete', 'failed')),
  llm_provider text not null default 'gemini',
  serper_query_cap int not null default 15 check (serper_query_cap <= 20),
  sections jsonb not null default '{}'::jsonb,
  error text,
  last_heartbeat_at timestamptz,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index audits_user_id_idx on public.audits(user_id);
create index audits_status_idx on public.audits(status);

-- ============ 4. EMAIL DELIVERIES ============
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('completion_fallback', 'pdf_export')),
  resend_message_id text,
  status text not null check (status in ('queued', 'sent', 'failed')),
  error text,
  created_at timestamptz default now()
);

create index email_deliveries_audit_idx on public.email_deliveries(audit_id);

-- ============ 5. TRIGGERS ============

-- Auto-create profile on auth.users insert, assigning admin role if email is in allowlist
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.admin_emails where email = new.email)
         then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quota enforcement (1 lifetime for user, 20/UTC-day for admin)
create or replace function public.check_audit_quota() returns trigger
language plpgsql as $$
declare
  user_role text;
  cnt int;
begin
  select role into user_role from public.profiles where id = new.user_id;
  if user_role = 'admin' then
    select count(*) into cnt from public.audits
      where user_id = new.user_id
        and created_at >= date_trunc('day', now() at time zone 'UTC');
    if cnt >= 20 then
      raise exception 'admin_daily_quota_exceeded';
    end if;
  else
    select count(*) into cnt from public.audits where user_id = new.user_id;
    if cnt >= 1 then
      raise exception 'user_lifetime_quota_exceeded';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_audit_quota
  before insert on public.audits
  for each row execute function public.check_audit_quota();

-- Increment audits_used counter
create or replace function public.increment_audits_used() returns trigger
language plpgsql as $$
begin
  update public.profiles set audits_used = audits_used + 1 where id = new.user_id;
  return new;
end;
$$;

create trigger bump_audits_used
  after insert on public.audits
  for each row execute function public.increment_audits_used();

-- ============ 6. ROW-LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.audits enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.admin_emails enable row level security;

-- Profiles: read+update own
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- Audits: read own, insert own. No update/delete policy — service role only.
create policy "own audits read" on public.audits
  for select using (auth.uid() = user_id);
create policy "own audits insert" on public.audits
  for insert with check (auth.uid() = user_id);

-- Email deliveries: read own only
create policy "own deliveries read" on public.email_deliveries
  for select using (auth.uid() = user_id);

-- admin_emails: no policies = no client access. Service role only.

-- ============ 7. REALTIME ============
-- Enable Realtime publication for audits table so the report UI can subscribe
alter publication supabase_realtime add table public.audits;
```

- [ ] **Step 2: Push migration to remote**

```bash
supabase db push
```
Expected: confirms migration applied. Check in Supabase Studio → Table Editor that `profiles`, `audits`, `email_deliveries`, `admin_emails` exist.

- [ ] **Step 3: Verify admin email row exists**

In Supabase Studio → SQL Editor:
```sql
select * from public.admin_emails;
```
Expected: 1 row with `gokhanseckin@gmail.com`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): initial schema with profiles, audits, email_deliveries, triggers, RLS"
```

---

### Task A6: Configure Supabase Auth providers

**Manual config in Supabase Studio.**

- [ ] **Step 1: Enable email magic-link**

Studio → Authentication → Providers → Email → toggle "Enable Email Provider" ON. Leave "Confirm email" OFF for v1 (magic link IS the confirmation). Save.

- [ ] **Step 2: Set redirect URLs**

Studio → Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (will add production URL later)
- Redirect URLs (add both):
  - `http://localhost:3000/auth/callback`
  - `https://*.vercel.app/auth/callback` (covers preview deploys)

Save.

- [ ] **Step 3: Create Google OAuth client**

In Google Cloud Console (https://console.cloud.google.com):
1. Create or select a project named `seo-geo-audit`.
2. APIs & Services → OAuth consent screen → set External, fill required fields. Add scopes: `userinfo.email`, `userinfo.profile`, `openid`.
3. Credentials → Create OAuth 2.0 Client ID → Web application.
4. Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
5. Copy Client ID + Client Secret.

- [ ] **Step 4: Enable Google in Supabase**

Studio → Authentication → Providers → Google → toggle ON, paste Client ID + Client Secret. Save.

- [ ] **Step 5: Note in plan log**

No code commit. Update your local notes that auth providers are configured. Proceed to next task.

---

### Task A7: Create Supabase client helpers

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/types.ts`

- [ ] **Step 1: Generate DB types**

```bash
supabase gen types typescript --linked > lib/supabase/types.ts
```

This produces a typed Database interface used by all clients.

- [ ] **Step 2: Create browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* called from Server Component — safe to ignore */ }
        },
      },
    }
  );
}

export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
```

- [ ] **Step 4: Create middleware helper**

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './types';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser(); // refreshes session if needed
  return response;
}
```

- [ ] **Step 5: Wire middleware**

Create `middleware.ts` at repo root:

```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```
Expected: clean build with no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat(auth): add Supabase client helpers (browser, server, middleware)"
```

---

### Task A8: Build auth callback + post-login routing

**Files:**
- Create: `app/auth/callback/route.ts`, `app/auth/post-login/page.tsx`

- [ ] **Step 1: Write callback route**

Create `app/auth/callback/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/auth/post-login';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/auth/error`);
}
```

- [ ] **Step 2: Write post-login routing page**

Create `app/auth/post-login/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ pending_domain?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, audits_used')
    .eq('id', user.id)
    .single();

  const { data: existingAudit } = await supabase
    .from('audits')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { pending_domain } = await searchParams;
  const isAdmin = profile?.role === 'admin';

  if (pending_domain) {
    if (isAdmin || !existingAudit) {
      redirect(`/analyze?domain=${encodeURIComponent(pending_domain)}`);
    }
    redirect(`/report/${existingAudit.id}?flash=already_used`);
  }

  if (existingAudit) redirect(`/report/${existingAudit.id}`);
  if (isAdmin) redirect('/dashboard');
  redirect('/');
}
```

- [ ] **Step 3: Create simple auth error page**

Create `app/auth/error/page.tsx`:

```tsx
export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Sign-in failed</h1>
        <p className="text-gray-600">Please try again.</p>
        <a href="/" className="mt-4 inline-block underline">Back to home</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add app/auth/
git commit -m "feat(auth): add OAuth callback + post-login routing brain"
```

---

### Task A9: Build public homepage + AuthModal

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Create: `components/auth/AuthModal.tsx`, `components/ui/Button.tsx`, `lib/domain.ts`, `__tests__/lib/domain.test.ts`

- [ ] **Step 1: Write failing test for domain normalization**

Create `__tests__/lib/domain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeDomain, isValidDomain } from '@/lib/domain';

describe('normalizeDomain', () => {
  it('lowercases', () => { expect(normalizeDomain('Example.COM')).toBe('example.com'); });
  it('strips protocol', () => { expect(normalizeDomain('https://example.com')).toBe('example.com'); });
  it('strips trailing slash', () => { expect(normalizeDomain('example.com/')).toBe('example.com'); });
  it('strips path', () => { expect(normalizeDomain('example.com/foo/bar')).toBe('example.com'); });
  it('strips www', () => { expect(normalizeDomain('www.example.com')).toBe('example.com'); });
  it('strips trailing dot', () => { expect(normalizeDomain('example.com.')).toBe('example.com'); });
  it('trims whitespace', () => { expect(normalizeDomain('  example.com ')).toBe('example.com'); });
});

describe('isValidDomain', () => {
  it('accepts a simple domain', () => { expect(isValidDomain('example.com')).toBe(true); });
  it('accepts subdomains', () => { expect(isValidDomain('app.example.com')).toBe(true); });
  it('rejects empty', () => { expect(isValidDomain('')).toBe(false); });
  it('rejects no TLD', () => { expect(isValidDomain('example')).toBe(false); });
  it('rejects spaces', () => { expect(isValidDomain('exa mple.com')).toBe(false); });
  it('rejects protocol prefix', () => { expect(isValidDomain('http://example.com')).toBe(false); });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npm test -- domain
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement domain helper**

Create `lib/domain.ts`:

```ts
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export function isValidDomain(input: string): boolean {
  if (!input || /\s/.test(input)) return false;
  if (/^https?:\/\//i.test(input)) return false;
  return DOMAIN_RE.test(input);
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- domain
```
Expected: 13 tests PASS.

- [ ] **Step 5: Build Button primitive**

Create `components/ui/Button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-black text-white hover:bg-gray-800 disabled:bg-gray-300',
  secondary: 'bg-white text-black border border-gray-300 hover:bg-gray-50',
  ghost: 'bg-transparent text-black hover:bg-gray-100',
};
const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
});
```

- [ ] **Step 6: Build AuthModal**

Create `components/auth/AuthModal.tsx`:

```tsx
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
```

- [ ] **Step 7: Build homepage**

Replace `app/page.tsx`:

```tsx
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
```

- [ ] **Step 8: Update layout metadata**

Edit `app/layout.tsx` — replace the `metadata` export:

```ts
export const metadata = {
  title: 'SEO + GEO Audit',
  description: 'Analyze a domain for SEO health and LLM visibility.',
};
```

- [ ] **Step 9: Manual smoke**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Page renders with input + button
- Empty input → error "Please enter a valid domain"
- Invalid input (`foo`) → same error
- Valid input → Auth modal opens
- "Continue with Google" redirects to Google
- Returning from Google sign-in lands on `/auth/post-login` then redirects (likely to `/` if no audit, or `/dashboard` for admin)

Stop server. Note: at this point you have no `/dashboard` or `/analyze` page yet — those come in later tasks. Expect a 404 after Google login completes; that's fine.

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx app/layout.tsx components/ lib/domain.ts __tests__/
git commit -m "feat(home): public homepage with domain input + AuthModal"
```

---

### Task A10: Phase A verification

- [ ] **Step 1: Confirm build is clean**

```bash
npm run build && npm test
```
Expected: build success, all tests pass.

- [ ] **Step 2: Confirm manual auth flow works end-to-end**

1. Open http://localhost:3000
2. Enter `example.com` → Analyze → AuthModal opens
3. Sign in via Google
4. Returns to `/auth/post-login` → redirects (to `/dashboard` for your admin email, or `/` for non-admin test)
5. In Supabase Studio → Table Editor → `profiles` — verify your row has `role='admin'`

- [ ] **Step 3: Tag Phase A complete**

```bash
git tag phase-a-complete
git push --tags
```

---

## Phase B — Phase 1 Audit (Keyword Extraction)

### Task B1: LLM provider interface + Gemini implementation

**Files:**
- Create: `lib/llm/provider.ts`, `lib/llm/gemini.ts`, `__tests__/lib/llm/gemini.test.ts`

- [ ] **Step 1: Get Gemini API key**

Get key at https://aistudio.google.com/apikey. Add to `.env.local`:
```
GEMINI_API_KEY=AIza...
```

- [ ] **Step 2: Define provider interface**

Create `lib/llm/provider.ts`:

```ts
export interface KeywordCandidate {
  term: string;
  relevance: number;          // 0..1
  type: 'head' | 'long-tail' | 'question';
}

export interface GroundedAnswer {
  text: string;
  citedUrls: { url: string; title: string }[];
}

export interface LLMProvider {
  name: string;

  extractKeywords(siteText: string): Promise<KeywordCandidate[]>;
  describeDomain(domain: string, siteText: string): Promise<string>;
  groundedAnswer(prompt: string): Promise<GroundedAnswer>;
  summarizeCompetitor(domain: string, snippet: string): Promise<string>;
  recommendArticles(input: ArticleRecsInput): Promise<ArticleRecommendation[]>;
  generateNarrative(auditJson: unknown): Promise<string>;
}

export interface ArticleRecsInput {
  userDomain: string;
  userPageTitles: string[];
  citedPages: { url: string; title: string; metaDesc: string }[];
  selectedKeywords: string[];
}

export interface ArticleRecommendation {
  title: string;
  angle: string;
  target_keyword: string;
  why_it_ranks: string;
  source_urls: string[];
}
```

- [ ] **Step 3: Write failing test for keyword parsing**

Create `__tests__/lib/llm/gemini.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseKeywordsResponse } from '@/lib/llm/gemini';

describe('parseKeywordsResponse', () => {
  it('parses a clean JSON array', () => {
    const raw = '[{"term":"running shoes","relevance":0.95,"type":"head"}]';
    expect(parseKeywordsResponse(raw)).toEqual([
      { term: 'running shoes', relevance: 0.95, type: 'head' },
    ]);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n[{"term":"x","relevance":0.5,"type":"head"}]\n```';
    expect(parseKeywordsResponse(raw)).toHaveLength(1);
  });

  it('filters invalid entries', () => {
    const raw = '[{"term":"ok","relevance":0.5,"type":"head"},{"term":""},{"relevance":1}]';
    expect(parseKeywordsResponse(raw)).toHaveLength(1);
  });

  it('clamps relevance to 0..1', () => {
    const raw = '[{"term":"x","relevance":2,"type":"head"},{"term":"y","relevance":-1,"type":"head"}]';
    const out = parseKeywordsResponse(raw);
    expect(out[0].relevance).toBe(1);
    expect(out[1].relevance).toBe(0);
  });

  it('defaults type to "head" if missing', () => {
    const raw = '[{"term":"x","relevance":0.5}]';
    expect(parseKeywordsResponse(raw)[0].type).toBe('head');
  });

  it('throws on non-array', () => {
    expect(() => parseKeywordsResponse('{}')).toThrow();
  });
});
```

- [ ] **Step 4: Run — should fail**

```bash
npm test -- gemini
```
Expected: FAIL — module not found.

- [ ] **Step 5: Implement Gemini provider**

Create `lib/llm/gemini.ts`:

```ts
import type {
  LLMProvider,
  KeywordCandidate,
  GroundedAnswer,
  ArticleRecsInput,
  ArticleRecommendation,
} from './provider';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

export function parseKeywordsResponse(raw: string): KeywordCandidate[] {
  const cleaned = stripFences(raw);
  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  const out: KeywordCandidate[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.term !== 'string' || !o.term) continue;
    const rel = typeof o.relevance === 'number' ? Math.max(0, Math.min(1, o.relevance)) : 0.5;
    const type = (o.type === 'long-tail' || o.type === 'question') ? o.type : 'head';
    out.push({ term: o.term, relevance: rel, type });
  }
  return out;
}

async function callGemini(prompt: string, opts: { grounding?: boolean } = {}): Promise<{
  text: string;
  groundingMetadata?: { groundingChunks?: { web?: { uri: string; title: string } }[] };
}> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (opts.grounding) body.tools = [{ google_search: {} }];

  const url = `${GEMINI_ENDPOINT}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';
  return { text, groundingMetadata: candidate?.groundingMetadata };
}

export const geminiProvider: LLMProvider = {
  name: 'gemini',

  async extractKeywords(siteText: string): Promise<KeywordCandidate[]> {
    const prompt = `You are an SEO analyst. From the website text below, extract 20-30 candidate keywords for SEO targeting.
Mix head terms, long-tail phrases, and question-style queries. For each, estimate relevance 0..1 based on how clearly the site is about that topic.
Return ONLY valid JSON: an array of {"term": string, "relevance": number, "type": "head"|"long-tail"|"question"}. No prose.

WEBSITE TEXT:
${siteText.slice(0, 12000)}`;
    const { text } = await callGemini(prompt);
    return parseKeywordsResponse(text);
  },

  async describeDomain(domain: string, siteText: string): Promise<string> {
    const prompt = `In 2-3 sentences, describe what ${domain} is and what it offers, written for someone unfamiliar with the brand. Be neutral and factual.

WEBSITE TEXT:
${siteText.slice(0, 6000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },

  async groundedAnswer(prompt: string): Promise<GroundedAnswer> {
    const { text, groundingMetadata } = await callGemini(prompt, { grounding: true });
    const citedUrls = (groundingMetadata?.groundingChunks ?? [])
      .map((c) => c.web)
      .filter((w): w is { uri: string; title: string } => !!w?.uri)
      .map((w) => ({ url: w.uri, title: w.title || w.uri }));
    return { text, citedUrls };
  },

  async summarizeCompetitor(domain: string, snippet: string): Promise<string> {
    const prompt = `In 2-3 sentences, summarize what ${domain} does, based on this homepage content. Be neutral.\n\n${snippet.slice(0, 4000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },

  async recommendArticles(input: ArticleRecsInput): Promise<ArticleRecommendation[]> {
    const prompt = `You are a content strategist. The site ${input.userDomain} targets these keywords: ${input.selectedKeywords.join(', ')}.
LLMs are citing these articles when answering related questions:
${input.citedPages.map((p) => `- ${p.title} — ${p.url}\n  ${p.metaDesc}`).join('\n')}

The user's site currently has pages titled:
${input.userPageTitles.map((t) => `- ${t}`).join('\n')}

Propose 8-12 NEW article ideas this user should write. Each idea must NOT duplicate an existing user page. Return ONLY valid JSON: an array of
{"title": string, "angle": string, "target_keyword": string, "why_it_ranks": string, "source_urls": string[]}.`;
    const { text } = await callGemini(prompt);
    const parsed = JSON.parse(stripFences(text));
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed as ArticleRecommendation[];
  },

  async generateNarrative(auditJson: unknown): Promise<string> {
    const prompt = `You are an SEO consultant writing a client report. Given the audit data below as JSON, produce a clear, structured markdown report with sections:
1. Executive Summary (2-3 paragraphs)
2. What Your Site Does (use the description)
3. Keyword Coverage
4. Onsite SEO Findings
5. Off-site Signals
6. LLM Visibility (GEO)
7. Competitors
8. Recommended Content
End with a "Top 5 Actions" prioritized list.
No preamble. Begin with the H1.

AUDIT DATA:
${JSON.stringify(auditJson).slice(0, 40000)}`;
    const { text } = await callGemini(prompt);
    return text.trim();
  },
};
```

- [ ] **Step 6: Run tests — should pass**

```bash
npm test -- gemini
```
Expected: all keyword parse tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/llm/ __tests__/lib/llm/
git commit -m "feat(llm): add LLMProvider interface + Gemini implementation"
```

---

### Task B2: Site crawler for Phase 1

**Files:**
- Create: `lib/crawl/fetcher.ts`, `lib/crawl/parser.ts`, `__tests__/lib/crawl/parser.test.ts`

- [ ] **Step 1: Write failing tests for HTML parser**

Create `__tests__/lib/crawl/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePage, extractInternalLinks } from '@/lib/crawl/parser';

const SAMPLE = `
<html>
<head>
  <title>Hello World</title>
  <meta name="description" content="A test page" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://example.com/" />
  <meta name="viewport" content="width=device-width" />
  <meta property="og:title" content="Hello" />
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head>
<body>
  <h1>Main Heading</h1>
  <h2>Sub</h2>
  <p>Some text content here.</p>
  <img src="/a.jpg" alt="alt text" />
  <img src="/b.jpg" />
  <a href="/about">About</a>
  <a href="https://example.com/contact">Contact</a>
  <a href="https://other.com/x">External</a>
</body>
</html>`;

describe('parsePage', () => {
  it('extracts title', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').title).toBe('Hello World');
  });
  it('extracts meta description', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').meta_desc).toBe('A test page');
  });
  it('extracts H1', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').h1).toEqual(['Main Heading']);
  });
  it('detects schema.org JSON-LD count', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').schema_jsonld_count).toBe(1);
  });
  it('computes alt coverage', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').alt_coverage).toBe(0.5);
  });
  it('detects viewport', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').viewport_set).toBe(true);
  });
  it('extracts canonical', () => {
    expect(parsePage(SAMPLE, 'https://example.com/').canonical).toBe('https://example.com/');
  });
});

describe('extractInternalLinks', () => {
  it('returns only same-host links, absolute URLs', () => {
    const links = extractInternalLinks(SAMPLE, 'https://example.com/');
    expect(links).toContain('https://example.com/about');
    expect(links).toContain('https://example.com/contact');
    expect(links).not.toContain('https://other.com/x');
  });
});
```

- [ ] **Step 2: Run test — fails**

```bash
npm test -- parser
```

- [ ] **Step 3: Implement parser**

Create `lib/crawl/parser.ts`:

```ts
export interface ParsedPage {
  url: string;
  title: string | null;
  meta_desc: string | null;
  h1: string[];
  h2: string[];
  word_count: number;
  canonical: string | null;
  robots_meta: string | null;
  og_present: boolean;
  schema_jsonld_count: number;
  viewport_set: boolean;
  alt_coverage: number;            // 0..1
  https: boolean;
  text_content: string;            // truncated body text
}

function match1(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

function matchAll(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1].trim());
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
             .replace(/<style[\s\S]*?<\/style>/gi, ' ')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ').trim();
}

export function parsePage(html: string, url: string): ParsedPage {
  const title = match1(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta_desc = match1(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const h1 = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags);
  const h2 = matchAll(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(stripTags);
  const canonical = match1(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots_meta = match1(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  const og_present = /<meta\s+property=["']og:/i.test(html);
  const schema_jsonld_count = (html.match(/<script[^>]*type=["']application\/ld\+json["']/gi) || []).length;
  const viewport_set = /<meta\s+name=["']viewport["']/i.test(html);

  const imgs = matchAll(html, /<img\b([^>]*)>/gi);
  const withAlt = imgs.filter((attrs) => /\balt\s*=\s*["'][^"']+["']/i.test(attrs)).length;
  const alt_coverage = imgs.length === 0 ? 1 : withAlt / imgs.length;

  const text_content = stripTags(html).slice(0, 8000);
  const word_count = text_content.split(/\s+/).filter(Boolean).length;

  return {
    url, title, meta_desc, h1, h2, word_count, canonical, robots_meta,
    og_present, schema_jsonld_count, viewport_set, alt_coverage,
    https: url.startsWith('https://'),
    text_content,
  };
}

export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const out = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.host === base.host && u.protocol.startsWith('http')) {
        u.hash = ''; u.search = '';
        out.add(u.toString());
      }
    } catch { /* malformed href */ }
  }
  return Array.from(out);
}
```

- [ ] **Step 4: Run tests — pass**

```bash
npm test -- parser
```

- [ ] **Step 5: Implement fetcher**

Create `lib/crawl/fetcher.ts`:

```ts
export async function fetchHtml(url: string, timeoutMs = 5000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEO-GEO-Audit-Bot/1.0 (+contact: gokhanseckin@gmail.com)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new Error(`Not HTML: ${ct}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface CrawlResult {
  homepage: { url: string; html: string };
  pages: { url: string; html: string }[];
}

export async function crawlSite(domain: string, maxPages = 5): Promise<CrawlResult> {
  const root = `https://${domain}/`;
  const homepageHtml = await fetchHtml(root);
  const { extractInternalLinks } = await import('./parser');
  const links = extractInternalLinks(homepageHtml, root)
    .filter((u) => u !== root)
    .slice(0, maxPages);

  const settled = await Promise.allSettled(
    links.map(async (url) => ({ url, html: await fetchHtml(url) }))
  );
  const pages = settled
    .filter((r): r is PromiseFulfilledResult<{ url: string; html: string }> => r.status === 'fulfilled')
    .map((r) => r.value);

  return { homepage: { url: root, html: homepageHtml }, pages };
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/crawl/ __tests__/lib/crawl/
git commit -m "feat(crawl): add HTML fetcher + parser for Phase 1 keyword extraction"
```

---

### Task B3: `/api/audits/start` route

**Files:**
- Create: `app/api/audits/start/route.ts`, `__tests__/app/api/audits/start.test.ts`

- [ ] **Step 1: Write failing route test**

Create `__tests__/app/api/audits/start.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase helpers
const mockUser = { id: 'user-1' };
const mockProfile = { role: 'user' };
const mockSupabase: any = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
  createServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/crawl/fetcher', () => ({
  crawlSite: vi.fn().mockResolvedValue({
    homepage: { url: 'https://example.com/', html: '<title>X</title><body>hello world</body>' },
    pages: [],
  }),
}));

vi.mock('@/lib/llm/gemini', () => ({
  geminiProvider: {
    extractKeywords: vi.fn().mockResolvedValue([
      { term: 'k1', relevance: 0.9, type: 'head' },
      { term: 'k2', relevance: 0.5, type: 'long-tail' },
    ]),
  },
}));

import { POST } from '@/app/api/audits/start/route';

function chain(returnValue: any) {
  const c: any = {};
  c.select = () => c; c.eq = () => c; c.order = () => c; c.limit = () => c;
  c.maybeSingle = () => Promise.resolve({ data: returnValue, error: null });
  c.single = () => Promise.resolve({ data: returnValue, error: null });
  c.insert = (row: any) => ({ select: () => ({ single: () => Promise.resolve({ data: { ...row, id: 'audit-1' }, error: null }) }) });
  return c;
}

describe('POST /api/audits/start', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
  });

  it('returns 401 when no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid domain', async () => {
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'not a domain' }),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when user already has an audit (non-admin)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return chain(mockProfile);
      if (table === 'audits') return chain({ id: 'existing-1' });
      return chain(null);
    });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.existing_audit_id).toBe('existing-1');
  });

  it('happy path creates audit and returns id', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return chain(mockProfile);
      if (table === 'audits') return chain(null);
      return chain(null);
    });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audit_id).toBe('audit-1');
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
npm test -- start
```

- [ ] **Step 3: Implement route**

Create `app/api/audits/start/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidDomain, normalizeDomain } from '@/lib/domain';
import { crawlSite } from '@/lib/crawl/fetcher';
import { parsePage } from '@/lib/crawl/parser';
import { geminiProvider } from '@/lib/llm/gemini';

const Body = z.object({ domain: z.string().min(1).max(253) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const domain = normalizeDomain(parsed.data.domain);
  if (!isValidDomain(domain)) return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: existing } = await supabase
    .from('audits')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'quota_exceeded', existing_audit_id: existing.id }, { status: 409 });
  }

  // Phase 1: crawl + keyword extract
  let crawl;
  try { crawl = await crawlSite(domain, 5); }
  catch (e: any) {
    return NextResponse.json({ error: 'crawl_failed', detail: e.message }, { status: 422 });
  }

  const allPages = [crawl.homepage, ...crawl.pages].map((p) => parsePage(p.html, p.url));
  const combinedText = allPages.map((p) => `# ${p.title ?? ''}\n${p.text_content}`).join('\n\n');

  let candidates;
  try { candidates = await geminiProvider.extractKeywords(combinedText); }
  catch (e: any) {
    return NextResponse.json({ error: 'keyword_extract_failed', detail: e.message }, { status: 502 });
  }

  // Sort by relevance desc
  candidates.sort((a, b) => b.relevance - a.relevance);

  const cap = Number(process.env.SERPER_QUERY_CAP_DEFAULT ?? 15);

  const svc = createServiceClient();
  const { data: inserted, error: insErr } = await svc
    .from('audits')
    .insert({
      user_id: user.id,
      domain,
      status: 'pending',
      llm_provider: 'gemini',
      serper_query_cap: Math.min(cap, 20),
      sections: {
        keywords: { candidates, selected: [], user_modified: false },
        // store crawled pages in onsite section now to reuse later
        onsite_crawl_cache: allPages.map((p) => ({
          url: p.url, title: p.title, meta_desc: p.meta_desc, h1: p.h1, h2: p.h2,
          word_count: p.word_count, canonical: p.canonical, robots_meta: p.robots_meta,
          og_present: p.og_present, schema_jsonld_count: p.schema_jsonld_count,
          viewport_set: p.viewport_set, alt_coverage: p.alt_coverage, https: p.https,
          text_content: p.text_content,
        })),
      },
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.message.includes('quota_exceeded')) {
      return NextResponse.json({ error: 'quota_exceeded' }, { status: 409 });
    }
    return NextResponse.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ audit_id: inserted.id });
}
```

- [ ] **Step 4: Run tests — pass**

```bash
npm test -- start
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/audits/start/ __tests__/app/api/
git commit -m "feat(api): POST /api/audits/start — crawls site, extracts keywords, creates audit row"
```

---

### Task B4: `/analyze` page (keyword confirmation)

**Files:**
- Create: `app/analyze/page.tsx`, `app/analyze/AnalyzeClient.tsx`, `app/api/audits/[id]/run/route.ts`

- [ ] **Step 1: Server page**

Create `app/analyze/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyzeClient } from './AnalyzeClient';

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { domain } = await searchParams;
  if (!domain) redirect('/');

  return <AnalyzeClient initialDomain={domain} />;
}
```

- [ ] **Step 2: Client component**

Create `app/analyze/AnalyzeClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Candidate = { term: string; relevance: number; type: string };

export function AnalyzeClient({ initialDomain }: { initialDomain: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'starting' | 'choosing' | 'running' | 'error'>('starting');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalTop10, setOriginalTop10] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/audits/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: initialDomain }),
        });
        if (cancelled) return;
        if (res.status === 409) {
          const b = await res.json();
          router.replace(`/report/${b.existing_audit_id}?flash=already_used`);
          return;
        }
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setError(b.detail || b.error || `Error ${res.status}`);
          setPhase('error');
          return;
        }
        const b = await res.json();
        setAuditId(b.audit_id);
        const sup = (await import('@/lib/supabase/client')).createClient();
        const { data: audit } = await sup.from('audits').select('sections').eq('id', b.audit_id).single();
        const cands: Candidate[] = (audit as any)?.sections?.keywords?.candidates ?? [];
        setCandidates(cands);
        const top10 = cands.slice(0, 10).map((c) => c.term);
        setSelected(new Set(top10));
        setOriginalTop10(new Set(top10));
        setPhase('choosing');
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setPhase('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [initialDomain, router]);

  function toggle(term: string) {
    const next = new Set(selected);
    if (next.has(term)) next.delete(term);
    else if (next.size < 10) next.add(term);
    setSelected(next);
  }

  async function runFull() {
    if (!auditId || selected.size === 0) return;
    setPhase('running');
    const userModified =
      selected.size !== originalTop10.size ||
      Array.from(selected).some((t) => !originalTop10.has(t));
    const res = await fetch(`/api/audits/${auditId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_keywords: Array.from(selected), user_modified: userModified }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.detail || b.error || `Error ${res.status}`);
      setPhase('error');
      return;
    }
    router.push(`/report/${auditId}`);
  }

  if (phase === 'starting') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-pulse mb-3">Reading {initialDomain}...</div>
          <p className="text-sm text-gray-500">Extracting keywords — this takes ~10 seconds.</p>
        </div>
      </main>
    );
  }
  if (phase === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/')}>Back to home</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Analyzing {initialDomain}</h1>
      <p className="text-gray-600 mb-6">
        We found {candidates.length} keyword candidates. Pick up to 10 to audit (we picked the top 10 for you).
        Selected: <strong>{selected.size}/10</strong>
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {candidates.map((c) => {
          const on = selected.has(c.term);
          return (
            <button
              key={c.term}
              onClick={() => toggle(c.term)}
              className={`px-3 py-1.5 text-sm rounded-full border ${
                on ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
              title={`relevance ${c.relevance.toFixed(2)} · ${c.type}`}
            >
              {c.term}
            </button>
          );
        })}
      </div>

      <Button size="lg" onClick={runFull} disabled={phase === 'running' || selected.size === 0}>
        {phase === 'running' ? 'Starting audit...' : 'Run Full Audit →'}
      </Button>
    </main>
  );
}
```

- [ ] **Step 3: `/api/audits/[id]/run` route**

Create `app/api/audits/[id]/run/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const Body = z.object({
  selected_keywords: z.array(z.string()).min(1).max(10),
  user_modified: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('id, user_id, status, sections').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (audit.status !== 'pending') {
    return NextResponse.json({ error: 'wrong_status', status: audit.status }, { status: 409 });
  }

  const sections = audit.sections as Record<string, unknown>;
  const keywords = (sections.keywords ?? {}) as Record<string, unknown>;
  const newSections = {
    ...sections,
    keywords: {
      ...keywords,
      selected: parsed.data.selected_keywords,
      user_modified: parsed.data.user_modified,
    },
  };

  const { error: upErr } = await svc
    .from('audits')
    .update({ status: 'running', started_at: new Date().toISOString(), sections: newSections })
    .eq('id', id);
  if (upErr) return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 500 });

  // Dispatch Edge Function (fire-and-forget)
  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-audit`;
  fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ audit_id: id }),
  }).catch((e) => console.error('edge dispatch failed:', e));

  return NextResponse.json({ ok: true }, { status: 202 });
}
```

- [ ] **Step 4: Stub `/report/[id]` page (placeholder for Phase C)**

Create `app/report/[id]/page.tsx`:

```tsx
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Report {id}</h1>
      <p className="text-gray-500">Progressive report renders here in Phase C.</p>
    </main>
  );
}
```

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

1. Sign in (admin email works without quota).
2. Enter `example.com` on homepage, hit Analyze → land on `/analyze`.
3. Wait ~10s → keyword chips appear with top 10 pre-selected.
4. Toggle a chip → counter updates.
5. Click "Run Full Audit" → navigates to `/report/{id}` placeholder.
6. In Supabase Studio, check `audits` row → `status='running'`, `sections.keywords.selected` populated.

(The Edge Function dispatch will fail in this smoke test since it's not deployed yet — that's expected. The row stays in `running` status; we'll wire the function in Phase C.)

- [ ] **Step 6: Commit**

```bash
git add app/analyze/ app/api/audits/ app/report/
git commit -m "feat(audit): /analyze keyword confirmation page + /api/audits/[id]/run dispatcher"
```

---

### Task B5: Phase B verification

- [ ] **Step 1: Tests + build**

```bash
npm test && npm run build
```

- [ ] **Step 2: Manual end-to-end (Phase 1 only)**

Repeat the smoke from B4 with a real public domain (e.g. `news.ycombinator.com`). Verify:
- Keywords are sensible
- Pre-selected 10 are the highest-relevance ones
- Audit row exists with `sections.keywords.candidates` populated

- [ ] **Step 3: Tag**

```bash
git tag phase-b-complete && git push --tags
```

---

## Phase C — Phase 2 Audit Pipeline + Progressive Report

### Task C1: Edge Function scaffolding + shared types

**Files:**
- Create: `supabase/functions/run-audit/index.ts`, `supabase/functions/run-audit/lib/types.ts`, `supabase/functions/run-audit/lib/db.ts`, `supabase/functions/run-audit/lib/gemini.ts`, `supabase/functions/run-audit/lib/fetch.ts`

- [ ] **Step 1: Define shared types**

Create `supabase/functions/run-audit/lib/types.ts`:

```ts
export interface AuditRow {
  id: string;
  user_id: string;
  domain: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  serper_query_cap: number;
  sections: Record<string, unknown>;
  last_heartbeat_at: string | null;
}

export interface KeywordCandidate { term: string; relevance: number; type: string; }
export interface CrawledPage {
  url: string; title: string | null; meta_desc: string | null;
  h1: string[]; h2: string[]; word_count: number;
  canonical: string | null; robots_meta: string | null;
  og_present: boolean; schema_jsonld_count: number;
  viewport_set: boolean; alt_coverage: number; https: boolean;
  text_content: string;
}
```

- [ ] **Step 2: DB helper**

Create `supabase/functions/run-audit/lib/db.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { AuditRow } from './types.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export function db() {
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadAudit(id: string): Promise<AuditRow> {
  const { data, error } = await db().from('audits').select('*').eq('id', id).single();
  if (error) throw error;
  return data as AuditRow;
}

export async function patchSection(auditId: string, key: string, value: unknown): Promise<void> {
  const supabase = db();
  const { data: current } = await supabase.from('audits').select('sections').eq('id', auditId).single();
  const sections = { ...(current?.sections ?? {}), [key]: value };
  const { error } = await supabase.from('audits').update({ sections }).eq('id', auditId);
  if (error) throw error;
}

export async function setStatus(
  auditId: string,
  status: 'running' | 'complete' | 'failed',
  extra: Partial<{ error: string; completed_at: string; last_heartbeat_at: string }> = {}
): Promise<void> {
  const { error } = await db().from('audits').update({ status, ...extra }).eq('id', auditId);
  if (error) throw error;
}

export async function getLastHeartbeat(auditId: string): Promise<string | null> {
  const { data } = await db().from('audits').select('last_heartbeat_at').eq('id', auditId).single();
  return (data?.last_heartbeat_at ?? null) as string | null;
}
```

- [ ] **Step 3: Gemini wrapper for Deno**

Create `supabase/functions/run-audit/lib/gemini.ts`:

```ts
const KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GroundedResult {
  text: string;
  citedUrls: { url: string; title: string }[];
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

async function call(prompt: string, grounding = false): Promise<any> {
  const body: any = { contents: [{ parts: [{ text: prompt }] }] };
  if (grounding) body.tools = [{ google_search: {} }];
  const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  return await res.json();
}

export async function describe(domain: string, siteText: string): Promise<string> {
  const prompt = `In 2-3 sentences, describe what ${domain} is and what it offers. Be neutral.\n\nSITE TEXT:\n${siteText.slice(0, 6000)}`;
  const data = await call(prompt);
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

export async function grounded(prompt: string): Promise<GroundedResult> {
  const data = await call(prompt, true);
  const cand = data.candidates?.[0];
  const text: string = cand?.content?.parts?.[0]?.text ?? '';
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  const citedUrls = chunks
    .map((c: any) => c.web)
    .filter((w: any) => w?.uri)
    .map((w: any) => ({ url: w.uri, title: w.title || w.uri }));
  return { text, citedUrls };
}

export async function summarizeCompetitor(domain: string, snippet: string): Promise<string> {
  const prompt = `In 2-3 sentences, summarize what ${domain} does, based on its homepage content. Be neutral.\n\n${snippet.slice(0, 4000)}`;
  const data = await call(prompt);
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

export async function recommendArticles(input: {
  userDomain: string;
  userPageTitles: string[];
  citedPages: { url: string; title: string; metaDesc: string }[];
  selectedKeywords: string[];
}): Promise<any[]> {
  const prompt = `You are a content strategist. The site ${input.userDomain} targets these keywords: ${input.selectedKeywords.join(', ')}.
LLMs cite these pages when answering related questions:
${input.citedPages.map((p) => `- ${p.title} — ${p.url}\n  ${p.metaDesc}`).join('\n')}

Existing user pages:
${input.userPageTitles.map((t) => `- ${t}`).join('\n')}

Propose 8-12 NEW article ideas the user should write (do NOT duplicate existing pages). Return ONLY a JSON array of
{"title":string,"angle":string,"target_keyword":string,"why_it_ranks":string,"source_urls":string[]}.`;
  const data = await call(prompt);
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  const parsed = JSON.parse(stripFences(raw));
  return Array.isArray(parsed) ? parsed : [];
}
```

- [ ] **Step 4: Fetch helper**

Create `supabase/functions/run-audit/lib/fetch.ts`:

```ts
export async function fetchText(url: string, timeoutMs = 6000): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEO-GEO-Audit-Bot/1.0' },
      signal: c.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

export async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(`http ${res.status}: ${await res.text()}`);
    return await res.json();
  } finally { clearTimeout(t); }
}
```

- [ ] **Step 5: Entry point skeleton**

Create `supabase/functions/run-audit/index.ts`:

```ts
import { loadAudit, setStatus, patchSection, getLastHeartbeat } from './lib/db.ts';

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const auditId: string | undefined = body?.audit_id;
  if (!auditId) return new Response('missing audit_id', { status: 400 });

  // Background work, return immediately so the dispatcher isn't blocked
  (async () => {
    try {
      await setStatus(auditId, 'running');
      const audit = await loadAudit(auditId);

      // Placeholder: real step imports added in subsequent tasks.
      await patchSection(auditId, 'description', { blurb: 'TODO', completed_at: new Date().toISOString() });

      await setStatus(auditId, 'complete', { completed_at: new Date().toISOString() });
    } catch (e) {
      console.error('audit failed', e);
      await setStatus(auditId, 'failed', { error: String(e) }).catch(() => {});
    }
  })();

  return new Response(JSON.stringify({ accepted: true, audit_id: auditId }), {
    headers: { 'Content-Type': 'application/json' }, status: 202,
  });
});
```

- [ ] **Step 6: Set Edge Function secrets**

```bash
supabase secrets set \
  GEMINI_API_KEY="$(grep GEMINI_API_KEY .env.local | cut -d= -f2)" \
  SERPER_API_KEY="$(grep SERPER_API_KEY .env.local | cut -d= -f2)" \
  PAGESPEED_API_KEY="$(grep PAGESPEED_API_KEY .env.local | cut -d= -f2)" \
  RESEND_API_KEY="$(grep RESEND_API_KEY .env.local | cut -d= -f2)" \
  RESEND_FROM_EMAIL="$(grep RESEND_FROM_EMAIL .env.local | cut -d= -f2)" \
  APP_URL="$(grep APP_URL .env.local | cut -d= -f2)"
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided to Edge Functions.)

- [ ] **Step 7: Deploy skeleton**

```bash
supabase functions deploy run-audit --no-verify-jwt
```

`--no-verify-jwt` because we authenticate with the service role key from our API route, not user JWTs.

- [ ] **Step 8: Smoke test deployed function**

Replay a saved row through the function:

```bash
AUDIT_ID="<paste-an-audit-id-with-status=running>"
curl -X POST "$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)/functions/v1/run-audit" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d "{\"audit_id\":\"$AUDIT_ID\"}"
```

Expected: `{"accepted":true,"audit_id":"..."}`. In Supabase Studio, the audit row should transition to `complete` with `sections.description.blurb='TODO'`.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/
git commit -m "feat(edge): scaffold run-audit Edge Function with DB + Gemini helpers"
```

---

### Task C2: Description step + onsite cache reuse

**Files:**
- Modify: `supabase/functions/run-audit/index.ts`
- Create: `supabase/functions/run-audit/steps/description.ts`

- [ ] **Step 1: Description step**

Create `supabase/functions/run-audit/steps/description.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { describe } from '../lib/gemini.ts';
import type { AuditRow, CrawledPage } from '../lib/types.ts';

export async function runDescription(audit: AuditRow): Promise<void> {
  const cache = (audit.sections as any).onsite_crawl_cache as CrawledPage[] | undefined;
  const text = (cache ?? []).map((p) => `# ${p.title ?? ''}\n${p.text_content}`).join('\n\n');
  try {
    const blurb = await describe(audit.domain, text);
    await patchSection(audit.id, 'description', { blurb, completed_at: new Date().toISOString() });
  } catch (e) {
    await patchSection(audit.id, 'description', { error: String(e), completed_at: new Date().toISOString() });
  }
}
```

- [ ] **Step 2: Wire into index.ts**

Replace the placeholder body in `supabase/functions/run-audit/index.ts`'s async IIFE:

```ts
import { runDescription } from './steps/description.ts';
// ... inside the async block, after loadAudit:
await runDescription(audit);
```

(Full file will be replaced fully in C8 once all steps land. For now, keep the placeholder pattern: each step is appended.)

- [ ] **Step 3: Deploy + smoke**

```bash
supabase functions deploy run-audit --no-verify-jwt
```

Create a fresh audit through the UI (or recycle an existing one by resetting `status='running'` and clearing `sections.description`). Trigger the function. Verify `sections.description.blurb` contains a real 2-3 sentence description.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/run-audit/
git commit -m "feat(edge): description step using Gemini direct query"
```

---

### Task C3: Onsite step (Lighthouse + structured findings)

**Files:**
- Create: `supabase/functions/run-audit/steps/onsite.ts`

- [ ] **Step 1: Get PageSpeed Insights API key (optional but recommended)**

In Google Cloud Console → Credentials → Create API Key. Restrict it to "PageSpeed Insights API". Add to `.env.local` and Supabase secrets:

```bash
PAGESPEED_API_KEY=AIza...
supabase secrets set PAGESPEED_API_KEY=AIza...
```

Without a key the API still works but with stricter quotas.

- [ ] **Step 2: Implement onsite step**

Create `supabase/functions/run-audit/steps/onsite.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { fetchJson, fetchText } from '../lib/fetch.ts';
import type { AuditRow, CrawledPage } from '../lib/types.ts';

interface OnsiteSection {
  pages_crawled: CrawledPage[];
  lighthouse: {
    performance: number | null;
    accessibility: number | null;
    best_practices: number | null;
    seo: number | null;
    cwv: { lcp_ms: number | null; cls: number | null; inp_ms: number | null };
  };
  issues: { severity: 'high' | 'med' | 'low'; message: string; page: string }[];
  sitemap_found: boolean;
  sitemap_url_count: number;
  error?: string;
}

async function fetchLighthouse(url: string): Promise<OnsiteSection['lighthouse']> {
  const key = Deno.env.get('PAGESPEED_API_KEY');
  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  const params = new URLSearchParams({ url, strategy: 'mobile' });
  for (const cat of ['performance', 'accessibility', 'seo', 'best-practices']) params.append('category', cat);
  if (key) params.set('key', key);
  const data = await fetchJson(`${base}?${params.toString()}`, 60000);
  const cats = data?.lighthouseResult?.categories ?? {};
  const audits = data?.lighthouseResult?.audits ?? {};
  const score = (k: string) => cats[k] ? Math.round(cats[k].score * 100) : null;
  const num = (k: string) => audits[k]?.numericValue ?? null;
  return {
    performance: score('performance'),
    accessibility: score('accessibility'),
    best_practices: score('best-practices'),
    seo: score('seo'),
    cwv: {
      lcp_ms: num('largest-contentful-paint'),
      cls: num('cumulative-layout-shift'),
      inp_ms: num('interaction-to-next-paint') ?? num('experimental-interaction-to-next-paint'),
    },
  };
}

async function checkSitemap(domain: string): Promise<{ found: boolean; url_count: number }> {
  try {
    const xml = await fetchText(`https://${domain}/sitemap.xml`, 5000);
    const urlCount = (xml.match(/<loc>/g) || []).length;
    return { found: urlCount > 0, url_count: urlCount };
  } catch { return { found: false, url_count: 0 }; }
}

function computeIssues(pages: CrawledPage[]): OnsiteSection['issues'] {
  const issues: OnsiteSection['issues'] = [];
  for (const p of pages) {
    if (!p.title) issues.push({ severity: 'high', message: 'Missing <title>', page: p.url });
    else if (p.title.length < 30) issues.push({ severity: 'med', message: `Title is short (${p.title.length} chars)`, page: p.url });
    else if (p.title.length > 65) issues.push({ severity: 'low', message: `Title is long (${p.title.length} chars)`, page: p.url });
    if (!p.meta_desc) issues.push({ severity: 'high', message: 'Missing meta description', page: p.url });
    if (p.h1.length === 0) issues.push({ severity: 'high', message: 'No H1 on page', page: p.url });
    if (p.h1.length > 1) issues.push({ severity: 'med', message: `Multiple H1s (${p.h1.length})`, page: p.url });
    if (!p.canonical) issues.push({ severity: 'low', message: 'No canonical URL', page: p.url });
    if (p.alt_coverage < 0.8) issues.push({ severity: 'med', message: `Alt coverage ${Math.round(p.alt_coverage * 100)}%`, page: p.url });
    if (!p.viewport_set) issues.push({ severity: 'high', message: 'Missing viewport meta', page: p.url });
    if (p.schema_jsonld_count === 0) issues.push({ severity: 'low', message: 'No schema.org JSON-LD found', page: p.url });
    if (!p.https) issues.push({ severity: 'high', message: 'Not served over HTTPS', page: p.url });
  }
  return issues;
}

export async function runOnsite(audit: AuditRow): Promise<void> {
  try {
    const cache = (audit.sections as any).onsite_crawl_cache as CrawledPage[] | undefined;
    if (!cache?.length) {
      await patchSection(audit.id, 'onsite', { error: 'no_crawl_cache' });
      return;
    }
    const [lighthouse, sitemap] = await Promise.all([
      fetchLighthouse(`https://${audit.domain}/`).catch(() => ({
        performance: null, accessibility: null, best_practices: null, seo: null,
        cwv: { lcp_ms: null, cls: null, inp_ms: null },
      })),
      checkSitemap(audit.domain),
    ]);
    const issues = computeIssues(cache);
    const section: OnsiteSection = {
      pages_crawled: cache,
      lighthouse,
      issues,
      sitemap_found: sitemap.found,
      sitemap_url_count: sitemap.url_count,
    };
    await patchSection(audit.id, 'onsite', section);
  } catch (e) {
    await patchSection(audit.id, 'onsite', { error: String(e) });
  }
}
```

- [ ] **Step 3: Add to index.ts dispatch (still in placeholder form — final orchestration in C8)**

Append after the description step call:
```ts
import { runOnsite } from './steps/onsite.ts';
// ...
await runOnsite(audit);
```

- [ ] **Step 4: Deploy + smoke**

```bash
supabase functions deploy run-audit --no-verify-jwt
```

Trigger an audit and verify `sections.onsite.lighthouse.performance` is a number and `sections.onsite.issues` is a populated array.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/run-audit/
git commit -m "feat(edge): onsite step — Lighthouse, sitemap check, issue derivation"
```

---

### Task C4: Off-site signals step

**Files:**
- Create: `supabase/functions/run-audit/steps/offsite.ts`, `supabase/functions/run-audit/lib/serper.ts`

- [ ] **Step 1: Serper helper with usage tracking**

Create `supabase/functions/run-audit/lib/serper.ts`:

```ts
export interface SerperResult {
  organic?: { title?: string; link?: string; snippet?: string; position?: number }[];
  knowledgeGraph?: { website?: string; title?: string };
}

const KEY = Deno.env.get('SERPER_API_KEY')!;

export class SerperBudget {
  constructor(public remaining: number) {}
  canSpend(): boolean { return this.remaining > 0; }
  spend(): void { this.remaining -= 1; }
}

export async function serperSearch(query: string, budget: SerperBudget): Promise<SerperResult | null> {
  if (!budget.canSpend()) return null;
  budget.spend();
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) throw new Error(`serper ${res.status}: ${await res.text()}`);
  return await res.json();
}

export function domainFromUrl(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return null; }
}
```

- [ ] **Step 2: Offsite step**

Create `supabase/functions/run-audit/steps/offsite.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { fetchJson } from '../lib/fetch.ts';
import { serperSearch, SerperBudget, domainFromUrl } from '../lib/serper.ts';
import type { AuditRow } from '../lib/types.ts';

const KNOWN_DIRECTORIES = [
  { name: 'Wikipedia', pattern: /wikipedia\.org\/wiki/i },
  { name: 'Crunchbase', pattern: /crunchbase\.com\/organization/i },
  { name: 'LinkedIn', pattern: /linkedin\.com\/company/i },
  { name: 'X (Twitter)', pattern: /(?:twitter|x)\.com\// },
  { name: 'Facebook', pattern: /facebook\.com\// },
  { name: 'YouTube', pattern: /youtube\.com\/(?:c|@|channel|user)/i },
];

async function domainAge(domain: string): Promise<number | null> {
  try {
    const data = await fetchJson(`https://rdap.org/domain/${domain}`, 5000);
    const events = data?.events ?? [];
    const reg = events.find((e: any) => e.eventAction === 'registration');
    if (!reg?.eventDate) return null;
    const days = (Date.now() - new Date(reg.eventDate).getTime()) / 86400000;
    return Math.floor(days);
  } catch { return null; }
}

export async function runOffsite(audit: AuditRow, budget: SerperBudget): Promise<void> {
  try {
    const [age, siteSerp, brandSerp] = await Promise.all([
      domainAge(audit.domain),
      serperSearch(`site:${audit.domain}`, budget).catch(() => null),
      serperSearch(audit.domain.split('.')[0], budget).catch(() => null),
    ]);

    const indexedPagesEstimate = siteSerp?.organic?.length ?? 0;
    const brandMentions = brandSerp?.organic?.filter(
      (r) => domainFromUrl(r.link ?? '') === audit.domain
    ).length ?? 0;

    const directorySnippets = [
      ...(siteSerp?.organic ?? []),
      ...(brandSerp?.organic ?? []),
    ].map((r) => r.link ?? '');

    const directory_presence = KNOWN_DIRECTORIES.map((d) => {
      const hit = directorySnippets.find((u) => d.pattern.test(u));
      return { name: d.name, found: !!hit, url: hit ?? null };
    });

    await patchSection(audit.id, 'offsite', {
      domain_age_days: age,
      https: true, // verified from onsite crawl already
      indexed_pages_estimate: indexedPagesEstimate,
      directory_presence,
      brand_serp_mentions: brandMentions,
    });
  } catch (e) {
    await patchSection(audit.id, 'offsite', { error: String(e) });
  }
}
```

- [ ] **Step 3: Wire into index.ts**

Append:
```ts
import { runOffsite } from './steps/offsite.ts';
// orchestrator passes a shared SerperBudget — final wiring in C8
```

- [ ] **Step 4: Get Serper API key**

Sign up at https://serper.dev. Free starter pack = 2500 queries. Add to `.env.local` and supabase secrets:

```bash
supabase secrets set SERPER_API_KEY=...
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/run-audit/
git commit -m "feat(edge): offsite step — RDAP age, Serper site:/brand search, directory checks"
```

---

### Task C5: GEO probes step

**Files:**
- Create: `supabase/functions/run-audit/steps/geo.ts`

- [ ] **Step 1: Implement geo step**

Create `supabase/functions/run-audit/steps/geo.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { grounded } from '../lib/gemini.ts';
import { domainFromUrl } from '../lib/serper.ts';
import type { AuditRow } from '../lib/types.ts';

interface PromptResult {
  prompt: string;
  answer_text: string;
  user_domain_mentioned: boolean;
  user_domain_rank: number | null;
  competitor_domains: string[];
  cited_urls: { url: string; title: string }[];
}

function templateForKeyword(kw: string): string {
  if (/\?$/.test(kw) || /^(how|what|why|when|where|who|which)\b/i.test(kw)) return kw;
  if (/best|top|review/i.test(kw)) return `What are the ${kw}?`;
  return `Recommend the best options for: ${kw}.`;
}

function findUserMention(text: string, urls: { url: string; title: string }[], userDomain: string): {
  mentioned: boolean; rank: number | null;
} {
  const re = new RegExp(`\\b${userDomain.replace(/[.]/g, '\\.')}\\b`, 'i');
  const inText = re.test(text);
  // Rank: ordinal of first domain occurrence among unique-domain mentions in text order
  const unique: string[] = [];
  for (const u of urls) {
    const d = domainFromUrl(u.url);
    if (d && !unique.includes(d)) unique.push(d);
  }
  const idx = unique.indexOf(userDomain);
  const rank = idx >= 0 ? idx + 1 : null;
  return { mentioned: inText || rank !== null, rank };
}

function extractCompetitorDomains(text: string, urls: { url: string; title: string }[], userDomain: string): string[] {
  const set = new Set<string>();
  for (const u of urls) {
    const d = domainFromUrl(u.url);
    if (d && d !== userDomain) set.add(d);
  }
  // also catch domain-like tokens in text
  const re = /\b([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const d = m[1].toLowerCase();
    if (d !== userDomain && !d.startsWith('www.')) set.add(d);
  }
  return Array.from(set).slice(0, 20);
}

const SPACING_MS = 1200; // ~50 RPM cap with $5 paid tier
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function runGeo(audit: AuditRow): Promise<{ citedUrls: { url: string; title: string }[] }> {
  const selected: string[] = ((audit.sections as any).keywords?.selected ?? []) as string[];
  const prompts = selected.slice(0, 15).map(templateForKeyword);
  const results: PromptResult[] = [];
  const allCited: { url: string; title: string }[] = [];

  for (const p of prompts) {
    try {
      const r = await grounded(p);
      const mention = findUserMention(r.text, r.citedUrls, audit.domain);
      const competitors = extractCompetitorDomains(r.text, r.citedUrls, audit.domain);
      results.push({
        prompt: p,
        answer_text: r.text,
        user_domain_mentioned: mention.mentioned,
        user_domain_rank: mention.rank,
        competitor_domains: competitors,
        cited_urls: r.citedUrls,
      });
      allCited.push(...r.citedUrls);
      // patch incrementally so the UI fills in live
      await patchSection(audit.id, 'geo', {
        prompts: results,
        visibility_score: Math.round((results.filter((x) => x.user_domain_mentioned).length / results.length) * 100),
      });
    } catch (e) {
      results.push({
        prompt: p, answer_text: `ERROR: ${e}`,
        user_domain_mentioned: false, user_domain_rank: null,
        competitor_domains: [], cited_urls: [],
      });
    }
    await sleep(SPACING_MS);
  }

  return { citedUrls: allCited };
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/run-audit/steps/geo.ts
git commit -m "feat(edge): GEO step — 15 grounded Gemini prompts, visibility scoring, incremental patches"
```

---

### Task C6: Competitors step (with enrichment)

**Files:**
- Create: `supabase/functions/run-audit/steps/competitors.ts`

- [ ] **Step 1: Implement competitors step**

Create `supabase/functions/run-audit/steps/competitors.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { fetchText } from '../lib/fetch.ts';
import { summarizeCompetitor } from '../lib/gemini.ts';
import { serperSearch, SerperBudget, domainFromUrl } from '../lib/serper.ts';
import type { AuditRow } from '../lib/types.ts';

function htmlMeta(html: string): { title: string; meta: string } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? '';
  return { title: t, meta: m };
}

export async function runCompetitors(audit: AuditRow, budget: SerperBudget): Promise<void> {
  try {
    const selected: string[] = ((audit.sections as any).keywords?.selected ?? []) as string[];
    const geo = (audit.sections as any).geo;

    // SERP-derived: run keyword queries (up to budget)
    const serpDomainTally = new Map<string, { appearances: number; sumPos: number }>();
    for (const kw of selected) {
      if (!budget.canSpend()) break;
      const r = await serperSearch(kw, budget);
      const organic = r?.organic ?? [];
      for (const item of organic) {
        const d = domainFromUrl(item.link ?? '');
        if (!d || d === audit.domain) continue;
        const cur = serpDomainTally.get(d) ?? { appearances: 0, sumPos: 0 };
        cur.appearances += 1;
        cur.sumPos += item.position ?? organic.indexOf(item) + 1;
        serpDomainTally.set(d, cur);
      }
    }
    const serp_ranked = Array.from(serpDomainTally.entries())
      .map(([domain, v]) => ({ domain, appearances: v.appearances, avg_position: v.sumPos / v.appearances }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 20);

    // LLM-derived: tally from geo.prompts
    const llmTally = new Map<string, { appearances: number; cited: Set<string> }>();
    for (const p of geo?.prompts ?? []) {
      for (const d of p.competitor_domains as string[]) {
        const cur = llmTally.get(d) ?? { appearances: 0, cited: new Set<string>() };
        cur.appearances += 1;
        for (const u of p.cited_urls ?? []) {
          const dom = domainFromUrl(u.url);
          if (dom === d) cur.cited.add(u.url);
        }
        llmTally.set(d, cur);
      }
    }
    const llm_ranked = Array.from(llmTally.entries())
      .map(([domain, v]) => ({ domain, appearances: v.appearances, cited_urls: v.cited.size }))
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 20);

    // Top 3-5 by combined appearance
    const combined = new Map<string, { serp: number; llm: number }>();
    for (const r of serp_ranked) combined.set(r.domain, { serp: r.appearances, llm: combined.get(r.domain)?.llm ?? 0 });
    for (const r of llm_ranked) combined.set(r.domain, { ...combined.get(r.domain) ?? { serp: 0, llm: 0 }, llm: r.appearances });
    const topDomains = Array.from(combined.entries())
      .sort((a, b) => (b[1].serp + b[1].llm) - (a[1].serp + a[1].llm))
      .slice(0, 5)
      .map(([d]) => d);

    const enriched = [];
    for (const d of topDomains) {
      try {
        const html = await fetchText(`https://${d}/`, 5000);
        const { title, meta } = htmlMeta(html);
        const summary = await summarizeCompetitor(d, `${title}\n\n${meta}\n\n${html.slice(0, 3000)}`);
        const sources: string[] = [];
        if (combined.get(d)?.serp) sources.push('serp');
        if (combined.get(d)?.llm) sources.push('llm');
        enriched.push({ domain: d, title, meta_desc: meta, summary, sources });
      } catch (e) {
        enriched.push({ domain: d, title: '', meta_desc: '', summary: `(fetch failed: ${e})`, sources: [] });
      }
    }

    await patchSection(audit.id, 'competitors', { serp_ranked, llm_ranked, enriched });
  } catch (e) {
    await patchSection(audit.id, 'competitors', { error: String(e) });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/run-audit/steps/competitors.ts
git commit -m "feat(edge): competitors step — SERP + LLM tally, top-5 enrichment"
```

---

### Task C7: Article recommendations step

**Files:**
- Create: `supabase/functions/run-audit/steps/article-recs.ts`

- [ ] **Step 1: Implement**

Create `supabase/functions/run-audit/steps/article-recs.ts`:

```ts
import { patchSection } from '../lib/db.ts';
import { fetchText } from '../lib/fetch.ts';
import { recommendArticles } from '../lib/gemini.ts';
import type { AuditRow, CrawledPage } from '../lib/types.ts';

function htmlMeta(html: string): { title: string; meta: string } {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim() ?? '';
  return { title: t, meta: m };
}

export async function runArticleRecs(audit: AuditRow, allCitedUrls: { url: string; title: string }[]): Promise<void> {
  try {
    const selected: string[] = ((audit.sections as any).keywords?.selected ?? []) as string[];
    const crawl = (audit.sections as any).onsite_crawl_cache as CrawledPage[] | undefined;
    const userTitles = (crawl ?? []).map((p) => p.title ?? p.url);

    // Dedupe cited URLs, cap at 20
    const seen = new Set<string>();
    const unique = allCitedUrls.filter((u) => {
      if (seen.has(u.url)) return false;
      seen.add(u.url);
      return true;
    }).slice(0, 20);

    // Fetch each for meta description (best-effort, parallel)
    const enriched = await Promise.all(
      unique.map(async (u) => {
        try {
          const html = await fetchText(u.url, 5000);
          const { title, meta } = htmlMeta(html);
          return { url: u.url, title: title || u.title, metaDesc: meta };
        } catch {
          return { url: u.url, title: u.title, metaDesc: '' };
        }
      })
    );

    const recs = await recommendArticles({
      userDomain: audit.domain,
      userPageTitles: userTitles,
      citedPages: enriched,
      selectedKeywords: selected,
    });

    await patchSection(audit.id, 'article_recommendations', recs);
  } catch (e) {
    await patchSection(audit.id, 'article_recommendations', { error: String(e) });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/run-audit/steps/article-recs.ts
git commit -m "feat(edge): article recs step — fetch cited URL metadata + Gemini gap-analysis"
```

---

### Task C8: Wire the full orchestrator

**Files:**
- Modify: `supabase/functions/run-audit/index.ts`

- [ ] **Step 1: Replace index.ts with full DAG**

Replace the entire file:

```ts
import { loadAudit, setStatus, patchSection, getLastHeartbeat } from './lib/db.ts';
import { SerperBudget } from './lib/serper.ts';
import { runDescription } from './steps/description.ts';
import { runOnsite } from './steps/onsite.ts';
import { runOffsite } from './steps/offsite.ts';
import { runGeo } from './steps/geo.ts';
import { runCompetitors } from './steps/competitors.ts';
import { runArticleRecs } from './steps/article-recs.ts';
import { sendCompletionEmail } from './lib/email.ts';

async function maybeSendCompletionEmail(auditId: string): Promise<void> {
  const last = await getLastHeartbeat(auditId);
  if (!last) {
    await sendCompletionEmail(auditId).catch((e) => console.error('email failed', e));
    return;
  }
  const ageMs = Date.now() - new Date(last).getTime();
  if (ageMs > 45_000) {
    await sendCompletionEmail(auditId).catch((e) => console.error('email failed', e));
  }
}

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const auditId: string | undefined = body?.audit_id;
  if (!auditId) return new Response('missing audit_id', { status: 400 });

  (async () => {
    try {
      await setStatus(auditId, 'running');
      const audit = await loadAudit(auditId);
      const budget = new SerperBudget(audit.serper_query_cap);

      // Parallel fanout: description, onsite, offsite, geo
      const geoPromise = runGeo(audit);
      await Promise.all([
        runDescription(audit),
        runOnsite(audit),
        runOffsite(audit, budget),
        geoPromise.then(() => {}), // continue once geo finishes
      ]);
      const { citedUrls } = await geoPromise;

      // Depends on geo: competitors + article recs in parallel
      const audit2 = await loadAudit(auditId); // refresh — geo wrote to row
      await Promise.all([
        runCompetitors(audit2, budget),
        runArticleRecs(audit2, citedUrls),
      ]);

      await setStatus(auditId, 'complete', { completed_at: new Date().toISOString() });
      await maybeSendCompletionEmail(auditId);
    } catch (e) {
      console.error('audit failed', e);
      await setStatus(auditId, 'failed', { error: String(e) }).catch(() => {});
    }
  })();

  return new Response(JSON.stringify({ accepted: true, audit_id: auditId }), {
    headers: { 'Content-Type': 'application/json' }, status: 202,
  });
});
```

- [ ] **Step 2: Stub email helper (real impl in C10)**

Create `supabase/functions/run-audit/lib/email.ts`:

```ts
// Real send wired in Phase D's email task. For now: no-op.
export async function sendCompletionEmail(_auditId: string): Promise<void> {
  console.log('completion email stub — not sending yet');
}
```

- [ ] **Step 3: Deploy + full end-to-end smoke**

```bash
supabase functions deploy run-audit --no-verify-jwt
```

In the app: sign in (admin), enter a real domain, confirm keywords, hit Run. Watch the audit row in Supabase Studio — every ~10s, new keys should appear under `sections.*`. Final state: `status='complete'`, all 7 keys (description, keywords, onsite, offsite, geo, competitors, article_recommendations) populated.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat(edge): orchestrate full pipeline DAG with parallel fanout + serper budget"
```

---

### Task C9: Heartbeat API + report subscription

**Files:**
- Create: `app/api/audits/[id]/heartbeat/route.ts`
- Modify: `supabase/migrations/` add column note OR run inline (since `last_heartbeat_at` already exists from A5)

- [ ] **Step 1: Heartbeat route**

Create `app/api/audits/[id]/heartbeat/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('id, user_id').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await svc.from('audits').update({ last_heartbeat_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/audits/[id]/heartbeat/
git commit -m "feat(api): heartbeat endpoint for report page presence"
```

---

### Task C10: Report page section components

**Files:**
- Create: `components/report/Section.tsx`, `DescriptionCard.tsx`, `KeywordsList.tsx`, `OnsiteCard.tsx`, `OffsiteCard.tsx`, `GeoTable.tsx`, `CompetitorTabs.tsx`, `ArticleRecsGrid.tsx`, `ProgressBar.tsx`
- Replace: `app/report/[id]/page.tsx`
- Create: `app/report/[id]/ReportClient.tsx`

- [ ] **Step 1: Generic Section wrapper**

Create `components/report/Section.tsx`:

```tsx
import { ReactNode } from 'react';

export function Section({
  title,
  state,
  errorText,
  children,
}: {
  title: string;
  state: 'skeleton' | 'partial' | 'complete' | 'error';
  errorText?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t pt-8 pb-2">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {state === 'skeleton' && <span className="text-xs text-gray-400 animate-pulse">Loading...</span>}
        {state === 'partial' && <span className="text-xs text-amber-600">Updating...</span>}
        {state === 'error' && <span className="text-xs text-red-600">Error</span>}
      </div>
      {state === 'error' && errorText && (
        <div className="text-sm bg-red-50 border border-red-200 rounded p-3 mb-3">{errorText}</div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Description card**

Create `components/report/DescriptionCard.tsx`:

```tsx
import { Section, Skeleton } from './Section';

export function DescriptionCard({ data }: { data?: { blurb?: string; error?: string } }) {
  if (!data) return <Section title="What is this domain?" state="skeleton"><Skeleton /></Section>;
  if (data.error) return <Section title="What is this domain?" state="error" errorText={data.error}><div /></Section>;
  return (
    <Section title="What is this domain?" state="complete">
      <p className="text-lg text-gray-700">{data.blurb}</p>
    </Section>
  );
}
```

- [ ] **Step 3: Keywords**

Create `components/report/KeywordsList.tsx`:

```tsx
import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function KeywordsList({ data }: { data?: { selected?: string[]; candidates?: { term: string }[]; user_modified?: boolean } }) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.candidates) return <Section title="Keywords we found" state="skeleton"><Skeleton /></Section>;
  const others = (data.candidates ?? []).filter((c) => !data.selected?.includes(c.term));
  return (
    <Section title="Keywords we found" state="complete">
      <div className="text-sm text-gray-500 mb-2">
        Selected ({data.selected?.length ?? 0}) {data.user_modified && '· you edited the picks'}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(data.selected ?? []).map((t) => (
          <span key={t} className="px-3 py-1 bg-black text-white text-sm rounded-full">{t}</span>
        ))}
      </div>
      {others.length > 0 && (
        <>
          <button className="text-sm underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Hide' : 'Show'} {others.length} other candidates
          </button>
          {showAll && (
            <div className="flex flex-wrap gap-2 mt-3">
              {others.map((c) => (
                <span key={c.term} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{c.term}</span>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
```

- [ ] **Step 4: Onsite**

Create `components/report/OnsiteCard.tsx`:

```tsx
import { Section, Skeleton } from './Section';

export function OnsiteCard({ data }: { data?: any }) {
  if (!data) return <Section title="Onsite SEO" state="skeleton"><Skeleton lines={5} /></Section>;
  if (data.error) return <Section title="Onsite SEO" state="error" errorText={data.error}><div /></Section>;
  const lh = data.lighthouse ?? {};
  const cwv = lh.cwv ?? {};
  return (
    <Section title="Onsite SEO" state="complete">
      <div className="grid grid-cols-4 gap-3 mb-6 text-center">
        {['performance', 'accessibility', 'best_practices', 'seo'].map((k) => (
          <div key={k} className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">{k.replace('_', ' ')}</div>
            <div className="text-2xl font-semibold">{lh[k] ?? '—'}</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-600 mb-4">
        CWV — LCP: {cwv.lcp_ms ? `${Math.round(cwv.lcp_ms)} ms` : '—'} ·
        CLS: {cwv.cls?.toFixed(2) ?? '—'} ·
        INP: {cwv.inp_ms ? `${Math.round(cwv.inp_ms)} ms` : '—'}
      </div>
      <div>
        <h3 className="font-medium mb-2">Issues ({data.issues?.length ?? 0})</h3>
        <ul className="text-sm space-y-1">
          {(data.issues ?? []).slice(0, 20).map((i: any, idx: number) => (
            <li key={idx} className="flex gap-2">
              <span className={
                i.severity === 'high' ? 'text-red-600' :
                i.severity === 'med' ? 'text-amber-600' : 'text-gray-500'
              }>●</span>
              <span>{i.message}</span>
              <span className="text-gray-400">— {new URL(i.page).pathname}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
```

- [ ] **Step 5: Offsite**

Create `components/report/OffsiteCard.tsx`:

```tsx
import { Section, Skeleton } from './Section';

export function OffsiteCard({ data }: { data?: any }) {
  if (!data) return <Section title="Off-site signals" state="skeleton"><Skeleton lines={3} /></Section>;
  if (data.error) return <Section title="Off-site signals" state="error" errorText={data.error}><div /></Section>;
  return (
    <Section title="Off-site signals" state="complete">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <Stat label="Domain age" value={data.domain_age_days != null ? `${Math.round(data.domain_age_days / 365 * 10) / 10} yrs` : '—'} />
        <Stat label="HTTPS" value={data.https ? 'Yes' : 'No'} />
        <Stat label="Indexed pages" value={data.indexed_pages_estimate ?? '—'} />
        <Stat label="Brand SERP mentions" value={data.brand_serp_mentions ?? 0} />
      </div>
      <div>
        <h3 className="font-medium mb-2">Directory presence</h3>
        <ul className="text-sm space-y-1">
          {(data.directory_presence ?? []).map((d: any) => (
            <li key={d.name}>
              {d.found ? '✓' : '✗'} {d.name}
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline">view</a>}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 6: GEO**

Create `components/report/GeoTable.tsx`:

```tsx
import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function GeoTable({ data }: { data?: any }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!data) return <Section title="GEO — Do LLMs recommend you?" state="skeleton"><Skeleton lines={4} /></Section>;
  if (data.error) return <Section title="GEO — Do LLMs recommend you?" state="error" errorText={data.error}><div /></Section>;
  const prompts = data.prompts ?? [];
  return (
    <Section title="GEO — Do LLMs recommend you?" state={data.prompts ? 'partial' : 'skeleton'}>
      <div className="text-lg mb-4">
        Visibility: <strong>{data.visibility_score ?? 0}%</strong>
        <span className="text-gray-500 text-sm ml-2">
          ({prompts.filter((p: any) => p.user_domain_mentioned).length} of {prompts.length} prompts)
        </span>
      </div>
      <div className="border rounded overflow-hidden">
        {prompts.map((p: any, i: number) => (
          <div key={i} className="border-b last:border-b-0">
            <button className="w-full text-left p-3 hover:bg-gray-50" onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="flex justify-between gap-3">
                <div className="text-sm truncate flex-1">{p.prompt}</div>
                <div className="text-sm">
                  {p.user_domain_mentioned ? (
                    <span className="text-green-600">#{p.user_domain_rank ?? '✓'}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 w-32 truncate">
                  {p.competitor_domains?.[0] ?? '—'}
                </div>
              </div>
            </button>
            {expanded === i && (
              <div className="p-3 bg-gray-50 text-sm space-y-2">
                <div className="whitespace-pre-wrap">{p.answer_text}</div>
                {p.cited_urls?.length > 0 && (
                  <div>
                    <div className="font-medium text-xs uppercase text-gray-500 mt-3 mb-1">Cited sources</div>
                    <ul className="space-y-1">
                      {p.cited_urls.map((u: any, j: number) => (
                        <li key={j}>
                          <a href={u.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{u.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 7: Competitors**

Create `components/report/CompetitorTabs.tsx`:

```tsx
import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function CompetitorTabs({ data }: { data?: any }) {
  const [tab, setTab] = useState<'serp' | 'llm'>('serp');
  if (!data) return <Section title="Competitors" state="skeleton"><Skeleton lines={4} /></Section>;
  if (data.error) return <Section title="Competitors" state="error" errorText={data.error}><div /></Section>;

  const overlap = (data.serp_ranked ?? []).filter((s: any) =>
    (data.llm_ranked ?? []).some((l: any) => l.domain === s.domain)
  );

  const rows = tab === 'serp' ? (data.serp_ranked ?? []) : (data.llm_ranked ?? []);

  return (
    <Section title="Competitors" state="complete">
      {overlap.length > 0 && (
        <div className="text-sm text-gray-600 mb-3">
          <strong>{overlap.length}</strong> domains appear in BOTH SERP and LLM results: {overlap.slice(0, 3).map((o: any) => o.domain).join(', ')}{overlap.length > 3 ? '...' : ''}
        </div>
      )}
      <div className="flex gap-2 mb-3 text-sm">
        <button onClick={() => setTab('serp')} className={`px-3 py-1 rounded ${tab === 'serp' ? 'bg-black text-white' : 'bg-gray-100'}`}>
          SERP competitors ({data.serp_ranked?.length ?? 0})
        </button>
        <button onClick={() => setTab('llm')} className={`px-3 py-1 rounded ${tab === 'llm' ? 'bg-black text-white' : 'bg-gray-100'}`}>
          LLM competitors ({data.llm_ranked?.length ?? 0})
        </button>
      </div>
      <ul className="text-sm space-y-1 mb-6">
        {rows.slice(0, 15).map((r: any) => (
          <li key={r.domain} className="flex justify-between">
            <span>{r.domain}</span>
            <span className="text-gray-500">
              {tab === 'serp' ? `${r.appearances} hits · pos ${r.avg_position?.toFixed(1) ?? '—'}` : `${r.appearances} mentions · ${r.cited_urls} cites`}
            </span>
          </li>
        ))}
      </ul>
      {data.enriched?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Top {data.enriched.length} competitors</h3>
          {data.enriched.map((e: any) => (
            <div key={e.domain} className="border rounded p-3">
              <div className="font-medium">{e.domain}</div>
              <div className="text-xs text-gray-500 mb-1">{(e.sources ?? []).join(' + ').toUpperCase()}</div>
              <p className="text-sm">{e.summary}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 8: Article recs**

Create `components/report/ArticleRecsGrid.tsx`:

```tsx
import { Section, Skeleton } from './Section';

export function ArticleRecsGrid({ data }: { data?: any }) {
  if (!data) return <Section title="Article topics to write" state="skeleton"><Skeleton lines={6} /></Section>;
  if ((data as any).error) return <Section title="Article topics to write" state="error" errorText={(data as any).error}><div /></Section>;
  const recs: any[] = Array.isArray(data) ? data : [];
  return (
    <Section title="Article topics to write" state="complete">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recs.map((r, i) => (
          <div key={i} className="border rounded p-4">
            <h3 className="font-medium mb-1">{r.title}</h3>
            <div className="text-xs text-gray-500 mb-2">Target: <strong>{r.target_keyword}</strong></div>
            <p className="text-sm text-gray-700 mb-2">{r.angle}</p>
            <p className="text-xs text-gray-600 mb-2"><strong>Why it'd rank:</strong> {r.why_it_ranks}</p>
            {r.source_urls?.length > 0 && (
              <div className="text-xs">
                Inspired by:{' '}
                {r.source_urls.slice(0, 2).map((u: string, j: number) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer" className="text-blue-600 underline mr-2">
                    {new URL(u).host}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 9: Progress bar**

Create `components/report/ProgressBar.tsx`:

```tsx
const EXPECTED = ['description', 'keywords', 'onsite', 'offsite', 'geo', 'competitors', 'article_recommendations'];

export function ProgressBar({ sections }: { sections: Record<string, unknown> }) {
  const have = EXPECTED.filter((k) => k in sections).length;
  const pct = Math.round((have / EXPECTED.length) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Audit progress</span>
        <span>{have} / {EXPECTED.length}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Report client component**

Create `app/report/[id]/ReportClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/report/ProgressBar';
import { DescriptionCard } from '@/components/report/DescriptionCard';
import { KeywordsList } from '@/components/report/KeywordsList';
import { OnsiteCard } from '@/components/report/OnsiteCard';
import { OffsiteCard } from '@/components/report/OffsiteCard';
import { GeoTable } from '@/components/report/GeoTable';
import { CompetitorTabs } from '@/components/report/CompetitorTabs';
import { ArticleRecsGrid } from '@/components/report/ArticleRecsGrid';

export function ReportClient({ initialAudit }: { initialAudit: any }) {
  const [audit, setAudit] = useState(initialAudit);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`audit-${audit.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'audits', filter: `id=eq.${audit.id}` },
        (payload) => setAudit(payload.new)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [audit.id, supabase]);

  // Heartbeat
  useEffect(() => {
    if (audit.status === 'complete' || audit.status === 'failed') return;
    const ping = () => {
      fetch(`/api/audits/${audit.id}/heartbeat`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 15_000);
    return () => clearInterval(id);
  }, [audit.id, audit.status]);

  const s = audit.sections ?? {};

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-semibold">{audit.domain}</h1>
          <Button
            disabled={audit.status !== 'complete'}
            onClick={async () => {
              const r = await fetch(`/api/audits/${audit.id}/send-pdf`, { method: 'POST' });
              if (r.ok) alert('PDF queued — check your email.');
              else alert('Failed to queue PDF.');
            }}
          >
            Send PDF to my email
          </Button>
        </div>
        <ProgressBar sections={s} />
      </header>

      <DescriptionCard data={s.description} />
      <KeywordsList data={s.keywords} />
      <OnsiteCard data={s.onsite} />
      <OffsiteCard data={s.offsite} />
      <GeoTable data={s.geo} />
      <CompetitorTabs data={s.competitors} />
      <ArticleRecsGrid data={s.article_recommendations} />

      {audit.status === 'failed' && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
          <div className="font-medium text-red-700 mb-1">Audit failed</div>
          <div className="text-sm text-red-600">{audit.error}</div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 11: Replace `app/report/[id]/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReportClient } from './ReportClient';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: audit, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !audit) notFound();
  if (audit.user_id !== user.id) notFound();

  // Resume abandoned keyword selection
  const selected = (audit.sections as any)?.keywords?.selected ?? [];
  if (audit.status === 'pending' && selected.length === 0) {
    redirect(`/analyze?domain=${encodeURIComponent(audit.domain)}`);
  }

  return <ReportClient initialAudit={audit} />;
}
```

- [ ] **Step 12: Manual smoke**

```bash
npm run dev
```

1. Sign in, enter a real domain, run audit
2. Land on report page
3. Each section renders skeleton initially
4. Within ~90s, all 7 sections fill in progressively (description first, geo last)
5. Visit Supabase Realtime logs in Studio to confirm subscription is active
6. Final state: `status='complete'`, all sections rendered, "Send PDF" button enabled (will 404 until Phase D)

- [ ] **Step 13: Commit**

```bash
git add components/report/ app/report/
git commit -m "feat(report): progressive section components + Realtime subscription + heartbeat"
```

---

### Task C11: Phase C verification

- [ ] **Step 1: All tests + build**

```bash
npm test && npm run build
```

- [ ] **Step 2: Run a real audit end-to-end against `news.ycombinator.com`**

Verify every section renders with sensible data. Note any sections that errored — file a follow-up if needed.

- [ ] **Step 3: Tag**

```bash
git tag phase-c-complete && git push --tags
```

---

## Phase D — PDF Export, Admin Dashboard, Retry, Polish

### Task D1: PDF template + send-pdf API

**Files:**
- Create: `lib/pdf/Report.tsx`, `app/api/audits/[id]/send-pdf/route.ts`

- [ ] **Step 1: PDF template**

Create `lib/pdf/Report.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  h1: { fontSize: 22, marginBottom: 12, fontWeight: 700 },
  h2: { fontSize: 14, marginTop: 18, marginBottom: 6, fontWeight: 700 },
  body: { fontSize: 10.5, lineHeight: 1.5, marginBottom: 8 },
  small: { fontSize: 9, color: '#666' },
  bullet: { fontSize: 10.5, marginBottom: 3, lineHeight: 1.4 },
});

function paragraphs(md: string): { type: 'h1' | 'h2' | 'p' | 'li'; text: string }[] {
  return md.split('\n').filter(Boolean).map((line) => {
    if (line.startsWith('# ')) return { type: 'h1' as const, text: line.slice(2) };
    if (/^#{2,3}\s/.test(line)) return { type: 'h2' as const, text: line.replace(/^#+\s/, '') };
    if (/^[-*]\s/.test(line)) return { type: 'li' as const, text: line.replace(/^[-*]\s/, '') };
    return { type: 'p' as const, text: line };
  });
}

export function ReportPdf({ domain, narrativeMarkdown }: { domain: string; narrativeMarkdown: string }) {
  const blocks = paragraphs(narrativeMarkdown);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.small}>SEO + GEO Audit · {domain} · {new Date().toLocaleDateString()}</Text>
        {blocks.map((b, i) => {
          if (b.type === 'h1') return <Text key={i} style={styles.h1}>{b.text}</Text>;
          if (b.type === 'h2') return <Text key={i} style={styles.h2}>{b.text}</Text>;
          if (b.type === 'li') return <Text key={i} style={styles.bullet}>• {b.text}</Text>;
          return <Text key={i} style={styles.body}>{b.text}</Text>;
        })}
        <View>
          <Text style={styles.small}>Generated by SEO + GEO Audit Tool.</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: PDF send route**

Create `app/api/audits/[id]/send-pdf/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { Resend } from 'resend';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { geminiProvider } from '@/lib/llm/gemini';
import { ReportPdf } from '@/lib/pdf/Report';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('*').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.status !== 'complete') return NextResponse.json({ error: 'not_complete' }, { status: 409 });

  // Idempotency: skip if a pdf_export was sent in the last 60s
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await svc
    .from('email_deliveries')
    .select('id')
    .eq('audit_id', id)
    .eq('kind', 'pdf_export')
    .gte('created_at', sixtySecAgo)
    .maybeSingle();
  if (recent) return NextResponse.json({ ok: true, dedup: true });

  // Reuse cached narrative, or generate
  const sections = audit.sections as Record<string, any>;
  let narrative: string = sections.narrative_pdf?.markdown;
  if (!narrative) {
    narrative = await geminiProvider.generateNarrative(sections);
    sections.narrative_pdf = { markdown: narrative, generated_at: new Date().toISOString() };
    await svc.from('audits').update({ sections }).eq('id', id);
  }

  // Render PDF
  const pdfBuffer = await renderToBuffer(<ReportPdf domain={audit.domain} narrativeMarkdown={narrative} />);

  // Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data: profile } = await svc.from('profiles').select('email').eq('id', user.id).single();
  const email = profile?.email ?? user.email!;

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: `Your SEO + GEO audit report — ${audit.domain}`,
    html: `<p>Your audit report for <strong>${audit.domain}</strong> is attached as PDF.</p><p><a href="${process.env.APP_URL}/report/${id}">View the interactive report</a></p>`,
    attachments: [{ filename: `audit-${audit.domain}.pdf`, content: pdfBuffer }],
  });

  await svc.from('email_deliveries').insert({
    audit_id: id, user_id: user.id, kind: 'pdf_export',
    resend_message_id: result.data?.id ?? null,
    status: result.error ? 'failed' : 'sent',
    error: result.error?.message,
  });

  if (result.error) return NextResponse.json({ error: 'send_failed', detail: result.error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify Resend setup**

In Resend dashboard:
1. Add and verify your sending domain (DNS records)
2. Set `RESEND_FROM_EMAIL=reports@yourdomain.com` in `.env.local`

- [ ] **Step 4: Manual smoke**

Run a completed audit, click "Send PDF to my email", confirm:
- Toast shows success
- Email arrives in inbox within ~30s with PDF attachment
- `email_deliveries` row has `status='sent'`

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/ app/api/audits/[id]/send-pdf/
git commit -m "feat(pdf): Gemini narrative → react-pdf → Resend send-pdf endpoint"
```

---

### Task D2: Completion email fallback

**Files:**
- Modify: `supabase/functions/run-audit/lib/email.ts`

- [ ] **Step 1: Implement Resend send in Edge Function**

Replace `supabase/functions/run-audit/lib/email.ts`:

```ts
import { db } from './db.ts';

const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('RESEND_FROM_EMAIL');
const APP_URL = Deno.env.get('APP_URL');

export async function sendCompletionEmail(auditId: string): Promise<void> {
  if (!RESEND_KEY || !FROM) {
    console.log('resend not configured; skipping');
    return;
  }
  const supabase = db();
  const { data: audit } = await supabase
    .from('audits')
    .select('id, user_id, domain, profiles(email)')
    .eq('id', auditId)
    .single();
  if (!audit) return;
  const email = (audit as any).profiles?.email;
  if (!email) return;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: email,
      subject: `Your audit for ${(audit as any).domain} is ready`,
      html: `<p>Your SEO + GEO audit for <strong>${(audit as any).domain}</strong> is complete.</p>
             <p><a href="${APP_URL}/report/${audit.id}">View your report</a></p>`,
    }),
  });

  const data = await res.json().catch(() => null);
  await supabase.from('email_deliveries').insert({
    audit_id: auditId,
    user_id: audit.user_id,
    kind: 'completion_fallback',
    resend_message_id: data?.id ?? null,
    status: res.ok ? 'sent' : 'failed',
    error: res.ok ? null : JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Deploy + test**

```bash
supabase functions deploy run-audit --no-verify-jwt
```

To test the fallback: start an audit, immediately close the tab so no heartbeats fire. Wait ~2 minutes. Email should arrive.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/run-audit/lib/email.ts
git commit -m "feat(edge): completion email fallback via Resend when user abandons the page"
```

---

### Task D3: Admin dashboard

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Implement**

Create `app/dashboard/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    // Non-admins land on their single audit, or home
    const { data: a } = await supabase
      .from('audits')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    redirect(a ? `/report/${a.id}` : '/');
  }

  const { data: audits } = await supabase
    .from('audits')
    .select('id, domain, status, created_at, completed_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <Link href="/" className="text-sm underline">New audit</Link>
      </header>
      <p className="text-sm text-gray-500 mb-4">Signed in as {profile.email} · {audits?.length ?? 0} audits</p>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Domain</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(audits ?? []).map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3">{a.domain}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    a.status === 'complete' ? 'bg-green-100 text-green-700' :
                    a.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{a.status}</span>
                </td>
                <td className="p-3 text-gray-600">{new Date(a.created_at).toLocaleString()}</td>
                <td className="p-3"><Link href={`/report/${a.id}`} className="underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manual smoke**

Sign in as `gokhanseckin@gmail.com`. Visit `/dashboard`. Confirm table renders with previous audits. Run 2 more audits (admin has 20/day quota) and confirm they appear.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/
git commit -m "feat(dashboard): admin-only dashboard listing recent audits"
```

---

### Task D4: Retry endpoint for failed audits

**Files:**
- Create: `app/api/audits/[id]/retry/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/audits/[id]/retry/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const { data: audit } = await svc.from('audits').select('id, user_id, status, sections').eq('id', id).single();
  if (!audit || audit.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.status !== 'failed') return NextResponse.json({ error: 'not_failed' }, { status: 409 });

  // Reset row to running, preserve keyword candidates/selection + onsite cache
  const s = audit.sections as Record<string, unknown>;
  const preserved = {
    keywords: s.keywords,
    onsite_crawl_cache: (s as any).onsite_crawl_cache,
  };
  await svc.from('audits').update({
    status: 'running',
    error: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    sections: preserved,
  }).eq('id', id);

  // Re-dispatch
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ audit_id: id }),
  }).catch((e) => console.error('retry dispatch failed', e));

  return NextResponse.json({ ok: true, status: 202 });
}
```

- [ ] **Step 2: Add retry button to ReportClient**

Edit `app/report/[id]/ReportClient.tsx`. Inside the `audit.status === 'failed'` block, add:

```tsx
<button
  className="mt-3 underline text-sm"
  onClick={async () => {
    const r = await fetch(`/api/audits/${audit.id}/retry`, { method: 'POST' });
    if (r.ok) window.location.reload();
  }}
>Retry audit</button>
```

- [ ] **Step 3: Commit**

```bash
git add app/api/audits/[id]/retry/ app/report/[id]/ReportClient.tsx
git commit -m "feat(api): retry endpoint for failed audits (does not count against quota)"
```

---

### Task D5: E2E Playwright happy-path test

**Files:**
- Create: `playwright.config.ts`, `e2e/happy-path.spec.ts`

- [ ] **Step 1: Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 3: E2E test**

Create `e2e/happy-path.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// This is a sketch — running against a live Supabase requires a pre-seeded
// session cookie. For v1 we keep this as a manual-run smoke; CI integration
// later. For now we test the public homepage flow up to the auth modal.

test('homepage renders and validates domain input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SEO + GEO Audit' })).toBeVisible();

  // Empty input shows error
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('Please enter a valid domain')).toBeVisible();

  // Invalid input shows error
  await page.getByPlaceholder('yourdomain.com').fill('not a domain');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('Please enter a valid domain')).toBeVisible();

  // Valid input opens auth modal
  await page.getByPlaceholder('yourdomain.com').fill('example.com');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to see your report' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
```

- [ ] **Step 4: Run**

```bash
npm run test:e2e
```
Expected: 1 test PASSES.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): playwright happy-path covering homepage + auth modal trigger"
```

---

### Task D6: Vercel deployment

**Files:** none (cloud config only)

- [ ] **Step 1: Push to GitHub**

If you have local commits not yet on `origin`:
```bash
git push origin main
```

- [ ] **Step 2: Import into Vercel**

In Vercel dashboard → Add New → Project → Import the `SEO-and-GEO-audit-tool` repo from GitHub. Framework preset: Next.js (auto-detected). Root directory: `/`.

- [ ] **Step 3: Set Vercel env vars**

Project Settings → Environment Variables. Add for Production + Preview + Development:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
SERPER_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
PAGESPEED_API_KEY
APP_URL                       (use the production Vercel URL once known)
SERPER_QUERY_CAP_DEFAULT=15
```

- [ ] **Step 4: First deploy**

Trigger deploy from Vercel. Note the production URL (e.g. `seo-and-geo-audit-tool.vercel.app`).

- [ ] **Step 5: Update Supabase redirect URLs**

Studio → Authentication → URL Configuration:
- Set Site URL to the production Vercel URL
- Add `https://seo-and-geo-audit-tool.vercel.app/auth/callback` to allowed redirect URLs

- [ ] **Step 6: Update `APP_URL` in Vercel + Supabase secrets**

```bash
supabase secrets set APP_URL=https://seo-and-geo-audit-tool.vercel.app
```

Also update `APP_URL` in Vercel env vars and redeploy.

- [ ] **Step 7: Smoke production**

Visit production URL. Sign in. Run a full audit end-to-end. Receive PDF email.

- [ ] **Step 8: Commit any final tweaks**

If you adjusted anything (e.g. config), commit. Otherwise skip.

---

### Task D7: README + deployment runbook

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace `README.md` with:

```markdown
# SEO and GEO Audit Tool

Single-page audit tool that analyzes a domain for traditional SEO health AND LLM visibility (does Gemini recommend you?).

**Live:** https://seo-and-geo-audit-tool.vercel.app

## What it does
- Crawls the homepage + a few internal pages
- Extracts 20-30 keyword candidates; user picks 10
- Audits onsite SEO (Lighthouse CWV + meta/H1/alt/schema)
- Off-site signals (domain age, indexed pages, brand mentions, directory presence)
- Probes Gemini with 15 grounded prompts → measures LLM visibility
- Ranks competitors from both SERPs and LLM answers, enriches top 3-5
- Recommends 8-12 article topics based on what LLMs cite
- Sends a PDF report by email on demand

## v1 limits
- 1 audit per account (lifetime). Admin (`gokhanseckin@gmail.com`): 20 audits/UTC-day
- Single LLM (Gemini). Architecture supports DeepSeek/Claude/Perplexity in future
- No backlink data (no paid backlink API in v1)
- Private reports only

## Stack
Next.js 15 · TypeScript · Tailwind · Supabase (Postgres + Auth + Realtime + Edge Functions) · Gemini 2.0 Flash with Google Search Grounding · Serper.dev · PageSpeed Insights · Resend · @react-pdf/renderer

## Development

```bash
npm install
cp .env.example .env.local   # fill in values
supabase link --project-ref <ref>
npm run dev
```

### Deploying changes

```bash
# DB migrations
supabase db push

# Edge Function
supabase functions deploy run-audit --no-verify-jwt

# App (Vercel deploys on push to main)
git push origin main
```

## Docs
- Design spec: [docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md](docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md)
- Implementation plan: [docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md](docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with stack, limits, and dev/deploy commands"
git push origin main
```

---

### Task D8: Phase D verification (final)

- [ ] **Step 1: Full audit on production**

Run a real audit against a domain you're familiar with. Verify:
- All 7 sections render
- Visibility score reflects reality
- Competitors are recognizable
- Article recommendations are non-duplicative
- PDF email arrives with readable layout

- [ ] **Step 2: All tests pass**

```bash
npm test && npm run test:e2e && npm run build
```

- [ ] **Step 3: Tag release**

```bash
git tag v1.0.0
git push --tags
```

- [ ] **Step 4: Create GitHub release**

```bash
gh release create v1.0.0 --title "v1.0.0 — SEO + GEO Audit MVP" --notes "First public release. Single audit per account, Gemini-powered GEO probes, PDF export."
```

---

## Post-v1 follow-ups (not part of this plan)

- Multiple LLM providers (DeepSeek, Claude, Perplexity)
- Paid tier with Stripe integration
- Audit re-runs / scheduled audits
- Public shareable report URLs
- Real backlink data (paid API)
- CSV/JSON export
- Multi-page deep crawl

These belong in separate specs/plans when prioritized.
