import { Section, Skeleton } from './Section';

export function ArticleRecsGrid({ data }: { data?: any }) {
  if (!data) return <Section title="Article topics to write" state="skeleton"><Skeleton lines={6} /></Section>;
  if ((data as any).error) return <Section title="Article topics to write" state="error" errorText={(data as any).error}><div /></Section>;
  const recs: any[] = Array.isArray(data) ? data : [];
  return (
    <Section title="Article topics to write" state="complete">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recs.map((r, i) => (
          <div key={i} className="border rounded p-4">
            <h3 className="font-medium mb-1">{r.title}</h3>
            <div className="text-xs text-gray-500 mb-2">Target: <strong>{r.target_keyword}</strong></div>
            <p className="text-sm text-gray-700 mb-2">{r.angle}</p>
            <p className="text-xs text-gray-600 mb-2"><strong>Why it'd rank:</strong> {r.why_it_ranks}</p>
            {r.source_urls?.length > 0 && (
              <div className="text-xs">
                Inspired by:{' '}
                {r.source_urls.slice(0, 2).map((u: string, j: number) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer" className="text-blue-600 underline mr-2">
                    {new URL(u).host}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
