import { loadAudit, setStatus, patchSection, getLastHeartbeat } from './lib/db.ts';

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const auditId: string | undefined = body?.audit_id;
  if (!auditId) return new Response('missing audit_id', { status: 400 });

  (async () => {
    try {
      await setStatus(auditId, 'running');
      const audit = await loadAudit(auditId);
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
