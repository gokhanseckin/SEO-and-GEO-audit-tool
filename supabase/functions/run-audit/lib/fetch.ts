export async function fetchText(url: string, timeoutMs = 6000): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEO-GEO-Audit-Bot/1.0' },
      signal: c.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

export async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(`http ${res.status}: ${await res.text()}`);
    return await res.json();
  } finally { clearTimeout(t); }
}
