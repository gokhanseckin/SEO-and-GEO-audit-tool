import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEmail = vi.fn().mockResolvedValue({ data: { id: 'msg_1' }, error: null });

vi.mock('@/lib/email/resend', () => ({
  resend: () => ({ emails: { send: mockSendEmail } }),
  fromAddress: () => 'audits@example.com',
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1', email: 'me@me.com' } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 'a1',
              user_id: 'u1',
              status: 'complete',
              sections: {},
              domain: 'x.com',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn(async () => Buffer.from('mock-pdf')),
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
}));

describe('POST /api/audits/[id]/send-pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders PDF and sends via Resend', async () => {
    const { POST } = await import('@/app/api/audits/[id]/send-pdf/route');
    const req = new Request('http://localhost/api/audits/a1/send-pdf', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message_id).toBe('msg_1');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('returns 409 when audit not complete', async () => {
    // Override single() to return pending status
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: 'u1', email: 'me@me.com' } } }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'a1',
                  user_id: 'u1',
                  status: 'running',
                  sections: {},
                  domain: 'x.com',
                  created_at: new Date().toISOString(),
                  completed_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));
    // Reset module cache so route picks up new mock
    vi.resetModules();
    vi.mock('@/lib/email/resend', () => ({
      resend: () => ({ emails: { send: mockSendEmail } }),
      fromAddress: () => 'audits@example.com',
    }));
    vi.mock('@react-pdf/renderer', () => ({
      renderToBuffer: vi.fn(async () => Buffer.from('mock-pdf')),
      Document: ({ children }: any) => children,
      Page: ({ children }: any) => children,
      Text: ({ children }: any) => children,
      View: ({ children }: any) => children,
      StyleSheet: { create: (s: any) => s },
    }));
    const { POST } = await import('@/app/api/audits/[id]/send-pdf/route');
    const req = new Request('http://localhost/api/audits/a1/send-pdf', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(409);
  });
});
