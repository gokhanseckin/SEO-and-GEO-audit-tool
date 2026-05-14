import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn();
const fromSelectSingleMock = vi.fn();
const fromUpdateEqMock = vi.fn();
const globalFetchSpy = vi.spyOn(global, 'fetch');

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ single: fromSelectSingleMock }) }),
      update: (_payload: any) => ({ eq: fromUpdateEqMock }),
    }),
  }),
}));

describe('POST /api/audits/[id]/retry', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromSelectSingleMock.mockReset();
    fromUpdateEqMock.mockReset();
    globalFetchSpy.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk_test';
  });

  async function callRoute(id: string) {
    const { POST } = await import('@/app/api/audits/[id]/retry/route');
    const req = new Request(`http://localhost/api/audits/${id}/retry`, { method: 'POST' });
    return POST(req as any, { params: Promise.resolve({ id }) });
  }

  it('returns 401 without user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await callRoute('a1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when audit not found', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    fromSelectSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await callRoute('a1');
    expect(res.status).toBe(404);
  });

  it('returns 403 when audit belongs to another user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    fromSelectSingleMock.mockResolvedValue({ data: { id: 'a1', user_id: 'u2', status: 'failed' }, error: null });
    const res = await callRoute('a1');
    expect(res.status).toBe(403);
  });

  it('returns 409 when audit is not failed', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    fromSelectSingleMock.mockResolvedValue({ data: { id: 'a1', user_id: 'u1', status: 'complete' }, error: null });
    const res = await callRoute('a1');
    expect(res.status).toBe(409);
  });

  it('resets and dispatches on success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    fromSelectSingleMock.mockResolvedValue({ data: { id: 'a1', user_id: 'u1', status: 'failed' }, error: null });
    fromUpdateEqMock.mockResolvedValue({ data: null, error: null });
    globalFetchSpy.mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 202 }));
    const res = await callRoute('a1');
    expect(res.status).toBe(200);
    expect(globalFetchSpy).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/run-audit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer sk_test', 'Content-Type': 'application/json' }),
        body: JSON.stringify({ audit_id: 'a1' }),
      })
    );
  });
});
