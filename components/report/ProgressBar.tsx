const EXPECTED = ['description', 'keywords', 'onsite', 'offsite', 'geo', 'competitors', 'article_recommendations'];

export function ProgressBar({ sections }: { sections: Record<string, unknown> }) {
  const have = EXPECTED.filter((k) => k in sections).length;
  const pct = Math.round((have / EXPECTED.length) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Audit progress</span>
        <span>{have} / {EXPECTED.length}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
