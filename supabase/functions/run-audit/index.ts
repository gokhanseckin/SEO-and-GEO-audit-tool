import { loadAudit, setStatus, patchSection, getLastHeartbeat } from './lib/db.ts';
// runOffsite is wired into the orchestrator in C8 (needs shared SerperBudget)
import { runDescription } from './steps/description.ts';
import { runOnsite } from './steps/onsite.ts';
import { runOffsite } from './steps/offsite.ts';

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const auditId: string | undefined = body?.audit_id;
  if (!auditId) return new Response('missing audit_id', { status: 400 });

  (async () => {
    try {
      await setStatus(auditId, 'running');
      const audit = await loadAudit(auditId);
      await runDescription(audit);
      await runOnsite(audit);
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
