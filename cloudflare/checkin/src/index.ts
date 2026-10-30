import { AUTOMATED_CAMERA_TEST_ID, ClientError, hash, imageTypes, readBody, response, validKey, type CheckinEnv } from './domain';
import { drawRoute, preparePairs } from './draw';
import { lifecycleRoute, drainCleanup } from './lifecycle';
import { rehearsalRoute, selectRehearsalRun } from './rehearsal';
export type { CheckinEnv } from './domain';
const COOKIE = '__Host-tournament-checkin';
const SESSION_SECONDS = 8 * 60 * 60;
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
function secure(result: Response): Response {
  const headers = new Headers(result.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Content-Security-Policy', csp);
  headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(result.body, { status: result.status, headers });
}
const encode = new TextEncoder();
async function equal(left: string, right: string) {
  const [a, b] = await Promise.all([hash(left), hash(right)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encode.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encode.encode(payload)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function session(request: Request, env: CheckinEnv) {
  const value = (request.headers.get('Cookie') ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? '';
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(value);
  if (!match || !env.SESSION_SECRET) return false;
  const expires = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + SESSION_SECONDS + 60) return false;
  return equal(match[2], await signature(`${env.CHECKIN_EVENT_ID}:${match[1]}`, env.SESSION_SECRET));
}
async function route(request: Request, env: CheckinEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' && request.method === 'GET') return response({ ok: true, service: 'tournament-checkin-rehearsal' });
  if (!url.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(request.method)) return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.pathname === '/' && env.REHEARSAL_ENABLED !== '1') return Response.redirect(url.origin + '/checkin', 302);
    if (['/', '/checkin', '/display', '/admin', '/show-preview','/rehearsal','/match-transition','/cloudflare-check'].includes(url.pathname)) return env.ASSETS.fetch(new Request(url.origin + '/index.html', { method: request.method }));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/tournament-effects/')) return env.ASSETS.fetch(request);
    return response({ error: 'NOT_FOUND' }, 404);
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || !env.REHEARSAL_ACCESS_CODE || env.REHEARSAL_ACCESS_CODE.length < 16 || !/^[a-zA-Z0-9_-]{1,128}$/.test(env.CHECKIN_EVENT_ID)) return response({ error: 'NOT_CONFIGURED' }, 503);
  if (!['GET', 'HEAD'].includes(request.method) && (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return response({ error: 'FORBIDDEN' }, 403);
  if (url.pathname === '/api/session' && request.method === 'POST') {
    const body = await readBody(request, 1024);
    if (typeof body.code !== 'string' || body.code.length > 128 || !await equal(body.code, env.REHEARSAL_ACCESS_CODE)) return response({ error: 'UNAUTHORIZED' }, 401);
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const token = `${expires}.${await signature(`${env.CHECKIN_EVENT_ID}:${expires}`, env.SESSION_SECRET)}`;
    const result = response({ authenticated: true });
    result.headers.set('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`);
    return result;
  }
  if (!await session(request, env)) return response({ error: 'UNAUTHORIZED' }, 401);
  if (url.pathname === '/api/session' && request.method === 'GET') return response({ authenticated: true });
  if (url.pathname === '/api/session' && request.method === 'DELETE') {
    const result = response({ authenticated: false });
    result.headers.set('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return result;
  }
  if(url.pathname.startsWith('/api/rehearsal/')&&url.pathname!=='/api/rehearsal/status'){
    const rehearsal=await rehearsalRoute(request,env);if(rehearsal)return rehearsal;
  }
  env=await selectRehearsalRun(request,env);
  if(url.pathname==='/api/rehearsal/status'){const rehearsal=await rehearsalRoute(request,env);if(rehearsal)return rehearsal;}
  const draw = await drawRoute(request, env);
  if (draw) return draw;
  const lifecycle = await lifecycleRoute(request, env);
  if (lifecycle) {
    if (url.pathname === '/api/checkin/close' && request.method === 'POST' && lifecycle.ok) await preparePairs(env);
    return lifecycle;
  }
  const canonical = /^\/api\/events\/([a-zA-Z0-9_-]{1,128})\/participants\/(checkin-[a-f0-9-]{36})\/portrait$/.exec(url.pathname);
  const legacy = /^\/api\/participants\/(checkin-[a-f0-9-]{36})\/photo$/.exec(url.pathname);
  const participantId = canonical?.[2] ?? legacy?.[1];
  if (participantId && request.method === 'GET') {
    if (canonical && canonical[1] !== env.CHECKIN_EVENT_ID) return response({ error: 'NOT_FOUND' }, 404);
    if (canonical && participantId === AUTOMATED_CAMERA_TEST_ID && url.searchParams.get('includeTestData') !== '1') return response({ error: 'TEST_PHOTO_EXCLUDED' }, 404);
    const row = await env.DB.prepare(`SELECT p.photo_path FROM participants p JOIN events e ON e.id = p.event_id
      WHERE p.id = ? AND e.id = ? AND e.environment = 'rehearsal' AND p.note LIKE 'checkin-v1:%' AND p.status = 'entered'`).bind(participantId, env.CHECKIN_EVENT_ID).first<{ photo_path: string }>();
    if (!row) return response({ error: 'NOT_FOUND' }, 404);
    if (!validKey(row.photo_path, env.CHECKIN_EVENT_ID, participantId)) return response({ error: 'NOT_FOUND' }, 404);
    const object = await env.PORTRAITS.get(row.photo_path);
    if (!object?.body) return response({ error: 'PHOTO_UNAVAILABLE' }, 404);
    const contentType = object.httpMetadata?.contentType;
    if (!contentType || !Object.values(imageTypes).includes(contentType as typeof imageTypes[keyof typeof imageTypes])) return response({ error: 'INVALID_STORED_PHOTO' }, 503);
    const headers = new Headers({ 'Content-Type': contentType });
    if (object.size !== undefined) headers.set('Content-Length', String(object.size));
    return new Response(object.body, { headers });
  }
  return response({ error: 'NOT_FOUND' }, 404);
}
export default {
  async scheduled(_event: unknown, env: CheckinEnv) { await drainCleanup(env); },
  async fetch(request: Request, env: CheckinEnv): Promise<Response> {
    try { return secure(await route(request, env)); }
    catch (error) {
      if (error instanceof ClientError) return secure(response({ error: error.code, details: error.details }, error.status));
      return secure(response({ error: 'SERVICE_UNAVAILABLE' }, 503));
    }
  },
};
