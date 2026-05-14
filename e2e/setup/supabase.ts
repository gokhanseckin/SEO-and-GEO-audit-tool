/**
 * Creates a Supabase service-role client suitable for Node.js 20 test workers.
 *
 * Node.js < 22 lacks native WebSocket, so @supabase/realtime-js requires the
 * `ws` package to be passed explicitly via the `global.WebSocket` polyfill or
 * the `transport` option on the Realtime client.  We polyfill globally before
 * any import that triggers RealtimeClient initialization.
 */
import { createClient as _createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocketImpl = require('ws');

// Polyfill once — safe to call multiple times (idempotent check).
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

export function createServiceClient() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
