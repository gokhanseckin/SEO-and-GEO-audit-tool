# Phase D + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Fresh implementer subagent per task, two-stage review (spec compliance → code quality), commit after each. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the SEO+GEO Audit Tool to production as v1.0.0 — close the four open bugs, finish Phase C carry-overs, deliver Phase D features (PDF email, completion email, admin dashboard, retry endpoint, e2e test, Vercel deploy, README runbook), and pay down seven code-quality concerns and three tooling chores flagged during reviews.

**Architecture:** Next.js 16 app on Vercel + Supabase Edge Function pipeline. PDF rendered server-side via `@react-pdf/renderer` and attached to Resend email. Stuck audits caught by a pg_cron watchdog. Atomic JSONB section writes via Postgres RPC. Admin dashboard server-rendered behind `admin_emails` allowlist.

**Tech Stack:** Next.js 16.2.6, React 19.2, Tailwind v4 (CSS-configured), Supabase (Postgres + Edge Functions + pg_cron), Deno runtime, Resend, `@react-pdf/renderer` 4.5, Vitest 4.1, Playwright 1.60, `gemini-2.5-flash`.

---

## Context

Phase A+B+C have shipped to `main` (`af4c049`). The pipeline runs end-to-end on `EdgeRuntime.waitUntil()` and produces seven section payloads, but four bugs and several rough edges were caught during the pyth.network smoke (BUG-001 to BUG-004). Phase D from the original 2026-05-13 plan was scoped but never executed. The "Send PDF" feature, completion email, admin view, retry endpoint, and Playwright e2e do not exist yet. Resend, PageSpeed, and the Gemini grounding-URL story are unfinished. Vercel deploy and a readable runbook are missing.

This phase finishes everything between today and a shippable v1.0.0 — bug fixes, Phase D features, code-quality remediations, and three tooling chores. After this phase, the next phase is post-v1 product growth (billing, multi-tenant, scheduled re-audits) — not in scope here.

## Verified deviations from the 2026-05-13 plan

| Plan assumption | Reality (verified) |
|---|---|
| Next 15 | Next **16.2.6** |
| `tailwind.config.ts` | Tailwind v4, CSS-configured via `postcss.config.mjs` |
| `gemini-2.0-flash` | `gemini-2.5-flash` |
| Standard `anon`/`service_role` keys | New `sb_publishable_…` / `sb_secret_…` opaque keys, env var names unchanged |
| Fire-and-forget `Promise` | `EdgeRuntime.waitUntil(work)` confirmed at `supabase/functions/run-audit/index.ts:59` |
| `middleware.ts` | Will be renamed to `proxy.ts` (Next 16 warns at boot) |
| "Send PDF button already wired" | **FALSE** — `ReportClient.tsx` has no PDF button yet; D-core.1 must add it |
| "Wire PageSpeed API key" | Code already references `Deno.env.get('PAGESPEED_API_KEY')`; only the value is missing |
| Playwright not installed | Already in `devDependencies` (`@playwright/test@^1.60.0`) |

## Phase ordering rationale

1. **D-pre** (foundations): secrets gathered, BUG-001 root cause fixed before any new audits run, watchdog deployed so future stuck rows self-heal, bugs squashed.
2. **D-core** (feature delivery): all user-visible Phase D features against a known-good pipeline.
3. **D-polish** (quality + tooling): code-review carry-overs, middleware rename, git identity, HANDOFF.md.
4. **D-ship**: Vercel deploy, README runbook, tags, PR, final smoke.

Dependency notes:
- D-core.1 (PDF) and D-core.2 (email) need `RESEND_API_KEY` + `RESEND_FROM_EMAIL` from D-pre.0.
- D-pre.1 (atomic RPC) **must** land before any new audit runs to actually fix BUG-001.
- D-pre.2 (pg_cron watchdog) needs the Supabase `pg_cron` extension; install via `apply_migration` in one shot.
- D-core.4 (retry endpoint) composes cleanly with D-pre.2 — both reset rows.
- D-ship.1 (Vercel) must wait until all `.env.local` keys exist and pass smoke locally.

---

## Phase D-pre: Foundations

### Task D-pre.0: Secret audit & worktree env setup

**Files:**
- Modify (worktree-local): `.env.local`
- Modify (docs only — written in D-ship.2): N/A this task

**Context for executor:** Three blank values block this phase. The main checkout at `/Users/gokhanseckin/claude-projects/SEO-GEO analysis/.env.local` has the 7 non-blank keys we need to inherit; this worktree has no `.env.local` yet.

- [ ] **Step 1: Pause and request keys**

Print this verbatim to the user, then halt:

```
Three keys are blank in .env.local and block Phase D. Please obtain them and reply with the values (or paste the shell commands below filled in):

1. PAGESPEED_API_KEY — https://console.cloud.google.com → "PageSpeed Insights API" → Credentials → API key
2. RESEND_API_KEY — https://resend.com/api-keys → "Create API Key" (full access)
3. RESEND_FROM_EMAIL — verified sender on Resend (e.g. audits@yourdomain.com) or "onboarding@resend.dev" for testing

Run these in your terminal once you have them:

cd "/Users/gokhanseckin/claude-projects/SEO-GEO analysis"
# update .env.local in main checkout
sed -i '' 's|^PAGESPEED_API_KEY=.*|PAGESPEED_API_KEY=PASTE_HERE|' .env.local
sed -i '' 's|^RESEND_API_KEY=.*|RESEND_API_KEY=PASTE_HERE|' .env.local
sed -i '' 's|^RESEND_FROM_EMAIL=.*|RESEND_FROM_EMAIL=PASTE_HERE|' .env.local

# push the same to Supabase Edge Function secrets
supabase secrets set \
  PAGESPEED_API_KEY=PASTE_HERE \
  RESEND_API_KEY=PASTE_HERE \
  RESEND_FROM_EMAIL=PASTE_HERE \
  --project-ref iimkmrwcdymuyhmeyate
```

- [ ] **Step 2: Copy `.env.local` into this worktree**

```bash
cp "/Users/gokhanseckin/claude-projects/SEO-GEO analysis/.env.local" .env.local
awk -F= 'NF>=2 {printf "%-30s len=%d\n", $1, length($0)-length($1)-1}' .env.local | sort
```

Expected: all 10 keys present, all `len>0` (PAGESPEED, RESEND_API, RESEND_FROM, SERPER all > 0).

- [ ] **Step 3: Verify Supabase secrets**

```bash
supabase secrets list --project-ref iimkmrwcdymuyhmeyate
```

Expected: `GEMINI_API_KEY`, `SERPER_API_KEY`, `PAGESPEED_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` all listed (digests, not values).

- [ ] **Step 4: Smoke build**

```bash
npm install
npm test
npm run build
```

Expected: 31/31 tests pass, build green.

- [ ] **Step 5: Commit**

Nothing to commit (`.env.local` is gitignored). Verify with `git status` — clean.

---

### Task D-pre.1: Atomic `patchSection` via Postgres RPC (fixes BUG-001 root cause)

**Context:** BUG-001 quote: "audit marked complete with empty sections destroying results". Root cause: `supabase/functions/run-audit/lib/db.ts:18-21` does a non-atomic read-merge-write on `sections` JSONB. C8's orchestrator runs 4 steps in parallel then 2 more in parallel — concurrent patches race and the slower writer overwrites the faster one with stale-merged JSON. Worst case all sections lose entries and you see `{}` even though all 6 step functions claimed success.

**Files:**
- Create (migration): `supabase/migrations/20260514000000_audit_patch_section_rpc.sql`
- Modify: `supabase/functions/run-audit/lib/db.ts` (lines 17-22)
- Test: `supabase/functions/run-audit/lib/db.test.ts` (new — uses Deno test)

- [ ] **Step 1: Write the failing concurrency test (Deno)**

Create `supabase/functions/run-audit/lib/db.test.ts`:

```ts
import { assertEquals } from 'jsr:@std/assert';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Manual integration test: needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
// Run with: deno test --allow-env --allow-net supabase/functions/run-audit/lib/db.test.ts
Deno.test('patchSection survives concurrent writers', async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Create throwaway audit row.
  const { data: row } = await sb.from('audits').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    domain: 'test-concurrency.invalid',
    status: 'pending', sections: {},
  }).select().single();
  const id = row!.id;

  const { patchSection } = await import('./db.ts');
  await Promise.all([
    patchSection(id, 'a', { v: 1 }),
    patchSection(id, 'b', { v: 2 }),
    patchSection(id, 'c', { v: 3 }),
    patchSection(id, 'd', { v: 4 }),
  ]);

  const { data: after } = await sb.from('audits').select('sections').eq('id', id).single();
  assertEquals(Object.keys(after!.sections as object).sort(), ['a', 'b', 'c', 'd']);

  await sb.from('audits').delete().eq('id', id);
});
```

- [ ] **Step 2: Run test against current code — expect FAIL or flaky**

```bash
cd supabase/functions/run-audit
deno test --allow-env --allow-net lib/db.test.ts
```

Expected: occasional missing keys (race lost). Run 5x to confirm flake.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260514000000_audit_patch_section_rpc.sql`:

```sql
-- Atomic JSONB patch for audit.sections to prevent concurrent-writer races.
-- Replaces read-merge-write in supabase/functions/run-audit/lib/db.ts:patchSection.
create or replace function public.audit_patch_section(
  p_id uuid,
  p_key text,
  p_value jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  update public.audits
     set sections = coalesce(sections, '{}'::jsonb) || jsonb_build_object(p_key, p_value),
         updated_at = now()
   where id = p_id;
$$;

revoke all on function public.audit_patch_section(uuid, text, jsonb) from public;
grant execute on function public.audit_patch_section(uuid, text, jsonb) to service_role;
```

- [ ] **Step 4: Apply the migration via Supabase MCP**

```
mcp__bfe84172-…__apply_migration({
  project_id: "iimkmrwcdymuyhmeyate",
  name: "audit_patch_section_rpc",
  query: "<contents of 20260514000000_audit_patch_section_rpc.sql>"
})
```

- [ ] **Step 5: Refactor `patchSection`**

Edit `supabase/functions/run-audit/lib/db.ts` lines 17-22 — replace:

```ts
export async function patchSection(auditId: string, key: string, value: unknown): Promise<void> {
  const { error } = await db().rpc('audit_patch_section', {
    p_id: auditId,
    p_key: key,
    p_value: value as Record<string, unknown>,
  });
  if (error) throw error;
}
```

- [ ] **Step 6: Re-run concurrency test — expect PASS x5**

```bash
deno test --allow-env --allow-net lib/db.test.ts
for i in 1 2 3 4 5; do deno test --allow-env --allow-net lib/db.test.ts; done
```

Expected: all 5 runs green.

- [ ] **Step 7: Redeploy Edge Function via Supabase MCP**

```
mcp__bfe84172-…__deploy_edge_function({
  project_id: "iimkmrwcdymuyhmeyate",
  name: "run-audit",
  files: [<all files under supabase/functions/run-audit/>]
})
```

- [ ] **Step 8: Smoke against a fresh audit**

Run an audit on `example.com` via the running dev server. Watch `sections` populate from `{}` → 7 keys without dropping intermediates. Use Supabase SQL:

```sql
select id, status, jsonb_object_keys(sections)
  from audits
 where domain = 'example.com'
 order by created_at desc limit 1;
```

Expected: 7 distinct section keys eventually.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260514000000_audit_patch_section_rpc.sql \
        supabase/functions/run-audit/lib/db.ts \
        supabase/functions/run-audit/lib/db.test.ts
git commit -m "fix(pipeline): atomic patchSection RPC (closes BUG-001)"
```

---

### Task D-pre.2: pg_cron watchdog for stuck `status='running'` audits

**Context:** §A.3. When the Edge Function dies mid-pipeline (network blip, OOM, wall-clock), the row sits at `status='running'` forever. The decision: **DB-side pg_cron** (per user vote).

**Files:**
- Create: `supabase/migrations/20260514000001_audit_watchdog.sql`
- Test: Manual SQL post-apply

- [ ] **Step 1: Write migration**

```sql
-- Watchdog: flip 'running' audits older than 5min to 'failed' with sentinel error.
create extension if not exists pg_cron with schema extensions;

create or replace function public.audit_watchdog_sweep() returns void
language sql
security definer
set search_path = public
as $$
  update public.audits
     set status = 'failed',
         error = 'watchdog_timeout',
         updated_at = now()
   where status = 'running'
     and updated_at < now() - interval '5 minutes';
$$;

revoke all on function public.audit_watchdog_sweep() from public;

-- Schedule every minute. Idempotent: re-create with same name replaces.
select cron.schedule(
  'audit-watchdog',
  '* * * * *',
  $$select public.audit_watchdog_sweep();$$
);
```

- [ ] **Step 2: Apply migration via MCP**

```
mcp__bfe84172-…__apply_migration({ project_id: "iimkmrwcdymuyhmeyate", name: "audit_watchdog", query: <above> })
```

- [ ] **Step 3: Identify and reset the historical stuck row**

```
mcp__bfe84172-…__execute_sql({
  project_id: "iimkmrwcdymuyhmeyate",
  query: "select id, status, updated_at, error from audits where id::text like '283ac840%';"
})
```

If still `running`, leave it alone — the watchdog will flip it within 1 minute. Wait 90s and re-query; expect `status='failed'`, `error='watchdog_timeout'`.

- [ ] **Step 4: Manual concurrency-test the sweep**

Insert a synthetic stuck row:

```sql
insert into audits (user_id, domain, status, sections, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'watchdog-test.invalid', 'running', '{}', now() - interval '10 minutes')
returning id;
```

Wait ≤ 60s, then re-query:

```sql
select status, error from audits where domain = 'watchdog-test.invalid';
```

Expected: `failed`, `watchdog_timeout`. Cleanup: `delete from audits where domain = 'watchdog-test.invalid';`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260514000001_audit_watchdog.sql
git commit -m "feat(pipeline): pg_cron watchdog flips stuck 'running' audits to 'failed'"
```

---

### Task D-pre.3: BUG-003 — Strip "fetch failed" strings from competitor summaries

**Context:** BUG-003 quote: "enriched competitor cards show fetch error strings as Gemini summaries". The backend writes whatever Gemini returns even if the upstream fetch failed. Filter at the source — never persist error strings to `sections.competitors.enriched[].summary`.

**Files:**
- Modify: `supabase/functions/run-audit/steps/competitors.ts` (find the enrichment block — likely after a `fetchText` call)

- [ ] **Step 1: Read the current enrichment block**

```bash
grep -n "summary" supabase/functions/run-audit/steps/competitors.ts
```

- [ ] **Step 2: Add an error sentinel + guard**

After the Gemini call that produces a competitor's `summary`, validate it. Wrap with:

```ts
const FETCH_ERROR_RE = /^(?:fetch failed|TypeError: Failed to fetch|HTTP \d{3}|timeout|Could not access|^The (?:URL|page) could not be)/i;

function safeSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (FETCH_ERROR_RE.test(t)) return null;
  if (t.length < 20) return null; // implausibly short → likely error
  return t;
}
```

Replace assignments like `enriched.summary = result.text` with `enriched.summary = safeSummary(result.text)`. UI will fall back to existing empty-state rendering.

- [ ] **Step 3: Add a vitest for `safeSummary`**

Create `__tests__/edge/safeSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
// Note: copy the safeSummary fn here as a local symbol since the Deno file isn't importable from Node.
const FETCH_ERROR_RE = /^(?:fetch failed|TypeError: Failed to fetch|HTTP \d{3}|timeout|Could not access|^The (?:URL|page) could not be)/i;
function safeSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (FETCH_ERROR_RE.test(t)) return null;
  if (t.length < 20) return null;
  return t;
}

describe('safeSummary', () => {
  it('filters fetch failed', () => expect(safeSummary('fetch failed')).toBeNull());
  it('filters HTTP errors', () => expect(safeSummary('HTTP 503')).toBeNull());
  it('filters short noise', () => expect(safeSummary('error')).toBeNull());
  it('keeps real summary', () => expect(safeSummary('Brand X is a leading provider of payment rails …')).not.toBeNull());
});
```

- [ ] **Step 4: Run vitest**

```bash
npm test -- safeSummary
```

Expected: 4/4 pass.

- [ ] **Step 5: Redeploy + smoke**

Deploy via MCP, run an audit on a domain known to have a few competitors. Confirm via Supabase SQL that no `sections.competitors.enriched[].summary` matches the sentinel patterns.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/run-audit/steps/competitors.ts __tests__/edge/safeSummary.test.ts
git commit -m "fix(competitors): filter fetch error strings from summaries (closes BUG-003)"
```

---

### Task D-pre.4: BUG-004 — Resolve Gemini grounding-redirect URLs to real source URLs

**Context:** BUG-004 quote: "citations show Gemini grounding-redirect URLs instead of real source URLs". Gemini's grounded response embeds short-link redirects like `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...` instead of the original article URL. We need to follow the redirect to get the real URL.

**Files:**
- Modify: `supabase/functions/run-audit/lib/gemini.ts` (add `resolveGroundingUrl`)
- Modify: `supabase/functions/run-audit/steps/article-recs.ts` (call resolver before persisting citations)

- [ ] **Step 1: Add resolver to `gemini.ts`**

Append:

```ts
const GROUNDING_HOST_RE = /\/grounding-api-redirect\//i;

export async function resolveGroundingUrl(url: string, timeoutMs = 6000): Promise<string> {
  if (!GROUNDING_HOST_RE.test(url)) return url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    return r.url || url;
  } catch {
    // Some hosts reject HEAD — fall back to GET with no body read.
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
      r.body?.cancel();
      return r.url || url;
    } catch {
      return url; // give up — keep the redirect URL rather than dropping
    }
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Resolve citation URLs in `article-recs.ts`**

Find where citations are persisted (look for `citations` writes). For each citation:

```ts
import { resolveGroundingUrl } from '../lib/gemini.ts';

const citations = await Promise.all(rawCitations.map(async (c) => ({
  ...c,
  url: await resolveGroundingUrl(c.url),
})));
```

Run resolution in parallel (Promise.all). Reasonable failure mode: keep the redirect URL.

- [ ] **Step 3: Redeploy + smoke**

Deploy via MCP. Run an audit; assert via SQL:

```sql
select sections->'article_recs'->'citations'
  from audits
 where domain = 'example.com'
 order by created_at desc limit 1;
```

Expected: all `url` values are real article URLs, no `grounding-api-redirect` paths.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/run-audit/lib/gemini.ts supabase/functions/run-audit/steps/article-recs.ts
git commit -m "fix(citations): resolve Gemini grounding-redirect URLs (closes BUG-004)"
```

---

### Task D-pre.5: BUG-002 — Offsite tile empty-value styling

**Context:** BUG-002 quote: "offsite stat tiles render unit/note with missing values". When a tile's primary value is missing, it still renders "—" + unit + note, which looks broken. Hide the unit + note when value is null/undefined.

**Files:**
- Modify: `app/report/[id]/components/OffsiteSection.tsx` or wherever offsite tiles render — find with grep

- [ ] **Step 1: Locate the tile component**

```bash
grep -rn "offsite\|OffsiteSection\|domain_authority\|sections.offsite" app/report/ app/components/ 2>/dev/null
```

- [ ] **Step 2: Add empty-state guard**

In the tile renderer, gate the `unit` and `note` on a non-null `value`:

```tsx
{value != null ? (
  <>
    <span className="tile-value">{value}{unit && <span className="tile-unit"> {unit}</span>}</span>
    {note && <p className="tile-note">{note}</p>}
  </>
) : (
  <span className="tile-empty">—</span>
)}
```

- [ ] **Step 3: Add vitest snapshot/RTL test**

```ts
import { render } from '@testing-library/react';
import { OffsiteTile } from '<path>';

it('hides unit and note when value missing', () => {
  const { container } = render(<OffsiteTile label="DA" value={null} unit="/100" note="from Moz" />);
  expect(container.textContent).not.toMatch(/\/100|from Moz/);
  expect(container.textContent).toContain('—');
});
```

- [ ] **Step 4: Verify**

```bash
npm test -- OffsiteTile
```

- [ ] **Step 5: Commit**

```bash
git add <files>
git commit -m "fix(ui): hide unit/note on empty offsite tiles (closes BUG-002)"
```

---

## Phase D-core: Feature delivery

### Task D-core.1 (D1): PDF render route + send-pdf button

**Context:** D1 in 2026-05-13 plan. The user clicks "Email me the PDF" on `/report/[id]`; server renders the report via `@react-pdf/renderer` (already installed) and Resend emails it as an attachment.

**Files:**
- Create: `app/api/audits/[id]/send-pdf/route.ts`
- Create: `lib/pdf/AuditReportPdf.tsx`
- Create: `lib/email/resend.ts` (Next.js-side Resend client)
- Modify: `app/report/[id]/ReportClient.tsx` (add button)
- Test: `__tests__/app/api/audits/send-pdf.test.ts`

- [ ] **Step 1: Write `lib/email/resend.ts`**

```ts
import { Resend } from 'resend';

let _client: Resend | null = null;
export function resend(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY missing');
    _client = new Resend(key);
  }
  return _client;
}

export function fromAddress(): string {
  const a = process.env.RESEND_FROM_EMAIL;
  if (!a) throw new Error('RESEND_FROM_EMAIL missing');
  return a;
}
```

- [ ] **Step 2: Write `lib/pdf/AuditReportPdf.tsx`**

Server-side renderable PDF component using `@react-pdf/renderer`. Render: header (domain, score, date), each section as a numbered page block. Stripped-down — no charts, no fancy SVGs. Use `Document`, `Page`, `Text`, `View`, `StyleSheet`.

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AuditPayload } from '@/lib/types';

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica' },
  h1: { fontSize: 22, marginBottom: 4 },
  meta: { fontSize: 10, color: '#666', marginBottom: 16 },
  h2: { fontSize: 16, marginTop: 16, marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.45 },
  pill: { fontSize: 9, padding: 2, borderRadius: 4, backgroundColor: '#eef' },
});

export function AuditReportPdf({ audit }: { audit: AuditPayload }) {
  const s = audit.sections ?? {};
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{audit.domain}</Text>
        <Text style={styles.meta}>
          SEO+GEO audit · {new Date(audit.completed_at ?? audit.created_at).toISOString().slice(0, 10)}
        </Text>

        {s.description?.summary && (
          <View>
            <Text style={styles.h2}>Overview</Text>
            <Text style={styles.p}>{s.description.summary}</Text>
          </View>
        )}

        {s.onsite && (
          <View>
            <Text style={styles.h2}>On-site</Text>
            <Text style={styles.p}>Pages crawled: {s.onsite.pages_crawled?.length ?? 0}. Issues: {s.onsite.issues?.length ?? 0}.</Text>
            {(s.onsite.issues ?? []).slice(0, 10).map((i: any, idx: number) => (
              <Text key={idx} style={styles.p}>• [{i.severity}] {i.message}</Text>
            ))}
          </View>
        )}

        {/* Offsite, GEO, Competitors, Articles, Keywords — same pattern */}
        {s.offsite && (<View><Text style={styles.h2}>Off-site</Text><Text style={styles.p}>{JSON.stringify(s.offsite).slice(0, 800)}…</Text></View>)}
        {s.geo && (<View><Text style={styles.h2}>GEO visibility</Text><Text style={styles.p}>Score: {s.geo.score}/8</Text></View>)}
        {s.competitors && (<View><Text style={styles.h2}>Competitors</Text><Text style={styles.p}>{(s.competitors.enriched ?? []).map((c: any) => c.domain).join(', ')}</Text></View>)}
        {s.article_recs && (<View><Text style={styles.h2}>Article recommendations</Text>{(s.article_recs.recommendations ?? []).slice(0, 8).map((r: any, idx: number) => (<Text key={idx} style={styles.p}>• {r.title}</Text>))}</View>)}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Write failing route test**

`__tests__/app/api/audits/send-pdf.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email/resend', () => ({
  resend: () => ({ emails: { send: vi.fn().mockResolvedValue({ data: { id: 'msg_1' } }) } }),
  fromAddress: () => 'audits@example.com',
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', email: 'me@me.com' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'a1', user_id: 'u1', status: 'complete', sections: {}, domain: 'x.com', created_at: new Date().toISOString(), completed_at: new Date().toISOString() } }) }) }) }),
  }),
}));

describe('POST /api/audits/[id]/send-pdf', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renders PDF and sends via Resend', async () => {
    const { POST } = await import('@/app/api/audits/[id]/send-pdf/route');
    const req = new Request('http://localhost/api/audits/a1/send-pdf', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
  });
  it('rejects audit owned by different user', async () => { /* override mock */ });
  it('rejects incomplete audit (status != complete)', async () => { /* override mock */ });
});
```

Run: `npm test -- send-pdf` → FAIL (route doesn't exist).

- [ ] **Step 4: Implement the route**

Create `app/api/audits/[id]/send-pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { AuditReportPdf } from '@/lib/pdf/AuditReportPdf';
import { resend, fromAddress } from '@/lib/email/resend';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: audit, error } = await sb.from('audits').select('*').eq('id', id).single();
  if (error || !audit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (audit.status !== 'complete') return NextResponse.json({ error: 'not_ready' }, { status: 409 });

  const pdfBuffer = await renderToBuffer(<AuditReportPdf audit={audit as any} />);
  const result = await resend().emails.send({
    from: fromAddress(),
    to: user.email!,
    subject: `Your SEO+GEO audit for ${audit.domain}`,
    text: `Attached is the PDF report for ${audit.domain}. View online: ${process.env.APP_URL}/report/${audit.id}`,
    attachments: [{ filename: `audit-${audit.domain}-${audit.id.slice(0, 8)}.pdf`, content: pdfBuffer.toString('base64') }],
  });
  if (result.error) return NextResponse.json({ error: 'send_failed', detail: result.error.message }, { status: 502 });

  return NextResponse.json({ ok: true, message_id: result.data?.id });
}
```

- [ ] **Step 5: Add the button in `ReportClient.tsx`**

Locate around line 60-122 (the rendering of audit + userEmail). Add a button next to the header (or wherever makes UI sense — confirm with `cat app/report/[id]/ReportClient.tsx`). Insert:

```tsx
const [pdfBusy, setPdfBusy] = useState(false);
const [pdfMsg, setPdfMsg] = useState<string | null>(null);
async function sendPdf() {
  setPdfBusy(true); setPdfMsg(null);
  try {
    const r = await fetch(`/api/audits/${audit.id}/send-pdf`, { method: 'POST' });
    const j = await r.json();
    setPdfMsg(r.ok ? `Sent to ${userEmail}` : `Failed: ${j.error}`);
  } finally { setPdfBusy(false); }
}
// in JSX:
{audit.status === 'complete' && userEmail && (
  <button onClick={sendPdf} disabled={pdfBusy} className="btn-secondary">
    {pdfBusy ? 'Sending…' : 'Email PDF to me'}
  </button>
)}
{pdfMsg && <span className="text-sm">{pdfMsg}</span>}
```

- [ ] **Step 6: Run tests + browser smoke**

```bash
npm test
npm run dev
# open localhost:3000/report/<completed-id>, click button, confirm email arrives within 10s
```

- [ ] **Step 7: Commit**

```bash
git add app/api/audits/[id]/send-pdf/ lib/pdf/ lib/email/ app/report/[id]/ReportClient.tsx __tests__/app/api/audits/send-pdf.test.ts
git commit -m "feat(d1): PDF report email via Resend + 'Email PDF' button"
```

---

### Task D-core.2 (D2): Replace email stub with real Resend send in Edge Function

**Context:** D2 in plan. `supabase/functions/run-audit/lib/email.ts` is a stub. Replace with real Resend HTTP call. Reuse the heartbeat-age gate already in `index.ts:11-22` (45s).

**Files:**
- Modify: `supabase/functions/run-audit/lib/email.ts`

- [ ] **Step 1: Rewrite `email.ts`**

```ts
import { db } from './db.ts';

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendCompletionEmail(auditId: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
  if (!key || !from) {
    console.warn('completion email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL missing');
    return;
  }

  // Load audit + owner email via service-role client.
  const sb = db();
  const { data: audit, error } = await sb.from('audits').select('id, domain, user_id, completed_at').eq('id', auditId).single();
  if (error || !audit) { console.error('email: audit not found', error); return; }
  const { data: profile } = await sb.from('profiles').select('email').eq('id', audit.user_id).single();
  const to = profile?.email;
  if (!to) { console.warn('email: profile email missing'); return; }

  const reportUrl = `${appUrl}/report/${audit.id}`;
  const subject = `Your SEO+GEO audit for ${audit.domain} is ready`;
  const html = `<p>Your audit for <strong>${audit.domain}</strong> is complete.</p>
                <p><a href="${reportUrl}">View the report</a></p>`;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) console.error('resend send failed', res.status, await res.text());
}
```

- [ ] **Step 2: Confirm `profiles.email` column exists**

```bash
# via Supabase MCP
mcp__bfe84172-…__list_tables({ project_id: "iimkmrwcdymuyhmeyate", schemas: ["public"] })
```

If `profiles` lacks `email`, add a migration backfilling from `auth.users` (skip if column exists).

- [ ] **Step 3: Redeploy via MCP**

```
mcp__bfe84172-…__deploy_edge_function({ project_id: "iimkmrwcdymuyhmeyate", name: "run-audit", files: [...] })
```

- [ ] **Step 4: Smoke — close tab early to force email path**

Run a fresh audit, close the browser tab as soon as it dispatches. After ~90s, check inbox; email should arrive. Verify via Supabase logs:

```
mcp__bfe84172-…__get_logs({ project_id: "iimkmrwcdymuyhmeyate", service: "edge-function" })
```

Look for no "completion email stub" line and no "resend send failed" line.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/run-audit/lib/email.ts
git commit -m "feat(d2): real Resend completion email when user not on page"
```

---

### Task D-core.3 (D3): Admin dashboard

**Context:** D3 in plan. Route `/admin`. Server-rendered list of all audits with link to each report. Quota view. Only emails in `admin_emails` table allowed.

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/layout.tsx` (auth gate)
- Create: `lib/admin/guard.ts`
- Test: `__tests__/app/admin/guard.test.ts`

- [ ] **Step 1: Auth-gate helper**

`lib/admin/guard.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  const { data } = await sb.from('admin_emails').select('email').eq('email', user.email!).maybeSingle();
  if (!data) redirect('/'); // 404-ish bounce; admin set in DB
  return { userId: user.id, email: user.email! };
}
```

- [ ] **Step 2: Layout**

`app/admin/layout.tsx`:

```tsx
import { requireAdmin } from '@/lib/admin/guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="admin-shell">{children}</div>;
}
```

- [ ] **Step 3: Dashboard page**

`app/admin/page.tsx`:

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const sb = await createClient();
  const { data: audits } = await sb
    .from('audits')
    .select('id, user_id, domain, status, error, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: quotas } = await sb.from('quotas').select('user_id, audits_this_month').limit(50);

  return (
    <div className="space-y-8 p-6">
      <section>
        <h1 className="text-2xl mb-4">Recent audits</h1>
        <table className="w-full text-sm">
          <thead><tr><th>Domain</th><th>Status</th><th>Created</th><th>Error</th><th></th></tr></thead>
          <tbody>
            {(audits ?? []).map((a) => (
              <tr key={a.id} className="border-t">
                <td>{a.domain}</td>
                <td>{a.status}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td className="text-red-600">{a.error ?? ''}</td>
                <td><Link href={`/report/${a.id}`}>open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl mb-2">Quotas</h2>
        <pre className="text-xs bg-gray-50 p-2 rounded">{JSON.stringify(quotas, null, 2)}</pre>
      </section>
    </div>
  );
}
```

(If `quotas` table doesn't exist, drop that section — verify via `list_tables` in step 4.)

- [ ] **Step 4: Verify schema**

```
mcp__bfe84172-…__list_tables({ project_id: "iimkmrwcdymuyhmeyate", schemas: ["public"] })
```

Adjust `app/admin/page.tsx` if a table is missing.

- [ ] **Step 5: Test the guard**

```ts
// __tests__/app/admin/guard.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
// ... mock supabase client, assert redirect called for non-admin
```

- [ ] **Step 6: Smoke**

Sign in as `gokhanseckin@gmail.com`, visit `/admin` — list renders. Sign in as a non-admin (create a throwaway), visit `/admin` — bounces home.

- [ ] **Step 7: Commit**

```bash
git add app/admin/ lib/admin/ __tests__/app/admin/
git commit -m "feat(d3): admin dashboard at /admin, guarded by admin_emails table"
```

---

### Task D-core.4 (D4): Retry endpoint for failed audits

**Context:** D4 in plan. POST `/api/audits/[id]/retry` — verifies ownership, resets sections, redispatches Edge Function.

**Files:**
- Create: `app/api/audits/[id]/retry/route.ts`
- Modify: `app/report/[id]/ReportClient.tsx` (add retry button when `status === 'failed'`)
- Test: `__tests__/app/api/audits/retry.test.ts`

- [ ] **Step 1: Failing test**

```ts
// asserts: only owner can retry; only failed/timeout audits accepted; sections reset; edge dispatched
```

- [ ] **Step 2: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: audit } = await sb.from('audits').select('*').eq('id', id).single();
  if (!audit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (audit.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (audit.status !== 'failed') return NextResponse.json({ error: 'not_retryable' }, { status: 409 });

  await sb.from('audits').update({
    status: 'pending', sections: {}, error: null, completed_at: null, last_heartbeat_at: null,
  }).eq('id', id);

  // Dispatch the Edge Function
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-audit`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audit_id: id }),
  });
  if (!r.ok) return NextResponse.json({ error: 'dispatch_failed', detail: await r.text() }, { status: 502 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Button in `ReportClient.tsx`** (show only when `status === 'failed'`)

- [ ] **Step 4: Smoke**

Pick a `status='failed'` row (e.g. the watchdog-flipped `283ac840-…`), click Retry, watch the report fill in.

- [ ] **Step 5: Commit**

```bash
git add app/api/audits/[id]/retry/ app/report/[id]/ReportClient.tsx __tests__/app/api/audits/retry.test.ts
git commit -m "feat(d4): /api/audits/[id]/retry endpoint + UI button for failed audits"
```

---

### Task D-core.5 (D5): Playwright e2e happy path

**Context:** D5 in plan. Sign in via test user, run audit on stable domain, assert all 7 sections render within 120s. Include `283ac840-…` as a regression fixture.

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/happy-path.spec.ts`
- Create: `e2e/regression-fixtures.spec.ts`
- Modify: `package.json` (already has `test:e2e`)

- [ ] **Step 1: Playwright config**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', headless: true, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 60_000 },
});
```

- [ ] **Step 2: Happy-path spec**

```ts
import { test, expect } from '@playwright/test';

test('audit happy path: example.com renders 7 sections within 120s', async ({ page }) => {
  await page.goto('/');
  // Sign in via magic link bypass: tests use a seeded user; cookie-set helper in beforeEach.
  // ... auth setup ...
  await page.fill('input[name="domain"]', 'example.com');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/report\//, { timeout: 30_000 });
  const sections = ['description', 'onsite', 'offsite', 'geo', 'competitors', 'article-recs', 'keywords'];
  for (const s of sections) {
    await expect(page.locator(`[data-section="${s}"]`)).toBeVisible({ timeout: 120_000 });
  }
});
```

- [ ] **Step 3: Regression spec for the formerly-stuck row**

```ts
test('regression: 283ac840 row resolves to a terminal state', async ({ page, request }) => {
  // Just assert via API that this id is not status='running' indefinitely.
  // ...
});
```

- [ ] **Step 4: Run e2e**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "feat(d5): Playwright e2e happy-path + 283ac840 regression fixture"
```

---

### Task D-core.6: Browser UI smoke (Phase C carry-over A.1)

**Context:** §A.1. Manual smoke against `news.ycombinator.com` and one more domain. Document any UI bugs found.

**Files:**
- Create: `docs/smoke/2026-05-14-ui-smoke.md` (notes only — gitignored if we want? No, commit it)

- [ ] **Step 1: Run two audits manually**

`npm run dev`, sign in, queue audits for `news.ycombinator.com` and `stripe.com`. Watch `/report/[id]` fill progressively.

- [ ] **Step 2: Tick the checklist**

In `docs/smoke/2026-05-14-ui-smoke.md`, fill:
- [ ] Realtime subscription pushes updates (no manual refresh)
- [ ] Heartbeat pings every 15s (network tab)
- [ ] `KeywordsList` candidates dropdown opens/closes
- [ ] `GeoTable` row expand works
- [ ] `CompetitorTabs` SERP↔LLM switch works
- [ ] Send-PDF button works (post D-core.1)
- [ ] Retry button works on a failed audit (post D-core.4)

- [ ] **Step 3: Open follow-up tickets for any defect**

Use `docs/bugs/BUG-005…` if anything new is found.

- [ ] **Step 4: Commit**

```bash
git add docs/smoke/
git commit -m "docs(smoke): manual UI smoke results for news.ycombinator.com + stripe.com"
```

---

## Phase D-polish: Code quality + tooling

### Task DP.1 (§D.2): `getLastHeartbeat` re-throws on DB error

**Files:**
- Modify: `supabase/functions/run-audit/lib/db.ts` lines 34-37

- [ ] **Step 1: Edit**

```ts
export async function getLastHeartbeat(auditId: string): Promise<string | null> {
  const { data, error } = await db().from('audits').select('last_heartbeat_at').eq('id', auditId).single();
  if (error) throw error;
  return (data?.last_heartbeat_at ?? null) as string | null;
}
```

- [ ] **Step 2: Document gate behavior**

In `supabase/functions/run-audit/index.ts` above `maybeSendCompletionEmail`, add a brief comment block:

```ts
// On DB outage, getLastHeartbeat throws and bubbles to the orchestrator try/catch,
// which sets status='failed'. We do NOT send the completion email in that path —
// the user will see a failed audit and can retry.
```

- [ ] **Step 3: Redeploy + commit**

```bash
git add supabase/functions/run-audit/
git commit -m "fix(pipeline): getLastHeartbeat re-throws DB errors; document completion-email gate"
```

---

### Task DP.2 (§D.3): Structured `AuditRow.sections` type

**Files:**
- Modify: `supabase/functions/run-audit/lib/types.ts`
- Modify: all 7 step files in `supabase/functions/run-audit/steps/*.ts` (remove `as any`)

- [ ] **Step 1: Define structured shape**

```ts
export interface AuditSections {
  description?: DescriptionSection;
  onsite?: OnsiteSection;
  onsite_crawl_cache?: CrawledPage[];
  offsite?: OffsiteSection;
  geo?: GeoSection;
  competitors?: CompetitorsSection;
  article_recs?: ArticleRecsSection;
  keywords?: KeywordsSection;
}
export interface AuditRow {
  id: string; user_id: string; domain: string; status: AuditStatus;
  sections: AuditSections;
  serper_query_cap: number;
  // … rest …
}
```

(Re-use existing section types from each step file — extract into types.ts.)

- [ ] **Step 2: Replace `(audit.sections as any).foo` with `audit.sections.foo` everywhere**

```bash
grep -rn "audit.sections as any" supabase/functions/run-audit/
# fix each
```

- [ ] **Step 3: Deno typecheck**

```bash
cd supabase/functions/run-audit && deno check index.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/run-audit/
git commit -m "refactor(types): structured AuditSections, drop 7 'as any' casts"
```

---

### Task DP.3 (§D.4): Robust JSON extract in `stripFences`

**Files:**
- Modify: `supabase/functions/run-audit/lib/gemini.ts` lines 10-12

- [ ] **Step 1: Replace `stripFences` with `extractJson`**

```ts
function extractJson(s: string): string {
  // Prefer triple-fenced block.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  // Otherwise, slurp the first balanced [..] or {..}.
  const idx = s.search(/[\[{]/);
  if (idx < 0) return s.trim();
  let depth = 0, start = idx, end = -1;
  const open = s[idx], close = open === '[' ? ']' : '}';
  for (let i = idx; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  return end > 0 ? s.slice(start, end + 1) : s.trim();
}
```

Update every caller from `stripFences(text)` → `extractJson(text)`. Wrap each parse in `try/catch` returning `[]` or `{}` as appropriate.

- [ ] **Step 2: Vitest unit test** (extract the fn into a `.ts` testable from Node OR write Deno tests)

```ts
it('handles "Here is the JSON:\\n```json\\n[…]\\n```"', () => {
  expect(extractJson('Here is the JSON:\n```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
});
it('extracts balanced object when unfenced', () => {
  expect(extractJson('Random preamble {"a":{"b":2}} trailing')).toBe('{"a":{"b":2}}');
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/run-audit/lib/gemini.ts <test file>
git commit -m "fix(gemini): robust JSON extraction tolerates preambles + nested structures"
```

---

### Task DP.4 (§D.5): De-duplicate `text_content` in `pages_crawled`

**Files:**
- Modify: `supabase/functions/run-audit/steps/onsite.ts` line 86 area

- [ ] **Step 1: Strip `text_content` before persisting under `pages_crawled`**

```ts
const section: OnsiteSection = {
  pages_crawled: cache.map((p) => ({ ...p, text_content: undefined })),
  // … rest …
};
```

(Keep `onsite_crawl_cache` intact since downstream LLM steps still need it.)

- [ ] **Step 2: Verify report still renders**

Run an audit; confirm UI tile "pages crawled" still shows correct count + URLs (it doesn't depend on text_content).

- [ ] **Step 3: Measure JSONB shrinkage**

```sql
select id, pg_column_size(sections) before, … after;
```

(Just visual confirmation — no automated test.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/run-audit/steps/onsite.ts
git commit -m "perf(onsite): strip text_content from pages_crawled (cache retains full copy)"
```

---

### Task DP.5 (§D.6): XML-parsed sitemap `<loc>` count

**Files:**
- Modify: `supabase/functions/run-audit/steps/onsite.ts` lines 44-50

- [ ] **Step 1: Use `deno-dom` to parse**

```ts
import { DOMParser } from 'jsr:@b-fuze/deno-dom';

async function checkSitemap(domain: string): Promise<{ found: boolean; url_count: number }> {
  try {
    const xml = await fetchText(`https://${domain}/sitemap.xml`, 5000);
    const doc = new DOMParser().parseFromString(xml, 'text/html'); // deno-dom parses XML as HTML-ish; <loc> tags accessible
    const urlCount = doc?.querySelectorAll('loc').length ?? 0;
    return { found: urlCount > 0, url_count: urlCount };
  } catch { return { found: false, url_count: 0 }; }
}
```

- [ ] **Step 2: Test against a known sitemap-index URL**

Pick `https://www.google.com/sitemap.xml` (sitemap-index) and `https://example.com/sitemap.xml` (none). Verify counts are sensible.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/run-audit/steps/onsite.ts
git commit -m "fix(onsite): XML-parsed sitemap loc count, no CDATA/comment false positives"
```

---

### Task DP.6 (§D.7): noindex test fixture

**Files:**
- Create: `supabase/functions/run-audit/steps/onsite.test.ts` (Deno test)

- [ ] **Step 1: Unit test for `computeIssues`**

```ts
import { assertEquals } from 'jsr:@std/assert';
// import computeIssues from onsite (export it first)
Deno.test('computeIssues flags noindex pages', () => {
  const pages = [{ url: 'https://x.com/a', robots_meta: 'noindex,follow', text_content: '' }];
  const issues = computeIssues(pages);
  assertEquals(issues.some((i) => i.message.includes('noindex')), true);
});
```

If `computeIssues` is private, export it.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/run-audit/steps/onsite.ts supabase/functions/run-audit/steps/onsite.test.ts
git commit -m "test(onsite): noindex detection regression test"
```

---

### Task DP.7 (§E.1): Rename `middleware.ts` → `proxy.ts`

**Files:**
- Rename: `middleware.ts` → `proxy.ts`

- [ ] **Step 1: Rename**

```bash
git mv middleware.ts proxy.ts
```

- [ ] **Step 2: Verify boot warning is gone**

```bash
npm run build && npm run dev
# observe terminal — no "rename middleware.ts to proxy.ts" warning
```

- [ ] **Step 3: Smoke auth flow**

Sign in → confirm post-login redirect → / lands at intended page. (proxy.ts matcher applies to same paths.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(next16): rename middleware.ts -> proxy.ts (resolves Next 16 boot warning)"
```

---

### Task DP.8 (§E.2): Fix git committer identity

**Files:** none

- [ ] **Step 1: Set globally**

```bash
git config --global user.email "gokhanseckin@gmail.com"
git config --global user.name "Gokhan Seckin"
```

- [ ] **Step 2: Confirm**

```bash
git config user.email
git config user.name
```

- [ ] **Step 3: No commit** (no file changes). This applies to all future commits in this phase and beyond.

(Do NOT amend or rewrite Phase C history.)

---

### Task DP.9 (§E.3): Refresh `docs/HANDOFF.md`

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Rewrite the "current state" section**

State of play at end of Phase D (post all earlier tasks):
- Phase A+B+C+D merged.
- `283ac840-…` row is `status='failed'` after watchdog flip (or `complete` after retry).
- pg_cron watchdog active.
- Resend wired in both Next route and Edge Function.
- Admin dashboard live.
- Playwright e2e passing.
- Deployed to Vercel at <URL — fill in post-D-ship.1>.

- [ ] **Step 2: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs(handoff): refresh for end of Phase D"
```

---

## Phase D-ship: Production deploy + docs

### Task D-ship.1 (D6): Vercel deploy

**Files:**
- Modify: `vercel.json` (optional — only if env vars need explicit mention)

- [ ] **Step 1: `vercel link`**

```bash
npx vercel link
# pick personal scope; project name: seo-geo-audit-tool
```

- [ ] **Step 2: Populate env vars on Vercel**

For each key in `.env.local`, push to Vercel:

```bash
for k in APP_URL GEMINI_API_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_URL PAGESPEED_API_KEY RESEND_API_KEY RESEND_FROM_EMAIL SERPER_API_KEY SERPER_QUERY_CAP_DEFAULT SUPABASE_SERVICE_ROLE_KEY; do
  v=$(grep "^$k=" .env.local | cut -d= -f2-)
  printf '%s' "$v" | npx vercel env add "$k" production
done
```

- [ ] **Step 3: Deploy**

```bash
npx vercel deploy --prod
```

- [ ] **Step 4: Update `APP_URL`**

After deploy, set `APP_URL` to the actual Vercel URL (used in completion-email links) in Vercel env AND Supabase secrets:

```bash
supabase secrets set APP_URL=https://<vercel-url> --project-ref iimkmrwcdymuyhmeyate
```

- [ ] **Step 5: Smoke against the deployed URL**

Sign in on the live URL, run an audit, confirm all sections render + PDF email arrives.

- [ ] **Step 6: Commit**

```bash
# nothing to commit if vercel.json wasn't created; otherwise:
git add vercel.json
git commit -m "chore(deploy): Vercel project linked + production deploy"
```

---

### Task D-ship.2 (D7): README + deployment runbook

**Files:**
- Modify: `README.md`
- Create: `docs/RUNBOOK.md`

- [ ] **Step 1: Rewrite `README.md`**

Sections (paraphrased — exact content TBD when writing):
1. What this is (1 paragraph)
2. Local quickstart: `git clone`, `npm install`, `cp .env.example .env.local`, fill keys, `npm run dev`
3. Required env vars (list of all 10 + what each is for + where to obtain)
4. Architecture diagram (ASCII or mermaid): Next 16 → Supabase Edge → Postgres + pg_cron
5. Test: `npm test`, `npm run test:e2e`
6. Deploy: link to RUNBOOK
7. Tech stack pinned versions

- [ ] **Step 2: Write `docs/RUNBOOK.md`**

Step-by-step:
1. Provision Supabase project — secrets to set (use `supabase secrets set X=Y`)
2. Replay migrations: `supabase db push` OR re-apply via MCP one-by-one
3. Deploy Edge Function: `supabase functions deploy run-audit` OR MCP `deploy_edge_function`
4. Seed `admin_emails`: `insert into admin_emails values ('your@email.com')`
5. Vercel deploy: `vercel link`, env var sync (copy commands from D-ship.1.2), `vercel deploy --prod`
6. Update `APP_URL` post-deploy in both Vercel env and Supabase secrets
7. Smoke: kick off an audit on `example.com`, confirm 7 sections + PDF email

- [ ] **Step 3: Commit**

```bash
git add README.md docs/RUNBOOK.md
git commit -m "docs: README + deployment runbook for v1.0.0"
```

---

### Task D-ship.3 (D8): Phase D verification + v1.0.0

**Files:** none

- [ ] **Step 1: Run final checklist**

- [ ] `npm test` passes (>= 31 + new tests)
- [ ] `npm run build` clean
- [ ] `npm run test:e2e` green
- [ ] Live deploy: full audit on `example.com` completes with 7 sections, PDF email arrives
- [ ] `select count(*) from audits where status = 'running' and updated_at < now() - interval '10 minutes';` → 0
- [ ] Admin dashboard accessible to `gokhanseckin@gmail.com`, denied for non-admin

- [ ] **Step 2: Tag**

```bash
git tag phase-d-complete
git tag v1.0.0
git push origin claude/agitated-borg-f3a4c0 phase-d-complete v1.0.0
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "Phase D + cleanup: ship v1.0.0" --body "$(cat <<'EOF'
## Summary
- Phase D-pre: BUG-001 atomic RPC, pg_cron watchdog, BUG-002/003/004 fixed
- Phase D-core: D1 PDF email, D2 Resend completion email, D3 admin, D4 retry, D5 Playwright e2e, manual UI smoke
- Phase D-polish: 7 code-quality fixes + middleware->proxy rename + git identity + HANDOFF refresh
- Phase D-ship: Vercel production deploy, README + RUNBOOK

## Test plan
- [x] npm test (XX/XX)
- [x] npm run build clean
- [x] npm run test:e2e green
- [x] Manual smoke on live URL passed
- [x] Watchdog SQL check returns 0 stuck rows
EOF
)"
```

- [ ] **Step 4: Merge after self-review**

```bash
gh pr merge --merge
```

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `@react-pdf/renderer` SSR-incompatible with Next 16 / React 19.2 | Build a tiny isolated test first (Step 2 of D-core.1). If it breaks, fall back to a Puppeteer/Playwright headless print-to-PDF approach in a Vercel function. |
| pg_cron not available on Supabase free tier | Verify before applying migration: `select * from pg_extension where extname = 'pg_cron';`. If unavailable, fallback to Supabase scheduled function (in `database.json`) or a tiny Vercel Cron Job hitting an admin sweep route. Surface fallback to user. |
| Resend free tier rate-limits hit during e2e | Use `onboarding@resend.dev` for tests; gate D-core.5 e2e tests so they don't send real emails (mock the route in test env). |
| Vercel function payload limit (4.5MB hobby plan) blocks PDF attachment | Render small, omit per-page text_content from the PDF body. If a report exceeds limit, fall back to hosted-link delivery (requires Storage bucket — out of scope; flag to user). |
| Deno test cannot import `db.ts` cleanly due to deps | If module-level side effects break tests, refactor `db()` to accept a client param (DI) — but keep the change minimal. |
| Phase C UI components named differently than assumed (e.g. KeywordsList path) | Each smoke step instructs the executor to `grep` and confirm before editing. |
| Concurrency test in D-pre.1 destroys real data | Test uses `domain = 'test-concurrency.invalid'` and deletes the row at end; runs only with explicit Deno test command. |

---

## Final verification

After D-ship.3, all of these must be true:

- `phase-d-complete` and `v1.0.0` tags pushed
- PR merged to `main`
- README + RUNBOOK present and accurate
- Production URL serves the app
- Live test audit on `example.com` completes with 7 sections + PDF email + admin row visible
- `select count(*) from audits where status = 'running' and updated_at < now() - interval '10 minutes';` → 0
- 4 bug docs each have a "Fixed in <commit-hash>" footer
- `docs/HANDOFF.md` reflects post-Phase-D state
