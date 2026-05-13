# Phase C resume prompt

Paste the block below into a fresh Claude Code session opened in this project directory. It tells the new session what to read, which superpowers skills to use, and how to set up the worktree before dispatching subagents.

---

```
Resume the SEO + GEO Audit Tool implementation at Phase C.

## Required reading (in this order)
1. docs/HANDOFF.md — current state, env vars, what works, what's blank
2. docs/superpowers/plans/2026-05-13-seo-geo-audit-tool.md — full plan; Phase C tasks are C1 through C11

## Workflow rules for this phase
- Each phase goes on its own branch in an isolated worktree. For Phase C:
  - Branch: feat/phase-c-pipeline
  - Worktree: ../seo-geo-audit-tool-phase-c (parallel to main checkout)
- Use the superpowers:using-git-worktrees skill to create the worktree before any code work
- Use the superpowers:subagent-driven-development skill to execute tasks C1-C11 — fresh implementer subagent per task, two-stage review (spec compliance, then code quality), commit after each
- Use the Supabase MCP for: apply_migration (DDL), execute_sql (reads), generate_typescript_types (schema bump), list_tables (verify). The project ref is iimkmrwcdymuyhmeyate
- When a task needs an API key not yet in .env.local (Serper, PageSpeed), pause and tell me what to set, then continue

## What to do first
1. Skill: superpowers:using-superpowers (auto-invoked at session start)
2. Read HANDOFF.md and the plan file
3. Skill: superpowers:using-git-worktrees → create worktree at ../seo-geo-audit-tool-phase-c on branch feat/phase-c-pipeline
4. cd into the worktree
5. Skill: superpowers:subagent-driven-development → start dispatching Task C1

## When Phase C is complete
- Run npm test + npm run build in the worktree
- Tag phase-c-complete on the feat/phase-c-pipeline branch
- Open a PR against main on GitHub (gh pr create)
- Pause for me to merge before starting Phase D

## Constraints to honor (from the spec)
- Plan was written for Next.js 15 but project is on Next.js 16 — adapt API references
- Use gemini-2.5-flash (2.0 is deprecated)
- Edge Function `run-audit` budget = 150s; the DAG must fit
- Serper cap default 15, max 20 per audit (configurable env)
- Each Edge Function step writes its slice of audits.sections via the service-role client; UI reads via Realtime + RLS

Start by reading HANDOFF.md and confirming the worktree setup, then dispatch C1.
```
