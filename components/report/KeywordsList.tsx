'use client';

import { useState } from 'react';
import { Section } from './Section';
import { Icon } from '@/components/ds/Icon';

type KW = { term: string; type?: string };
type Data = {
  selected?: string[];
  candidates?: KW[];
  user_modified?: boolean;
  error?: string;
};

function typeShort(t?: string) {
  if (t === 'long-tail') return 'long';
  if (t === 'question') return 'q';
  return 'head';
}

export function KeywordsList({ data }: { data?: Data }) {
  const [showCands, setShowCands] = useState(false);
  const state = !data ? 'skeleton' : data.error ? (data.candidates ? 'partial' : 'error') : 'complete';
  const candidates = data?.candidates ?? [];
  const selectedTerms = new Set(data?.selected ?? []);
  const selectedKW = candidates.filter((c) => selectedTerms.has(c.term));
  const others = candidates.filter((c) => !selectedTerms.has(c.term));

  return (
    <Section
      num="02"
      title="Keywords we found"
      sub="What we measure visibility against. Your selection is what feeds the GEO prompt set."
      state={state}
      errorText={data?.error}
      anchor="sec-keywords"
      tag={data?.user_modified ? <span className="chip chip-info">USER-MODIFIED</span> : null}
      skeleton={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[140, 180, 110, 200, 150, 130, 170, 90, 160].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 26, borderRadius: 999 }} />
          ))}
        </div>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {selectedKW.length === 0 && (data?.selected ?? []).length > 0 ? (
          // selected list exists but candidates list missing — render raw strings
          (data?.selected ?? []).map((term) => (
            <span key={term} className="pill selected" style={{ height: 30, fontSize: 13 }}>
              {term}
            </span>
          ))
        ) : (
          selectedKW.map((k) => (
            <span key={k.term} className="pill selected" style={{ height: 30, fontSize: 13 }}>
              {k.term}
              <span className="tag" style={{ marginLeft: 4 }}>
                {typeShort(k.type)}
              </span>
            </span>
          ))
        )}
      </div>

      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowCands((s) => !s)}
            className="btn btn-ghost btn-sm"
            style={{ padding: 0, gap: 6 }}
          >
            <Icon.chevron
              style={{ transform: showCands ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
            />
            Other candidates · {others.length}
          </button>
          {showCands && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {others.map((k) => (
                <span key={k.term} className="pill ghost" style={{ height: 30, fontSize: 13 }}>
                  {k.term}
                  <span className="tag">{typeShort(k.type)}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
