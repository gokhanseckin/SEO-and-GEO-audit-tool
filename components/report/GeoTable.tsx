'use client';

import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function GeoTable({ data }: { data?: any }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!data) return <Section title="GEO — Do LLMs recommend you?" state="skeleton"><Skeleton lines={4} /></Section>;
  if (data.error) return <Section title="GEO — Do LLMs recommend you?" state="error" errorText={data.error}><div /></Section>;
  const prompts = data.prompts ?? [];
  return (
    <Section title="GEO — Do LLMs recommend you?" state={data.prompts ? 'partial' : 'skeleton'}>
      <div className="text-lg mb-4">
        Visibility: <strong>{data.visibility_score ?? 0}%</strong>
        <span className="text-gray-500 text-sm ml-2">
          ({prompts.filter((p: any) => p.user_domain_mentioned).length} of {prompts.length} prompts)
        </span>
      </div>
      <div className="border rounded overflow-hidden">
        {prompts.map((p: any, i: number) => (
          <div key={i} className="border-b last:border-b-0">
            <button className="w-full text-left p-3 hover:bg-gray-50" onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="flex justify-between gap-3">
                <div className="text-sm truncate flex-1">{p.prompt}</div>
                <div className="text-sm">
                  {p.user_domain_mentioned ? (
                    <span className="text-green-600">#{p.user_domain_rank ?? '✓'}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 w-32 truncate">
                  {p.competitor_domains?.[0] ?? '—'}
                </div>
              </div>
            </button>
            {expanded === i && (
              <div className="p-3 bg-gray-50 text-sm space-y-2">
                <div className="whitespace-pre-wrap">{p.answer_text}</div>
                {p.cited_urls?.length > 0 && (
                  <div>
                    <div className="font-medium text-xs uppercase text-gray-500 mt-3 mb-1">Cited sources</div>
                    <ul className="space-y-1">
                      {p.cited_urls.map((u: any, j: number) => (
                        <li key={j}>
                          <a href={u.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{u.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
