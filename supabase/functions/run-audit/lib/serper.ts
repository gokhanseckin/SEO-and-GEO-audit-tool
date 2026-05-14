export interface SerperResult {
  organic?: { title?: string; link?: string; snippet?: string; position?: number }[];
  knowledgeGraph?: { website?: string; title?: string };
  searchInformation?: { totalResults?: string };
}

const KEY = Deno.env.get('SERPER_API_KEY')!;

export class SerperBudget {
  constructor(public remaining: number) {}
  canSpend(): boolean { return this.remaining > 0; }
  spend(): void { this.remaining -= 1; }
}

export async function serperSearch(query: string, budget: SerperBudget): Promise<SerperResult | null> {
  if (!budget.canSpend()) return null;
  budget.spend();
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) throw new Error(`serper ${res.status}: ${await res.text()}`);
  return await res.json();
}

export function domainFromUrl(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return null; }
}
