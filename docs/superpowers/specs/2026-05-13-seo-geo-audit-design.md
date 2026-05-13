# SEO + GEO Audit Website — Design Spec

**Date:** 2026-05-13
**Status:** Approved, pending implementation plan
**Owner:** gokhanseckin@gmail.com

---

## 1. Product summary

A web app that runs a single, comprehensive SEO + GEO (Generative Engine Optimization) audit on a domain and returns a progressively-rendered report covering:

1. What the domain is (LLM-written blurb)
2. Extracted keyword set (user-confirmable)
3. Onsite SEO health (meta, structure, Lighthouse/CWV)
4. Off-site signals (lightweight: age, indexing, brand presence)
5. GEO visibility — does Gemini recommend this domain when asked?
6. Competitors — who ranks for the same terms, both in SERPs and in LLM answers
7. Article topic recommendations based on what LLMs are citing

Homepage is public. Clicking "Analyze" gates behind sign-up (Google OAuth or email magic-link). Free, 1 audit per account (lifetime), no re-runs, private reports only. A "Send PDF to my email" button delivers a polished PDF report. Admin email `gokhanseckin@gmail.com` is exempt and may run 20 audits per UTC day.

---

## 2. Goals and non-goals

### Goals (v1)
- Single-page audit triggered by domain entry on the public homepage
- Email + Google sign-up via Supabase Auth
- Audit pipeline runs in Supabase Edge Functions, returns results progressively to the report page via Supabase Realtime
- LLM probes use Gemini 2.5 Flash with Google Search Grounding (paid key, ~$0.01-0.02/audit)
- SERP data from Serper.dev with configurable per-audit query cap (default 15, max 20)
- Lighthouse / CWV via Google PageSpeed Insights API (free)
- PDF report (generated lazily via Gemini narrative + `@react-pdf/renderer`, delivered by Resend)
- Single LLM provider abstraction so DeepSeek / Claude / Perplexity can be added later without UI changes
- Total v1 cost: free or near-free within existing free tiers (Vercel Hobby, Supabase Free, Resend Free, Gemini paid using $5 starting credit, Serper 2,500-query starter pool)

### Non-goals (explicitly out of scope for v1)
- Payment / Stripe / paid tier
- Multiple LLM providers wired up (only Gemini in v1)
- Backlink data / Domain Authority / Domain Rating (no paid backlink APIs)
- Audit re-runs for regular users
- Public / shareable report URLs
- Comments, collaboration, team accounts
- White-label or branding customization
- Public API for external consumers
- CSV / JSON export (PDF only)
- Scheduled or recurring audits
- Change detection over time

---

## 3. Tech stack

- **Frontend + API routes:** Next.js 15 (App Router) + TypeScript on Vercel (Hobby tier)
- **Database, Auth, Realtime, background jobs:** Supabase Free tier
  - Auth: Google OAuth + email magic-link, no passwords
  - Edge Functions (Deno, 150s budget) for audit orchestration
  - Realtime for progressive report updates
- **LLM:** Gemini 2.5 Flash with Google Search Grounding (paid key)
- **SERP data:** Serper.dev (cap configurable per audit; default 15, max 20)
- **Lighthouse / Core Web Vitals:** Google PageSpeed Insights API (free, optional key for higher quota)
- **PDF generation:** `@react-pdf/renderer` (pure Node, no Chromium)
- **Email delivery:** Resend (free tier 3,000/mo, requires verified sending domain)

---

## 4. High-level flow

```
[Public homepage] → enter domain → click "Analyze"
        ↓
[Auth modal] Google OAuth or email magic link (Supabase Auth)
        ↓
[Quota check] regular user already has audit? → redirect to existing report
        ↓
[Phase 1: keyword extraction]
  Vercel API route fetches homepage + up to 5 internal pages,
  calls Gemini for 20-30 keyword candidates, inserts audits row,
  returns audit_id.
        ↓
[Keyword confirmation page]
  User reviews top 10 LLM-picked keywords (pre-checked) and 10-20 others.
  Confirms selection (max 10). Flag whether selection was modified.
        ↓
[Phase 2: full audit — Supabase Edge Function]
  Parallel DAG: description, onsite, offsite, GEO probes.
  After GEO completes: competitors + article recommendations.
  Each step patches audits.sections.* as it finishes.
        ↓
[Report page] /report/[id]
  Subscribes via Supabase Realtime; each section renders skeleton →
  partial → complete as data lands.
  Heartbeat ping every 15s while page is visible; if missing for 45s
  after audit completes, Resend fires completion email with link.
        ↓
["Send PDF to my email" button]
  Gemini writes narrative → react-pdf renders → Resend sends as attachment.
```

---

## 5. Architecture and boundaries

### Component boundaries

- **Edge Function (`run-audit`) is the single writer** to `audits.sections` and `audits.status`. The UI never writes audit results.
- **Frontend is read-only** via Supabase client + RLS ("user can read own audit").
- **LLM access** flows through a single `LLMProvider` interface. `GeminiProvider` is the only v1 impl. Methods: `describe(domain)`, `groundedAnswer(prompt)`, `summarize(text)`, `generateNarrative(auditData)`.
- **Audit row stores `llm_provider: 'gemini'`** so multi-provider data stays attributable when other providers are added.

### Trust boundaries

- Vercel API routes hold the service role key only when calling Supabase from the server. Client-side code uses the anon key + user JWT.
- Edge Function uses the service role key to update `audits` (bypassing RLS for the writer path).
- All user-controlled inputs (domain, keyword selection) are validated server-side before any external API call is made.

---

## 6. Data model

### Tables

```sql
-- 1. PROFILES (extends auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  audits_used int not null default 0,
  created_at timestamptz default now()
);

-- 2. ADMIN ALLOWLIST
create table admin_emails (
  email text primary key,
  created_at timestamptz default now()
);
insert into admin_emails (email) values ('gokhanseckin@gmail.com');

-- 3. AUDITS
create table audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
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

-- 4. EMAIL DELIVERIES
create table email_deliveries (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('completion_fallback', 'pdf_export')),
  resend_message_id text,
  status text not null check (status in ('queued', 'sent', 'failed')),
  error text,
  created_at timestamptz default now()
);
```

### Triggers

```sql
-- Auto-create profile + assign role on auth.users insert
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id, new.email,
    case when exists (select 1 from admin_emails where email = new.email)
         then 'admin' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Quota enforcement (1 lifetime for users, 20/UTC-day for admins)
create or replace function check_audit_quota() returns trigger as $$
declare
  user_role text;
  cnt int;
begin
  select role into user_role from profiles where id = NEW.user_id;
  if user_role = 'admin' then
    select count(*) into cnt from audits
      where user_id = NEW.user_id
        and created_at >= date_trunc('day', now() at time zone 'UTC');
    if cnt >= 20 then
      raise exception 'admin_daily_quota_exceeded';
    end if;
  else
    select count(*) into cnt from audits where user_id = NEW.user_id;
    if cnt >= 1 then
      raise exception 'user_lifetime_quota_exceeded';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger enforce_audit_quota
  before insert on audits
  for each row execute function check_audit_quota();

-- Increment audits_used counter
create or replace function increment_audits_used() returns trigger as $$
begin
  update profiles set audits_used = audits_used + 1 where id = NEW.user_id;
  return NEW;
end;
$$ language plpgsql;

create trigger bump_audits_used
  after insert on audits
  for each row execute function increment_audits_used();
```

### Row-level security

```sql
alter table profiles enable row level security;
alter table audits enable row level security;
alter table email_deliveries enable row level security;
alter table admin_emails enable row level security;

create policy "own profile read" on profiles
  for select using (auth.uid() = id);
create policy "own profile update" on profiles
  for update using (auth.uid() = id);

create policy "own audits read" on audits
  for select using (auth.uid() = user_id);
create policy "own audits insert" on audits
  for insert with check (auth.uid() = user_id);
-- No update/delete policy: users cannot mutate audits. Service role bypasses RLS.

create policy "own deliveries read" on email_deliveries
  for select using (auth.uid() = user_id);

-- admin_emails is service-role only. No policies = no client access.
```

### `audits.sections` JSONB shape

Patched independently by the Edge Function as each step completes.

```jsonc
{
  "description": {
    "blurb": "...",
    "completed_at": "..."
  },
  "keywords": {
    "candidates": [
      { "term": "...", "relevance": 0.0, "type": "head|long-tail|question" }
    ],
    "selected": ["term1", "..."],
    "user_modified": false
  },
  "onsite": {
    "pages_crawled": [
      { "url": "...", "title": "...", "meta_desc": "...", "h1": [], "alt_coverage": 0.0,
        "word_count": 0, "canonical": "...", "robots_meta": "...", "og_present": true,
        "schema_jsonld_count": 0, "viewport_set": true, "https": true }
    ],
    "lighthouse": {
      "performance": 0, "accessibility": 0, "best_practices": 0, "seo": 0,
      "cwv": { "lcp_ms": 0, "cls": 0.0, "inp_ms": 0 }
    },
    "issues": [{ "severity": "high|med|low", "message": "...", "page": "..." }],
    "sitemap_found": true,
    "sitemap_url_count": 0
  },
  "offsite": {
    "domain_age_days": 0,
    "https": true,
    "indexed_pages_estimate": 0,
    "directory_presence": [{ "name": "Wikipedia", "found": true, "url": "..." }],
    "brand_serp_mentions": 0
  },
  "geo": {
    "prompts": [{
      "prompt": "...",
      "answer_text": "...",
      "user_domain_mentioned": false,
      "user_domain_rank": null,
      "competitor_domains": [],
      "cited_urls": [{ "url": "...", "title": "..." }]
    }],
    "visibility_score": 0
  },
  "competitors": {
    "serp_ranked": [{ "domain": "...", "appearances": 0, "avg_position": 0.0 }],
    "llm_ranked": [{ "domain": "...", "appearances": 0, "cited_urls": 0 }],
    "enriched": [{
      "domain": "...",
      "title": "...",
      "meta_desc": "...",
      "summary": "...",
      "sources": ["serp", "llm"]
    }]
  },
  "article_recommendations": [{
    "title": "...",
    "angle": "...",
    "target_keyword": "...",
    "why_it_ranks": "...",
    "source_urls": ["..."]
  }],
  "narrative_pdf": {
    "markdown": "...",
    "generated_at": "..."
  }
}
```

Each top-level key is absent until its step completes. Sections may carry an `error` sub-field when their step failed — the report renders a partial-data banner in that case.

---

## 7. Audit pipeline

### Phase 1 — synchronous gate (Vercel API route, ~5-15s)

`POST /api/audits/start` with `{ domain }`:

1. Auth check; quota pre-check (look up profile, decide allow/block)
2. Normalize domain: lowercase, strip protocol, strip trailing slash, IDN-decode
3. Validate: domain resolves, returns HTTP, not in blocklist
4. Fetch homepage HTML (5s timeout)
5. Fetch up to 5 linked internal pages in parallel (5s each)
6. Single Gemini call: extract 20-30 keyword candidates with `{ term, relevance, type }`
7. `INSERT audits` row with `sections.keywords.candidates`, `status='pending'`
8. Return `{ audit_id }`

Client renders keyword confirmation screen with the top 10 (by `relevance`) pre-checked.

`POST /api/audits/:id/run` with `{ selected_keywords }`:

1. Auth + ownership check; row must still be `pending`
2. Update `sections.keywords.selected` and `sections.keywords.user_modified`
3. Set `status='running'`, `started_at=now()`
4. Invoke Edge Function `run-audit` with the audit ID (fire-and-forget)
5. Return 202; client navigates to `/report/[id]`

### Phase 2 — async pipeline (Supabase Edge Function, ~90-130s)

```
                  ┌──────────────────────────┐
                  │ Edge Function: run-audit │
                  └─────────────┬────────────┘
                                │
       ┌────────────────┬───────┴────────┬──────────────────┐
       ▼                ▼                ▼                  ▼
  [description]    [onsite]         [offsite]          [geo prompts]
  Gemini direct    Lighthouse +     WHOIS RDAP +       Build 15 prompts;
  query — domain   meta/H1/alt +    Serper site: +     Gemini grounded;
  blurb            schema +         brand search +     spaced calls
  (~3s)            sitemap          directory patterns  (~60s total)
                   (~25s)           (~8s)
       │                │                │                  │
       └────────────────┴────────┬───────┴──────────────────┘
                                 ▼
                       (geo data populated)
                                 │
                ┌────────────────┴──────────────────┐
                ▼                                   ▼
          [competitors]                       [article_recs]
          Tally SERP + LLM domains;           Fetch titles/metas from
          fetch top 3-5 homepages;            cited URLs (~20);
          Gemini summaries.                   gap-check vs crawled pages;
          (~15s)                              Gemini → 8-12 ideas.
                                              (~15s)
                ▼                                   ▼
              audits.status = 'complete', completed_at = now()
              → heartbeat check → completion email if user gone
```

**Why this fits in 150s:** four-way fanout at top; GEO is the long pole at ~60s; competitors + article_recs depend on GEO but run in parallel afterwards. Worst case ~75-90s.

**Budgets per audit:**

| Resource | Calls | Notes |
|---|---|---|
| Gemini | ~24 | keyword extract + description + 15 GEO + ~5 enrichments + 1 article recs + 1 PDF narrative (lazy) |
| Serper | ≤20 | configurable; default 15 |
| Page fetches | ~30 | homepage + 5 internal + ~20 cited URLs + 5 competitor homepages |
| PageSpeed Insights | 1-2 | mobile + desktop |

### Error handling per step

- Each step wrapped in try/catch; failure writes `sections.<key>.error` and continues
- Pipeline does not abort on per-section failure
- After all steps: `status='complete'` even if some sections errored — UI shows partial banners
- Catastrophic failure before any section writes: `status='failed'`, `error=msg`

### Retry policy (failed-only)

- `POST /api/audits/:id/retry` permitted only when `status='failed'`
- Resets row and re-dispatches Edge Function
- Does NOT count as a second audit (quota trigger only fires on INSERT, retries do not insert)

### Heartbeat + completion email

- Frontend `POST /api/audits/:id/heartbeat` every 15s while `/report/[id]` is visible → updates `audits.last_heartbeat_at`
- Edge Function on completion: if `now() - last_heartbeat_at > 45s` (or NULL), enqueue Resend completion email and write `email_deliveries` row (`kind='completion_fallback'`)

---

## 8. Auth + onboarding flow

### Homepage `/`
- Public. Logo, tagline, domain input, "Analyze" button, "Sign in" top-right
- Client-side domain validation (regex + TLD)
- On "Analyze" click: stash domain in `sessionStorage` (`pending_domain`), open Auth Modal

### Auth Modal
- Google OAuth button + email magic-link form
- Supabase Auth handles both flows
- Callback at `/auth/callback?...` → exchange code → set session → redirect to `/auth/post-login?next=...`

### `/auth/post-login` — routing brain (server component)

```
1. Get session and profile (auto-created by handle_new_user trigger)
2. Read `pending_domain` from query/sessionStorage
3. Branch:
   a. pending_domain present + user has no audits        → /analyze?domain=X
   b. pending_domain present + user (role='user') has audit
                                                         → /report/[existing_id] + flash "You already used your free audit"
   c. pending_domain present + admin                     → /analyze?domain=X
   d. no pending_domain + user has audit                 → /report/[existing_id]
   e. no pending_domain + admin                          → /dashboard
   f. no pending_domain + user has no audit              → /
```

### `/analyze` — keyword confirmation
- Only reachable post-auth
- Server component triggers Phase 1 API call, shows progress, renders keyword candidates
- 10 pre-checked top-relevance keywords + others as unchecked options (cap selection at 10)
- "Run Full Audit" → Phase 2 dispatch → navigate to `/report/[id]`
- Abandoned `/analyze` consumes quota (audit row exists); returning user sees "resume keyword selection" view via `/report/[id]` for a `status='pending'` row

### `/report/[id]` — progressive report
- See Section 9 for layout
- Realtime subscription on the audits row by id
- Heartbeat ping every 15s while visible

### `/dashboard` — admin only
- Lists admin's recent audits (domain, status, created_at, link to report)
- Plain table, no charts
- Non-admins navigating here are redirected to their single report (or `/` if none)

### Sign-out
- Top-right user menu → Supabase `signOut()` → redirect to `/`
- Audit data persists across sessions

### Cross-provider email behavior
- Same email via Google and magic-link = same `auth.users` row (Supabase merges by email)
- Different email via different provider = different `auth.users`, new quota; acknowledged but not blocked in v1

---

## 9. Report page UI

Single scrollable page. Sections in fixed order. Each section is a React component with three states: **skeleton**, **partial**, **complete**. Realtime UPDATE events trigger reconciliation by section key (components memoized on their slice of `sections.*`).

### Section order

1. **What is this domain?** — Gemini's direct-query blurb at the top
2. **Keywords we found** — selected (chips) + other candidates (collapsed chips)
3. **Onsite SEO** — Lighthouse scores (perf / a11y / SEO / best practices), CWV, issues list (severity-grouped), crawled pages table
4. **Off-site signals** — domain age, HTTPS, indexed pages estimate, directory presence checks, brand SERP mentions
5. **GEO — do LLMs recommend you?** — headline visibility score (X of 15 = N% visibility), per-prompt table with expandable rows (prompt, answer, user rank, top competitor, cited URLs)
6. **Competitors** — tabbed (SERP / LLM), ranked list, top 3-5 enriched cards (title, meta, summary, sources), overlap callout
7. **Article topics to write** — 8-12 cards: title, angle, target keyword, why it'd rank, inspired-by cited URLs

### Header bar
- Domain
- Progress indicator (% = present sections / 7)
- "Send PDF to my email" button — disabled until `status='complete'`

### "Send PDF to my email" — server action

`POST /api/audits/:id/send-pdf`:
1. Auth + ownership check
2. Idempotency: if `email_deliveries` row for this audit with `kind='pdf_export'` exists in last 60s, return existing
3. If `sections.narrative_pdf` missing: call Gemini once for narrative markdown, persist
4. `@react-pdf/renderer` builds PDF buffer from narrative + structured data
5. Resend `send` with attachment to `profile.email`
6. Insert `email_deliveries` row
7. Return 200 → UI shows toast

### Edge states

- **Section error:** yellow "Partial data" banner with details expander
- **All sections errored:** top-level error banner; retry only if `status='failed'`
- **User reloads mid-audit:** Realtime re-subscribes from current sections state
- **User shares URL with another user:** auth wall → 403 (private only)

---

## 10. Environment and secrets

### Vercel project env

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
SERPER_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=          # e.g. reports@<verified-domain>
PAGESPEED_API_KEY=          # optional
APP_URL=
SERPER_QUERY_CAP_DEFAULT=15
```

### Supabase Edge Function secrets

```
GEMINI_API_KEY=
SERPER_API_KEY=
PAGESPEED_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
```

Duplicated because Vercel and Supabase run independently. A `.env.example` lives at repo root.

---

## 11. Repo layout

```
seo-geo-audit/
├── app/
│   ├── (marketing)/page.tsx          # public homepage
│   ├── auth/
│   │   ├── callback/route.ts
│   │   └── post-login/page.tsx
│   ├── analyze/page.tsx
│   ├── report/[id]/page.tsx
│   ├── dashboard/page.tsx
│   ├── api/
│   │   ├── audits/start/route.ts
│   │   ├── audits/[id]/run/route.ts
│   │   ├── audits/[id]/heartbeat/route.ts
│   │   ├── audits/[id]/send-pdf/route.ts
│   │   └── audits/[id]/retry/route.ts
│   └── layout.tsx
├── components/
│   ├── report/
│   │   ├── DescriptionCard.tsx
│   │   ├── KeywordsList.tsx
│   │   ├── OnsiteCard.tsx
│   │   ├── OffsiteCard.tsx
│   │   ├── GeoTable.tsx
│   │   ├── CompetitorTabs.tsx
│   │   └── ArticleRecsGrid.tsx
│   ├── auth/AuthModal.tsx
│   └── ui/
├── lib/
│   ├── supabase/                     # client + server helpers
│   ├── llm/
│   │   ├── provider.ts               # LLMProvider interface
│   │   └── gemini.ts
│   ├── audit/                        # shared types
│   └── pdf/Report.tsx                # @react-pdf/renderer template
├── supabase/
│   ├── migrations/
│   └── functions/
│       └── run-audit/
│           ├── index.ts
│           ├── steps/
│           │   ├── description.ts
│           │   ├── onsite.ts
│           │   ├── offsite.ts
│           │   ├── geo.ts
│           │   ├── competitors.ts
│           │   └── article-recs.ts
│           └── lib/
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 12. Deployment plumbing

- **Vercel:** GitHub auto-deploy; `main` → Production, PRs → Preview
- **Supabase:** migrations via `supabase db push`; Edge Function via `supabase functions deploy run-audit`
- **Supabase Auth Studio config:** enable Google + email magic-link; set redirect URLs to `<APP_URL>/auth/callback`
- **Google OAuth:** create OAuth 2.0 client in Google Cloud Console; authorized redirect URI = `<SUPABASE_URL>/auth/v1/callback`; paste client ID/secret into Supabase Studio
- **Resend:** verify sending domain via DNS; set `RESEND_FROM_EMAIL=<address>@<verified-domain>`

---

## 13. Cost ceiling sanity check

| Service | Free tier | Per audit | Audits covered |
|---|---|---|---|
| Vercel Hobby | 100 GB-hrs/mo, 100K invocations | ~10 invocations | thousands |
| Supabase | 500K edge invocations, 2M sec exec | ~1 invocation, ~120s | tens of thousands |
| Supabase Realtime | 200 concurrent, 2M msgs/mo | ~50 messages | tens of thousands |
| Gemini (paid, $5 credit) | — | ~$0.01-0.02 | 250-500 |
| Serper starter | 2,500 one-time | 15 | ~165 |
| Resend free | 3,000 emails/mo | up to 2 | ~1,500 |
| PageSpeed Insights | 25K/day | 1-2 | tens of thousands |

**Hard ceiling: Serper at ~165 audits.** Everything else has orders-of-magnitude more headroom. After Serper exhaustion, SERP-dependent sections fail gracefully via standard partial-error UI; new keyword-pick flows continue working (Phase 1 doesn't use Serper).

---

## 14. Testing strategy

- **Unit:** `lib/llm/gemini.ts` parsing, `lib/audit/` type guards, PDF template snapshot tests
- **Integration:** API routes with mocked Supabase + mocked Gemini/Serper (using `msw`)
- **E2E (one happy path):** Playwright — homepage → enter domain → auth (test user) → keyword confirm → wait for report → verify all 7 sections render
- **Manual smoke:** real audit against a known domain in preview env before each merge to main
- **No load testing in v1**

---

## 15. Open items requiring user input

1. **Resend verified sending domain** — confirm which domain `RESEND_FROM_EMAIL` will use. Until verified, "Send PDF" button is feature-flagged off.
2. **App domain** — `<sub>.<yourdomain>` or `<project>.vercel.app`? Affects OAuth redirect setup.
3. **Google OAuth credentials** — to be created in Google Cloud Console during deployment; client ID + secret pasted into Supabase Studio.
4. **Logo / branding** — provide assets or accept plain wordmark + neutral styling for v1.

---

## 16. Glossary

- **GEO** — Generative Engine Optimization. Optimizing for how LLMs answer user questions, analogous to SEO for traditional search.
- **Grounded answer** — A Gemini response generated with Google Search Grounding enabled, which returns cited source URLs.
- **Visibility score** — Percentage of GEO prompts where the user's domain appeared in Gemini's answer.
- **Phase 1 / Phase 2** — Phase 1 = lightweight crawl + keyword extraction (synchronous, Vercel API route). Phase 2 = full async audit pipeline (Supabase Edge Function).
- **Section** — A keyed slice of `audits.sections` JSONB, written independently by the Edge Function, rendered independently in the UI.
