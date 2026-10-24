import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { CLOUDFLARE_CHECK_EVENT_ID, CLOUDFLARE_CHECK_PREFIX, parseCloudflareStateResponse } from '../../src/lib/api/cloudflareTypes';

interface ProxyConfig { origin: string; token: string }
function privateEnv(path: string): Record<string, string | undefined> {
  try { return parseEnv(readFileSync(path, 'utf8')); } catch { return {}; }
}
export function readProxyConfig(root: string): ProxyConfig | null {
  const local = privateEnv(join(root, '.env.cloudflare-check.local'));
  const vars = privateEnv(join(root, 'cloudflare/.dev.vars'));
  const origin = process.env.CF_CHECK_WORKER_ORIGIN ?? local.CF_CHECK_WORKER_ORIGIN;
  const token = process.env.CF_CHECK_DISPLAY_API_TOKEN ?? local.CF_CHECK_DISPLAY_API_TOKEN ?? vars.DISPLAY_API_TOKEN;
  // Exact service name and HTTPS workers.dev origin; no user-supplied URL or local upstream.
  if (!origin || !/^https:\/\/tournament-rehearsal\.[a-z0-9-]+\.workers\.dev$/.test(origin)
    || !token || token.length < 32 || /\s/.test(token)) return null;
  return { origin, token };
}
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function isLocalRequest(req: IncomingMessage): boolean {
  if (!loopback.has(req.socket.remoteAddress ?? '')) return false;
  const port = req.socket.localPort;
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  if (!hosts.includes(req.headers.host ?? '')) return false;
  if (req.headers.origin && !hosts.map(host => `http://${host}`).includes(req.headers.origin)) return false;
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site']))) return false;
  return true;
}
function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' });
  res.end(JSON.stringify(body));
}
export function cloudflareReadMiddleware(config: () => ProxyConfig | null, request: typeof fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!(req.url ?? '').startsWith(CLOUDFLARE_CHECK_PREFIX)) { next(); return; }
    if (!isLocalRequest(req)) { reply(res, 403, { error: 'LOCAL_ACCESS_ONLY' }); return; }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); reply(res, 405, { error: 'READ_ONLY' }); return; }
    if (req.url !== `${CLOUDFLARE_CHECK_PREFIX}/api/events/${CLOUDFLARE_CHECK_EVENT_ID}/state`) { reply(res, 403, { error: 'CHECK_ROUTE_FORBIDDEN' }); return; }
    const settings = config();
    if (!settings) { reply(res, 503, { error: 'CHECK_NOT_CONFIGURED' }); return; }
    try {
      const upstream = await request(`${settings.origin}/api/events/${CLOUDFLARE_CHECK_EVENT_ID}/state`, {
        method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${settings.token}` },
        redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        const status = [401, 403, 404, 500, 502, 503, 504].includes(upstream.status) ? upstream.status : 502;
        reply(res, status, { error: 'UPSTREAM_READ_FAILED' }); return;
      }
      let state;
      try { state = parseCloudflareStateResponse(await upstream.json()); }
      catch { reply(res, 502, { error: 'INVALID_STATE_RESPONSE' }); return; }
      // Do not pass admin responses or accidental echoed credentials through this development bridge.
      if (state.role !== 'display' || JSON.stringify(state).includes(settings.token)) { reply(res, 502, { error: 'INVALID_STATE_RESPONSE' }); return; }
      reply(res, 200, state);
    } catch (error) {
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      reply(res, timeout ? 504 : 502, { error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE' });
    }
  };
}

/** Dev-only plugin. Never mounted in builds or `vite preview`. */
export function cloudflareReadProxy(): Plugin {
  return {
    name: 'local-cloudflare-read-check', apply: 'serve',
    configureServer(server) {
      server.middlewares.use(cloudflareReadMiddleware(() => readProxyConfig(server.config.root)));
    },
  };
}
