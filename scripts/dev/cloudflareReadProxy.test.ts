import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudflareReadMiddleware, readProxyConfig } from './cloudflareReadProxy';

const token = 'test-display-only-key-'.repeat(3);
const route = '/__cloudflare_check/api/events/cf-rehearsal-001/state';
function fixture() {
  return { role: 'display', event: { id: 'cf-rehearsal-001', title: 'Cloudflare接続確認用大会', environment: 'rehearsal' },
    state: { scene: 'idle', scenePayload: {}, sceneSeq: 0, version: 0, startedAt: null, awaitingOperator: true,
      currentMatchId: null, presentationMode: 'full', audioEnabled: false, playback: 'holding', playbackPositionMs: 0, updatedAt: '2026-10-24T12:00:00Z' } };
}
const servers: Server[] = [];
const tempDirectories: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>(resolve => s.close(() => resolve())); }
  for (const dir of tempDirectories.splice(0)) {
    const target = realpathSync(dir);
    if (dirname(target).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(target).startsWith('tournament-read-proxy-')) throw new Error('Unsafe test cleanup target');
    rmSync(target, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
});
function configDirectory(origin: string, override?: string) {
  vi.stubEnv('CF_CHECK_WORKER_ORIGIN', undefined); vi.stubEnv('CF_CHECK_DISPLAY_API_TOKEN', undefined);
  const dir = mkdtempSync(join(tmpdir(), 'tournament-read-proxy-')); tempDirectories.push(dir);
  mkdirSync(join(dir, 'cloudflare'));
  writeFileSync(join(dir, 'cloudflare/.dev.vars'), `DISPLAY_API_TOKEN=${token}\n`);
  writeFileSync(join(dir, '.env.cloudflare-check.local'), `CF_CHECK_WORKER_ORIGIN=${origin}\n${override ? `CF_CHECK_DISPLAY_API_TOKEN=${override}\n` : ''}`);
  return dir;
}
async function setup(response: () => Promise<Response> = async () => Response.json(fixture()), configured = true) {
  const upstream = vi.fn(response);
  const middleware = cloudflareReadMiddleware(() => configured ? { origin: 'https://tournament-rehearsal.example.workers.dev', token } : null, upstream as typeof fetch);
  const s = createServer((req, res) => { void middleware(req, res, () => { res.writeHead(404); res.end(); }); });
  servers.push(s);
  await new Promise<void>(resolve => s.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, upstream };
}
describe('localhost-only Cloudflare read proxy', () => {
  it('reads the existing private Display key without requiring a duplicate', () => {
    const dir = configDirectory('https://tournament-rehearsal.example.workers.dev');
    expect(readProxyConfig(dir)).toEqual({ origin: 'https://tournament-rehearsal.example.workers.dev', token });
  });
  it('allows a separate remote key in the ignored private check configuration', () => {
    const remote = 'different-remote-display-key-'.repeat(3);
    const dir = configDirectory('https://tournament-rehearsal.example.workers.dev', remote);
    expect(readProxyConfig(dir)?.token).toBe(remote);
  });
  it.each(['http://127.0.0.1:8787', 'https://example.org', 'https://tournament-rehearsal.example.workers.dev/other', 'https://tournament-rehearsal.example.workers.dev?target=x'])('rejects unsafe configured origins %s', origin => {
    expect(readProxyConfig(configDirectory(origin))).toBeNull();
  });
  it('adds Display authorization only on the server and strips unknown fields', async () => {
    const f = await setup(async () => Response.json({ ...fixture(), hidden: token }));
    const r = await fetch(f.url + route, { headers: { Authorization: 'Bearer client-controlled' } });
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain(token);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(f.upstream).toHaveBeenCalledWith('https://tournament-rehearsal.example.workers.dev/api/events/cf-rehearsal-001/state', expect.objectContaining({ method: 'GET', redirect: 'error', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }));
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])('rejects %s before upstream access', async method => {
    const f = await setup(); expect((await fetch(f.url + route, { method })).status).toBe(405); expect(f.upstream).not.toHaveBeenCalled();
  });
  it.each([route + '?target=https://example.org', '/__cloudflare_check/api/events/other/state', '/__cloudflare_check/api/health', route + '/extra'])('rejects paths and queries: %s', async path => {
    const f = await setup(); expect((await fetch(f.url + path)).status).toBe(403); expect(f.upstream).not.toHaveBeenCalled();
  });
  it.each<[Record<string, string>]>([[{ Origin: 'https://example.org' }], [{ Host: 'evil.example' }], [{ 'Sec-Fetch-Site': 'cross-site' }]])('rejects non-local origins / DNS rebinding: %j', async headers => {
    const f = await setup();
    // Undici fetch normalizes Host; raw HTTP is required to exercise DNS rebinding.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const r = httpRequest(f.url + route, { headers }, response => { response.resume(); resolve(response.statusCode); });
      r.on('error', reject); r.end();
    });
    expect(status).toBe(403); expect(f.upstream).not.toHaveBeenCalled();
  });
  it('reports missing settings without contacting the Worker', async () => {
    const f = await setup(undefined, false); const r = await fetch(f.url + route);
    expect(r.status).toBe(503); expect(await r.json()).toEqual({ error: 'CHECK_NOT_CONFIGURED' }); expect(f.upstream).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 500, 503])('preserves HTTP %i while hiding error bodies', async status => {
    const f = await setup(async () => new Response(token, { status })); const r = await fetch(f.url + route);
    expect(r.status).toBe(status); expect(await r.text()).not.toContain(token);
  });
  it('rejects admin responses', async () => {
    const f = await setup(async () => Response.json({ ...fixture(), role: 'admin' }));
    expect((await fetch(f.url + route)).status).toBe(502);
  });
  it('rejects a credential accidentally present in scene_payload', async () => {
    const body = fixture(); Object.assign(body.state.scenePayload, { unexpected: token });
    const f = await setup(async () => Response.json(body)); const r = await fetch(f.url + route);
    expect(r.status).toBe(502); expect(await r.text()).not.toContain(token);
  });
  it('rejects HTML success without relaying it', async () => {
    const f = await setup(async () => new Response('<html>private</html>')); const r = await fetch(f.url + route);
    expect(r.status).toBe(502); expect(await r.json()).toEqual({ error: 'INVALID_STATE_RESPONSE' });
  });
  it('hides fetch exception details and handles timeout', async () => {
    const f = await setup(async () => { throw new Error(token); });
    expect(await (await fetch(f.url + route)).json()).toEqual({ error: 'UPSTREAM_UNAVAILABLE' });
    const t = await setup(async () => { throw new DOMException('timeout', 'TimeoutError'); });
    expect((await fetch(t.url + route)).status).toBe(504);
  });
});
