# Session Handoff — Phase B → Phase C

Read this when resuming work in a fresh Claude Code session.

## Current state (as of `phase-b-complete` tag)

Phase A and Phase B are committed, tested end-to-end against a live Supabase project, and pushed to `main`.

### What works
- Public homepage at `/` with domain input + "Analyze" button
- Auth via Supabase Auth (Google OAuth + email magic-link) — both flows verified
- Post-login routing brain at `/auth/post-login` (admin → `/dashboard` stub, regular → `/report/[id]` if existing audit, else `/`)
- `/analyze?domain=...` keyword confirmation page
- `/api/audits/start` — crawls homepage + up to 5 internal pages, calls Gemini for 20-30 keyword candidates, inserts `audits` row
- `/api/audits/[id]/run` — updates row to `status='running'`, dispatches Edge Function (fire-and-forget; function doesn't exist yet)
- `/report/[id]` — **stub only** ("Progressive report renders here in Phase C.")
- Supabase Postgres schema fully migrated: `admin_emails`, `profiles`, `audits`, `email_deliveries` with RLS + triggers (quota enforcement, profile auto-creation, audits_used counter)
- Realtime publication on `audits` table (used in Phase C)
- 31 unit tests passing (domain validation, HTML parser, Gemini response parsing, /start route)

### Live infrastructure
- **Supabase project:** `iimkmrwcdymuyhmeyate` in eu-central-1 (Frankfurt)
- **GitHub repo:** https://github.com/gokhanseckin/SEO-and-GEO-audit-tool (public, `main` branch)
- **Vercel:** not yet deployed; planned in Phase D (Task D6)
- **Admin email:** `gokhanseckin@gmail.com` (seeded in `admin_emails` table; quota = 20/UTC-day)

### Env vars already set in `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL` ✓
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓ (holds `sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (holds `sb_secret_...`)
- `GEMINI_API_KEY` ✓
- `APP_URL=http://localhost:3000` ✓

### Env vars still blank (needed for Phase C/D)
- `SERPER_API_KEY` — needed for Phase C (off-site + competitors steps). Get from https://serper.dev (2,500 free starter queries)
- `PAGESPEED_API_KEY` — optional; needed for Phase C (onsite Lighthouse step). Higher quotas if set. Get from Google Cloud Console → Credentials → API key
- `RESEND_API_KEY` — needed for Phase D (PDF email + completion fallback)
- `RESEND_FROM_EMAIL` — needed for Phase D; requires a verified sending domain in Resend

## Stack deviations from the plan

The plan was written assuming older versions of upstream tooling. The actual project uses:

| Plan said | Actual |
|---|---|
| Next.js 15 | **Next.js 16** (create-next-app@latest shipped 16) |
| `tailwind.config.ts` | **None** — Tailwind v4 is CSS-configured via `app/globals.css` |
| `postcss.config.js` | `postcss.config.mjs` |
| `--turbopack` flag in `npm run dev` | Default in Next 16 |
| Legacy `anon` + `service_role` JWT keys | **New `sb_publishable_...` + `sb_secret_...` keys** (drop-in compatible; env var names kept) |
| `gemini-2.0-flash` model | **`gemini-2.5-flash`** (2.0 deprecated for new users) |
| `middleware.ts` (Next.js convention) | Kept as `middleware.ts` but deprecated in Next 16 in favor of `proxy.ts`; harmless warning at boot, will rename as a follow-up |

None of these affect the design — they're upstream tooling moves.

## How Phase A/B was actually executed

- Subagent-driven development (fresh implementer per task, with two-stage review)
- Used the Supabase MCP for:
  - Project creation (`create_project`)
  - Migration apply (`apply_migration`)
  - Type generation (`generate_typescript_types`)
  - Verification queries (`execute_sql`, `list_tables`)
- Most tasks went smoothly; minor adjustments:
  - Task A1: `create-next-app` was non-trivial because the repo already had `README.md`, `.gitignore`, `docs/` — handled by scaffolding into `/tmp` and copying files
  - Task A7: `supabase gen types --linked` failed (no CLI access token); regenerated types via MCP `generate_typescript_types` instead
  - Migration trigger names in spec: `handle_new_user`, `check_audit_quota`, `increment_audits_used` — all live and working

## Phase B smoke test result (the proof everything works)

User flow: signed in as admin → entered `brix.money` → confirmed keyword selection → ran full audit. DB row created:

```
id: 283ac840-f701-47e5-9e2a-bce24ad35435
domain: brix.money
status: running                 (Edge Function not built yet)
llm_provider: gemini
serper_query_cap: 15
candidate_count: 30
selected_count: 10
user_modified: true
pages_crawled: 6
```

## Phase C plan — what to do next

The plan file `docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md` defines tasks C1 through C11. The subagent-driven workflow should resume with **Task C1: Edge Function scaffolding**.

Phase C builds the Supabase Edge Function (`run-audit`) that consumes the `audits.sections.onsite_crawl_cache` + `audits.sections.keywords.selected` data already in the DB, runs the 6-step DAG (description, onsite, offsite, GEO, competitors, article recs), patches `audits.sections.*` as each step completes, and the frontend (built in C10) subscribes via Supabase Realtime.

Before starting Phase C, the user will need:
1. **Serper API key** (free starter pack at https://serper.dev) — for the off-site and competitors steps
2. *(Optional)* **PageSpeed Insights API key** from Google Cloud Console — raises Lighthouse quota but works without

Update `.env.local` and run `supabase secrets set` for both keys before deploying the Edge Function (Task C1, Step 6).

## Outstanding stuck audit row

The smoke test left one audit row in `status='running'` indefinitely (id `283ac840-f701-47e5-9e2a-bce24ad35435`). When Phase C completes and the Edge Function exists, we can re-dispatch this row to test the full pipeline, OR clean it up first.

## Tags and commits

```bash
git log --oneline phase-a-complete..phase-b-complete   # Phase B commits
git tag -l                                              # all tags
```

## Quick checks to confirm state before continuing

```bash
# 1. Working directory is clean
git status

# 2. On main, at phase-b-complete tag
git log --oneline -1
git describe --tags

# 3. Tests + build pass
npm test && npm run build

# 4. Dev server boots
npm run dev   # http://localhost:3000
```

If all four pass, you're ready to start Phase C.
