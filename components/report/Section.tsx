import { ReactNode } from 'react';

export function Section({
  title,
  state,
  errorText,
  children,
}: {
  title: string;
  state: 'skeleton' | 'partial' | 'complete' | 'error';
  errorText?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t pt-8 pb-2">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {state === 'skeleton' && <span className="text-xs text-gray-400 animate-pulse">Loading...</span>}
        {state === 'partial' && <span className="text-xs text-amber-600">Updating...</span>}
        {state === 'error' && <span className="text-xs text-red-600">Error</span>}
      </div>
      {state === 'error' && errorText && (
        <div className="text-sm bg-red-50 border border-red-200 rounded p-3 mb-3">{errorText}</div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}
