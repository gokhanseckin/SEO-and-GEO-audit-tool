import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn();
const selectSingleMock = vi.fn();
const updateEqMock = vi.fn();
const updateSpy = vi.fn(() => ({ eq: updateEqMock }));
const globalFetchSpy = vi.spyOn(global, 'fetch');

const svc = {
  from: (_table: string) => ({
    select: () => ({ eq: () => ({ single: selectSingleMock }) }),
    update: updateSpy,
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
  createServiceClient: () => svc,
}));

async function callRoute(id: string, body: unknown) {
  const { POST } = await import('@/app/api/audits/[id]/run/route');
  const req = new Request(`http://localhost/api/audits/${id}/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

const VALID_BODY = { selected_keywords: ['k1'], user_modified: false };

describe('POST /api/audits/[id]/run — dispatch error handling', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    selectSingleMock.mockReset();
    updateEqMock.mockReset();
    updateSpy.mockClear();
    globalFetchSpy.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk_test';
  });

  function happyPathSetup() {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    selectSingleMock.mockResolvedValue({
      data: { id: 'a1', user_id: 'u1', status: 'pending', sections: { keywords: {} } },
      error: null,
    });
    updateEqMock.mockResolvedValue({ data: null, error: null });
  }

  it('returns 202 when dispatch is accepted', async () => {
    happyPathSetup();
    globalFetchSpy.mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 202 }));
    const res = await callRoute('a1', VALID_BODY);
    expect(res.status).toBe(202);
  });

  it('marks audit failed and returns 502 when dispatch returns non-ok', async () => {
    happyPathSetup();
    globalFetchSpy.mockResolvedValue(new Response('Invalid JWT', { status: 401 }));
    const res = await callRoute('a1', VALID_BODY);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('dispatch_failed');
    expect(json.status).toBe(401);
    // Expect two update calls: once to set status=running, once to reset to failed.
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy.mock.calls[1][0]).toMatchObject({ status: 'failed' });
    expect(updateSpy.mock.calls[1][0].error).toMatch(/edge_dispatch_401/);
  });

  it('marks audit failed and returns 502 when dispatch network-errors', async () => {
    happyPathSetup();
    globalFetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    const res = await callRoute('a1', VALID_BODY);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('dispatch_failed');
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy.mock.calls[1][0].error).toMatch(/edge_dispatch_network/);
  });
});
