import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn((_path: string) => { throw new Error('REDIRECT'); });
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe('requireAdmin', () => {
  beforeEach(() => { redirectMock.mockClear(); getUserMock.mockReset(); fromMock.mockReset(); });

  it('redirects unauthenticated users to /?next=/admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireAdmin } = await import('@/lib/admin/guard');
    await expect(requireAdmin()).rejects.toThrow('REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/?next=/admin');
  });

  it('redirects non-admin users to /', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'random@x.com' } } });
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) });
    const { requireAdmin } = await import('@/lib/admin/guard');
    await expect(requireAdmin()).rejects.toThrow('REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('returns user info for admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'admin@x.com' } } });
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { email: 'admin@x.com' } }) }) }) });
    const { requireAdmin } = await import('@/lib/admin/guard');
    const result = await requireAdmin();
    expect(result).toEqual({ userId: 'u1', email: 'admin@x.com' });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
