# SEO and GEO Audit Tool

A web app that runs a single comprehensive SEO + GEO (Generative Engine Optimization) audit on a domain. Covers traditional onsite/offsite SEO plus LLM visibility — does Gemini recommend your domain when asked, who are your competitors in LLM answers, and what articles should you write next.

## Status

Pre-implementation. Design spec approved and ready for implementation planning.

- Design spec: [docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md](docs/superpowers/specs/2026-05-13-seo-geo-audit-design.md)

## Stack (planned)

- Next.js 15 App Router + TypeScript on Vercel
- Supabase (Postgres, Auth, Realtime, Edge Functions)
- Gemini 2.0 Flash with Google Search Grounding
- Serper.dev for SERP data
- Google PageSpeed Insights for Lighthouse / Core Web Vitals
- Resend for transactional email
- @react-pdf/renderer for PDF reports

## v1 scope highlights

- Public homepage → Auth gate → 1 free audit per account (lifetime)
- Progressive report rendering (sections fill in as each pipeline step completes)
- "Send PDF to my email" button
- Admin role with 20 audits/UTC-day quota
- LLM provider abstraction (only Gemini wired up in v1, ready for DeepSeek/Claude/Perplexity)

See the design spec for the full picture.
