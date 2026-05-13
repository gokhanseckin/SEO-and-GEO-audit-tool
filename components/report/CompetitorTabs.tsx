'use client';

import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function CompetitorTabs({ data }: { data?: any }) {
  const [tab, setTab] = useState<'serp' | 'llm'>('serp');
  if (!data) return <Section title="Competitors" state="skeleton"><Skeleton lines={4} /></Section>;
  if (data.error) return <Section title="Competitors" state="error" errorText={data.error}><div /></Section>;

  const overlap = (data.serp_ranked ?? []).filter((s: any) =>
    (data.llm_ranked ?? []).some((l: any) => l.domain === s.domain)
  );

  const rows = tab === 'serp' ? (data.serp_ranked ?? []) : (data.llm_ranked ?? []);

  return (
    <Section title="Competitors" state="complete">
      {overlap.length > 0 && (
        <div className="text-sm text-gray-600 mb-3">
          <strong>{overlap.length}</strong> domains appear in BOTH SERP and LLM results: {overlap.slice(0, 3).map((o: any) => o.domain).join(', ')}{overlap.length > 3 ? '...' : ''}
        </div>
      )}
      <div className="flex gap-2 mb-3 text-sm">
        <button onClick={() => setTab('serp')} className={`px-3 py-1 rounded ${tab === 'serp' ? 'bg-black text-white' : 'bg-gray-100'}`}>
          SERP competitors ({data.serp_ranked?.length ?? 0})
        </button>
        <button onClick={() => setTab('llm')} className={`px-3 py-1 rounded ${tab === 'llm' ? 'bg-black text-white' : 'bg-gray-100'}`}>
          LLM competitors ({data.llm_ranked?.length ?? 0})
        </button>
      </div>
      <ul className="text-sm space-y-1 mb-6">
        {rows.slice(0, 15).map((r: any) => (
          <li key={r.domain} className="flex justify-between">
            <span>{r.domain}</span>
            <span className="text-gray-500">
              {tab === 'serp' ? `${r.appearances} hits · pos ${r.avg_position?.toFixed(1) ?? '—'}` : `${r.appearances} mentions · ${r.cited_urls} cites`}
            </span>
          </li>
        ))}
      </ul>
      {data.enriched?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Top {data.enriched.length} competitors</h3>
          {data.enriched.map((e: any) => (
            <div key={e.domain} className="border rounded p-3">
              <div className="font-medium">{e.domain}</div>
              <div className="text-xs text-gray-500 mb-1">{(e.sources ?? []).join(' + ').toUpperCase()}</div>
              <p className="text-sm">{e.summary}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
