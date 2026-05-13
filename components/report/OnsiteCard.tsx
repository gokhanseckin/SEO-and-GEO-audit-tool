import { Section, Skeleton } from './Section';

export function OnsiteCard({ data }: { data?: any }) {
  if (!data) return <Section title="Onsite SEO" state="skeleton"><Skeleton lines={5} /></Section>;
  if (data.error) return <Section title="Onsite SEO" state="error" errorText={data.error}><div /></Section>;
  const lh = data.lighthouse ?? {};
  const cwv = lh.cwv ?? {};
  return (
    <Section title="Onsite SEO" state="complete">
      <div className="grid grid-cols-4 gap-3 mb-6 text-center">
        {['performance', 'accessibility', 'best_practices', 'seo'].map((k) => (
          <div key={k} className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500">{k.replace('_', ' ')}</div>
            <div className="text-2xl font-semibold">{lh[k] ?? '—'}</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-600 mb-4">
        CWV — LCP: {cwv.lcp_ms ? `${Math.round(cwv.lcp_ms)} ms` : '—'} ·
        CLS: {cwv.cls?.toFixed(2) ?? '—'} ·
        INP: {cwv.inp_ms ? `${Math.round(cwv.inp_ms)} ms` : '—'}
      </div>
      <div>
        <h3 className="font-medium mb-2">Issues ({data.issues?.length ?? 0})</h3>
        <ul className="text-sm space-y-1">
          {(data.issues ?? []).slice(0, 20).map((i: any, idx: number) => (
            <li key={idx} className="flex gap-2">
              <span className={
                i.severity === 'high' ? 'text-red-600' :
                i.severity === 'med' ? 'text-amber-600' : 'text-gray-500'
              }>●</span>
              <span>{i.message}</span>
              <span className="text-gray-400">— {new URL(i.page).pathname}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
