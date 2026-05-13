# SEO and GEO Audit Tool

A web app that runs a single comprehensive SEO + GEO (Generative Engine Optimization) audit on a domain. Covers traditional onsite/offsite SEO plus LLM visibility — does Gemini recommend your domain when asked, who are your competitors in LLM answers, and what articles should you write next.

## Status

**Phase B complete.** Auth, homepage, Phase-1 site crawl, Gemini keyword extraction, and keyword confirmation page are working end-to-end against a live Supabase project. Phase C (the full audit pipeline) is next.

Phase tags in git:
- `phase-a-complete` — scaffolding, Supabase setup, auth, homepage
- `phase-b-complete` — keyword extraction flow (Phase 1 audit)
- *(upcoming)* `phase-c-complete` — full audit pipeline
- *(upcoming)* `v1.0.0` — final release

- Design spec: [docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md](docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md)
- Implementation plan: [docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md](docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md)
- Session handoff (to resume in a fresh context): [docs/HANDOFF.md](docs/HANDOFF.md)

## Stack

- Next.js 16 App Router + TypeScript on Vercel (plan was written for 15; create-next-app shipped 16)
- Tailwind CSS v4 (CSS-config, no `tailwind.config.ts`)
- Supabase (Postgres, Auth, Realtime, Edge Functions)
- Gemini 2.5 Flash with Google Search Grounding
- Serper.dev for SERP data
- Google PageSpeed Insights for Lighthouse / Core Web Vitals
- Resend for transactional email
- `@react-pdf/renderer` for PDF reports
- Vitest + Playwright for tests

### Supabase API keys

We use the modern **publishable** + **secret** key pair (`sb_publishable_...` / `sb_secret_...`), not the legacy `anon` / `service_role` JWTs. The env var names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are kept for compatibility — the new keys are drop-in replacements at the `@supabase/ssr` layer.

## v1 scope highlights

- Public homepage → Auth gate → 1 free audit per account (lifetime)
- Progressive report rendering (sections fill in as each pipeline step completes)
- "Send PDF to my email" button
- Admin role with 20 audits/UTC-day quota
- LLM provider abstraction (only Gemini wired up in v1, ready for DeepSeek/Claude/Perplexity)

## Development

```bash
npm install
cp .env.example .env.local   # fill in values (Supabase, Gemini; Serper/Resend/PageSpeed needed for Phase C+)
npm run dev                  # http://localhost:3000
npm test                     # vitest
npm run build                # production build sanity check
```

### Re-applying DB migrations

Migrations live in `supabase/migrations/`. Apply via Supabase MCP (`apply_migration`) or the Supabase CLI (`supabase db push`). The initial schema migration has already been applied to the production project `iimkmrwcdymuyhmeyate`.

### Deploying changes

```bash
# DB migrations
supabase db push

# Edge Function (Phase C onwards)
supabase functions deploy run-audit --no-verify-jwt

# App (Vercel auto-deploys on push to main once connected; not yet connected)
git push origin main
```

See [docs/HANDOFF.md](docs/HANDOFF.md) for the current project state and next steps.
