import { loadAudit, setStatus, patchSection, getLastHeartbeat } from './lib/db.ts';
import { SerperBudget } from './lib/serper.ts';
import { runDescription } from './steps/description.ts';
import { runOnsite } from './steps/onsite.ts';
import { runOffsite } from './steps/offsite.ts';
import { runGeo } from './steps/geo.ts';
import { runCompetitors } from './steps/competitors.ts';
import { runArticleRecs } from './steps/article-recs.ts';
import { sendCompletionEmail } from './lib/email.ts';

async function maybeSendCompletionEmail(auditId: string): Promise<void> {
  const last = await getLastHeartbeat(auditId);
  if (!last) {
    await sendCompletionEmail(auditId).catch((e) => console.error('email failed', e));
    return;
  }
  const ageMs = Date.now() - new Date(last).getTime();
  if (ageMs > 45_000) {
    await sendCompletionEmail(auditId).catch((e) => console.error('email failed', e));
  }
}

Deno.serve(async (req) => {
  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const auditId: string | undefined = body?.audit_id;
  if (!auditId) return new Response('missing audit_id', { status: 400 });

  (async () => {
    try {
      await setStatus(auditId, 'running');
      const audit = await loadAudit(auditId);
      const budget = new SerperBudget(audit.serper_query_cap);

      // Parallel fanout: description, onsite, offsite, geo
      const geoPromise = runGeo(audit);
      await Promise.all([
        runDescription(audit),
        runOnsite(audit),
        runOffsite(audit, budget),
        geoPromise.then(() => {}),
      ]);
      const { citedUrls } = await geoPromise;

      // Depends on geo: competitors + article recs in parallel
      const audit2 = await loadAudit(auditId);
      await Promise.all([
        runCompetitors(audit2, budget),
        runArticleRecs(audit2, citedUrls),
      ]);

      await setStatus(auditId, 'complete', { completed_at: new Date().toISOString() });
      await maybeSendCompletionEmail(auditId);
    } catch (e) {
      console.error('audit failed', e);
      await setStatus(auditId, 'failed', { error: String(e) }).catch(() => {});
    }
  })();

  return new Response(JSON.stringify({ accepted: true, audit_id: auditId }), {
    headers: { 'Content-Type': 'application/json' }, status: 202,
  });
});
