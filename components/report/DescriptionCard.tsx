import { Section, Skeleton } from './Section';

export function DescriptionCard({ data }: { data?: { blurb?: string; error?: string } }) {
  if (!data) return <Section title="What is this domain?" state="skeleton"><Skeleton /></Section>;
  if (data.error) return <Section title="What is this domain?" state="error" errorText={data.error}><div /></Section>;
  return (
    <Section title="What is this domain?" state="complete">
      <p className="text-lg text-gray-700">{data.blurb}</p>
    </Section>
  );
}
