# SEO + GEO Audit Tool

Full-stack audit tool that runs a Supabase Edge Function pipeline against a domain: on-site SEO,
off-site authority, GEO (Generative Engine Optimization) visibility, competitor landscape, and
article opportunities. Delivers a live-updating server-rendered report and an emailable PDF.

---

## Tech stack

| Layer | Version |
|---|---|
| Next.js (App Router) | 16.2.6 |
| React | 19.2 |
| Tailwind CSS v4 | via `postcss.config.mjs` — no `tailwind.config.ts` |
| Supabase | Postgres + Auth + Edge Functions + pg_cron |
| Edge Function runtime | Deno (Supabase Deploy) |
| LLM | Gemini 2.5 Flash |
| SERP data | Serper |
| Core Web Vitals | Google PageSpeed Insights API |
| Transactional email | Resend |
| PDF generation | `@react-pdf/renderer` 4.5 (server-side) |
| Unit tests | Vitest 4.1 |
| E2E tests | Playwright 1.60 |

---

## Local quickstart

```bash
git clone <repo>
cd seo-geo-audit-tool
npm install
cp .env.example .env.local
# fill in keys — see "Environment variables" below
npm run dev
# open http://localhost:3000
```

---

## Environment variables

`.env.local` is read by Next.js. The Edge Function reads from Supabase secrets
(`supabase secrets set …`). Keep both in sync for deployed environments.

| Key | Where to obtain | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API | Next.js (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API (publishable key) | Next.js |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API (secret key) | Next.js server + Edge Function |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Edge Function |
| `SERPER_API_KEY` | https://serper.dev | Edge Function |
| `PAGESPEED_API_KEY` | Google Cloud → PageSpeed Insights API (optional, raises quota) | Edge Function |
| `RESEND_API_KEY` | https://resend.com/api-keys | Next.js + Edge Function |
| `RESEND_FROM_EMAIL` | Verified sender on Resend | Next.js + Edge Function |
| `APP_URL` | Your deployed URL (or `http://localhost:3000` for dev) | Edge Function (email links) |
| `SERPER_QUERY_CAP_DEFAULT` | Integer 1–20, default `15` | Next.js (per-audit budget) |

> Note: the `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` env var names are
> kept for compatibility; the project uses the modern `sb_publishable_…` / `sb_secret_…` key
> format — they are drop-in replacements at the `@supabase/ssr` layer.

---

## Architecture

```
Browser (Next.js 16)
  │
  ├── POST /api/audits/start ──> INSERT audits row (status='pending')
  │                               │
  │                               └─> POST /api/audits/[id]/run ──> Supabase Edge Function
  │                                         (Authorization: Bearer SERVICE_ROLE_KEY)
  │                                         │
  │                                         └─> Deno + EdgeRuntime.waitUntil(work)
  │
  │   Edge Function pipeline (run-audit)
  │   ├── Parallel fanout:
  │   │   ├── steps/description.ts   (Gemini — domain summary)
  │   │   ├── steps/onsite.ts        (fetch + sitemap + PSI / Core Web Vitals)
  │   │   ├── steps/offsite.ts       (Serper + Gemini — backlink signals)
  │   │   └── steps/geo.ts           (Gemini grounded search — 8 prompts, 5 concurrent)
  │   │
  │   └── After geo resolves:
  │       ├── steps/competitors.ts   (Serper + Gemini, uses geo cited URLs)
  │       └── steps/article-recs.ts  (Gemini, uses geo cited URLs)
  │
  │   Each step writes via audit_patch_section RPC (atomic JSONB merge)
  │   Heartbeat written every 15 s; watchdog pg_cron job marks rows failed
  │   if heartbeat goes stale >= 2 min
  │
  └── GET /report/[id]  (Realtime subscription — sections appear as they land)
       └── "Email PDF" button -> POST /api/audits/[id]/send-pdf
```

Key safety nets:
- **`audit_patch_section` RPC** — atomic JSONB merge; prevents concurrent-write data loss
- **`audit_watchdog_sweep` pg_cron** — flips stuck `running` rows to `failed` every minute
- **`admin_emails` allowlist** — gates the `/admin` dashboard
- **`EdgeRuntime.waitUntil`** — pipeline survives after the HTTP 202 response returns

---

## Common commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # production build
npm test             # vitest unit tests
npm run test:watch   # vitest in watch mode
npm run test:e2e     # Playwright e2e (set E2E_REAL_RUN=1 for network-hitting tests)
```

---

## Deploy

See **[docs/RUNBOOK.md](docs/RUNBOOK.md)** for step-by-step Supabase + Vercel deployment instructions.

---

## Known issues & roadmap

Billing, multi-tenant workspaces, and scheduled re-audits are explicit non-goals for v1.
See [docs/HANDOFF.md](docs/HANDOFF.md) for current project state and open items.
