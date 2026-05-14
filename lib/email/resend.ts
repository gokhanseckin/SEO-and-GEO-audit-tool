import { Resend } from 'resend';

let _client: Resend | null = null;

export function resend(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY missing');
    _client = new Resend(key);
  }
  return _client;
}

export function fromAddress(): string {
  const a = process.env.RESEND_FROM_EMAIL;
  if (!a) throw new Error('RESEND_FROM_EMAIL missing');
  return a;
}
