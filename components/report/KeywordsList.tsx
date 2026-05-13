'use client';

import { useState } from 'react';
import { Section, Skeleton } from './Section';

export function KeywordsList({ data }: { data?: { selected?: string[]; candidates?: { term: string }[]; user_modified?: boolean } }) {
  const [showAll, setShowAll] = useState(false);
  if (!data?.candidates) return <Section title="Keywords we found" state="skeleton"><Skeleton /></Section>;
  const others = (data.candidates ?? []).filter((c) => !data.selected?.includes(c.term));
  return (
    <Section title="Keywords we found" state="complete">
      <div className="text-sm text-gray-500 mb-2">
        Selected ({data.selected?.length ?? 0}) {data.user_modified && '· you edited the picks'}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(data.selected ?? []).map((t) => (
          <span key={t} className="px-3 py-1 bg-black text-white text-sm rounded-full">{t}</span>
        ))}
      </div>
      {others.length > 0 && (
        <>
          <button className="text-sm underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Hide' : 'Show'} {others.length} other candidates
          </button>
          {showAll && (
            <div className="flex flex-wrap gap-2 mt-3">
              {others.map((c) => (
                <span key={c.term} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{c.term}</span>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
