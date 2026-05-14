# Deployment Runbook

Step-by-step guide to provision and deploy the SEO + GEO Audit Tool from scratch.
Assumes you have a Supabase project and a Vercel account.

---

## Prerequisites

| Tool | Install |
|---|---|
| Node.js 20+ | https://nodejs.org |
| Supabase CLI | `brew install supabase/tap/supabase` |
| Vercel CLI | `npm i -g vercel` |
| `gh` CLI | optional — https://cli.github.com |

---

## 1. Provision Supabase

### 1.1 Create a project

Go to https://supabase.com/dashboard and create a new project. Note the **project ref**
(e.g. `iimkmrwcdymuyhmeyate`) — you will use it in every CLI command below.

### 1.2 Set Edge Function secrets

```bash
supabase login
supabase secrets set \
  GEMINI_API_KEY='...' \
  SERPER_API_KEY='...' \
  PAGESPEED_API_KEY='...' \
  RESEND_API_KEY='...' \
  RESEND_FROM_EMAIL='audits@yourdomain.com' \
  APP_URL='https://your-vercel-url' \
  SUPABASE_SERVICE_ROLE_KEY='...' \
  --project-ref <REF>
```

`APP_URL` must match the final Vercel URL. You can set a placeholder now and update it in
step 3.4 after deploying to Vercel.

### 1.3 Apply database migrations

```bash
supabase link --project-ref <REF>
supabase db push
```

This applies the three migrations in `supabase/migrations/` in order:
- `20260513000000_init_schema.sql` — core tables, RLS policies
- `20260514000000_audit_patch_section_rpc.sql` — atomic JSONB merge RPC
- `20260514000001_audit_watchdog.sql` — pg_cron watchdog job

### 1.4 Deploy the Edge Function

```bash
# Convenience script (pinned --no-verify-jwt + project ref):
npm run deploy:fn

# Or invoke the CLI directly:
supabase functions deploy run-audit --no-verify-jwt --project-ref <REF>
```

`--no-verify-jwt` is **required**. The function is internal-only — dispatched server-to-server from Next.js routes with the service-role key, never from a browser. With JWT verification on, the gateway rejects the service-role bearer with 401 and silently strands audits (see [BUG-013](bugs/BUG-013-silent-fire-and-forget-dispatch.md)). `supabase/config.toml` pins `verify_jwt = false` for `run-audit` so any deploy method respects it.

### 1.5 Seed admin access

Run this SQL in the Supabase SQL editor (or via `supabase db execute`):

```sql
insert into admin_emails (email) values ('you@yourdomain.com');
```

This grants access to the `/admin` dashboard for that email address.

---

## 2. Deploy to Vercel

### 2.1 Link the project

```bash
vercel link
```

Pick your scope and project name when prompted.

### 2.2 Push environment variables

Copy all values from your `.env.local` to Vercel production. Sample script:

```bash
for k in \
  APP_URL \
  GEMINI_API_KEY \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  NEXT_PUBLIC_SUPABASE_URL \
  PAGESPEED_API_KEY \
  RESEND_API_KEY \
  RESEND_FROM_EMAIL \
  SERPER_API_KEY \
  SERPER_QUERY_CAP_DEFAULT \
  SUPABASE_SERVICE_ROLE_KEY; do
    v=$(grep "^$k=" .env.local | cut -d= -f2-)
    printf '%s' "$v" | vercel env add "$k" production
done
```

### 2.3 First deploy

```bash
vercel deploy --prod
```

Note the deployment URL (e.g. `https://seo-geo-audit-tool.vercel.app`).

### 2.4 Update APP_URL everywhere

The Edge Function uses `APP_URL` to construct email links. Update it in both places:

```bash
# Vercel
vercel env rm APP_URL production
echo "https://<your-vercel-url>" | vercel env add APP_URL production

# Supabase
supabase secrets set APP_URL=https://<your-vercel-url> --project-ref <REF>
```

Then redeploy to pick up the new value:

```bash
vercel deploy --prod
```

---

## 3. Smoke test

1. Open the live URL and sign in via magic link.
2. Submit `example.com` for an audit.
3. Wait 3–5 minutes — all 6 sections should populate progressively on the report page.
4. Click **Email PDF to me** — the PDF should arrive in your inbox within ~10 seconds.
5. Visit `/admin` (requires the email seeded in step 1.5) — confirm the audit row is visible.

---

## 4. Troubleshooting

### Audit stuck at `running`

The pg_cron watchdog flips stale `running` rows to `failed` within 2 minutes of the last
heartbeat. If the row stays `running` longer, check the cron job is active:

```sql
select * from cron.job where jobname = 'audit-watchdog';
```

If it is not present, re-apply the watchdog migration or trigger it manually:
`select audit_watchdog_sweep();`

### No completion email

The email is sent only if the user's last heartbeat is older than 45 seconds (i.e. the tab was
closed or navigated away before the audit finished). To test: submit an audit, close the tab,
wait for completion. Check Supabase Edge Function logs for `email failed` / `resend send failed`.

### PDF email returns 502

Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in Vercel production env
(`vercel env ls`). Check Resend dashboard for send attempts.

### Edge Function returns failed immediately

```sql
select id, status, last_heartbeat_at, completed_at, error
from audits
where status = 'failed'
order by created_at desc
limit 10;
```

`watchdog_timeout` in `error` means the function ran past the heartbeat window. Check that
`GEMINI_API_KEY`, `SERPER_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set as Supabase secrets.

### Type errors on Edge Function deploy

```bash
deno check supabase/functions/run-audit/index.ts
```

---

## 5. Rollback

| Layer | How |
|---|---|
| Vercel app | `vercel rollback` (CLI or dashboard) |
| Edge Function | Redeploy a previous commit: `git checkout <sha> -- supabase/functions/run-audit && supabase functions deploy run-audit --no-verify-jwt --project-ref <REF>` |
| Database migration | Write a reverse migration file in `supabase/migrations/` and run `supabase db push`. There is no automatic down-migration. |
