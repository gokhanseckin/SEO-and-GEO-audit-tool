import { Section, Skeleton } from './Section';

export function OffsiteCard({ data }: { data?: any }) {
  if (!data) return <Section title="Off-site signals" state="skeleton"><Skeleton lines={3} /></Section>;
  if (data.error) return <Section title="Off-site signals" state="error" errorText={data.error}><div /></Section>;
  return (
    <Section title="Off-site signals" state="complete">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <Stat label="Domain age" value={data.domain_age_days != null ? `${Math.round(data.domain_age_days / 365 * 10) / 10} yrs` : '—'} />
        <Stat label="HTTPS" value={data.https ? 'Yes' : 'No'} />
        <Stat label="Indexed pages" value={data.indexed_pages_estimate ?? '—'} />
        <Stat label="Brand SERP mentions" value={data.brand_serp_mentions ?? 0} />
      </div>
      <div>
        <h3 className="font-medium mb-2">Directory presence</h3>
        <ul className="text-sm space-y-1">
          {(data.directory_presence ?? []).map((d: any) => (
            <li key={d.name}>
              {d.found ? '✓' : '✗'} {d.name}
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline">view</a>}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
