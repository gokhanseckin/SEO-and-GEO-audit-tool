import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase helpers
const mockUser = { id: 'user-1' };
const mockProfile = { role: 'user' };
const mockSupabase: any = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
  createServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/crawl/fetcher', () => ({
  crawlSite: vi.fn().mockResolvedValue({
    homepage: { url: 'https://example.com/', html: '<title>X</title><body>hello world</body>' },
    pages: [],
  }),
}));

vi.mock('@/lib/llm/gemini', () => ({
  geminiProvider: {
    extractKeywords: vi.fn().mockResolvedValue([
      { term: 'k1', relevance: 0.9, type: 'head' },
      { term: 'k2', relevance: 0.5, type: 'long-tail' },
    ]),
  },
}));

import { POST } from '@/app/api/audits/start/route';

function chain(returnValue: any, options: { inReturnValue?: any } = {}) {
  const c: any = {};
  c.select = () => c; c.eq = () => c; c.order = () => c; c.limit = () => c;
  // `.in()` is used by the same-domain dedup query in /api/audits/start.
  // Default: returns a sub-chain that resolves with null (no pending dup).
  c.in = () => {
    const inChain: any = {};
    inChain.select = () => inChain; inChain.eq = () => inChain;
    inChain.in = () => inChain; inChain.order = () => inChain; inChain.limit = () => inChain;
    inChain.maybeSingle = () => Promise.resolve({ data: options.inReturnValue ?? null, error: null });
    inChain.single = () => Promise.resolve({ data: options.inReturnValue ?? null, error: null });
    return inChain;
  };
  c.maybeSingle = () => Promise.resolve({ data: returnValue, error: null });
  c.single = () => Promise.resolve({ data: returnValue, error: null });
  c.insert = (row: any) => ({ select: () => ({ single: () => Promise.resolve({ data: { ...row, id: 'audit-1' }, error: null }) }) });
  return c;
}

describe('POST /api/audits/start', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
  });

  it('returns 401 when no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid domain', async () => {
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'not a domain' }),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when user already has an audit (non-admin)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return chain(mockProfile);
      if (table === 'audits') return chain({ id: 'existing-1' });
      return chain(null);
    });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.existing_audit_id).toBe('existing-1');
  });

  it('happy path creates audit and returns id', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return chain(mockProfile);
      if (table === 'audits') return chain(null);
      return chain(null);
    });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audit_id).toBe('audit-1');
  });

  it('dedups: returns existing audit id when same-domain pending audit exists (closes BUG-006)', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return chain(mockProfile);
      if (table === 'audits') return chain(null, { inReturnValue: { id: 'pending-dup-1', status: 'pending' } });
      return chain(null);
    });
    const res = await POST(new Request('http://localhost/api/audits/start', {
      method: 'POST', body: JSON.stringify({ domain: 'example.com' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audit_id).toBe('pending-dup-1');
  });
});
