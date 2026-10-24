import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCloudflareState } from './cloudflareClient';
import { parseCloudflareStateResponse, toCloudflareReadModel } from './cloudflareTypes';

export function stateFixture() {
  return { role: 'display', event: { id: 'cf-rehearsal-001', title: 'Cloudflare接続確認用大会', environment: 'rehearsal' },
    state: { scene: 'idle', scenePayload: { example: 1 }, sceneSeq: 2, version: 3, startedAt: null,
      awaitingOperator: true, currentMatchId: null, presentationMode: 'full', audioEnabled: false,
      playback: 'holding', playbackPositionMs: 0, updatedAt: '2026-10-24T12:00:00.000Z' } };
}
afterEach(() => vi.unstubAllGlobals());
describe('Cloudflare read client and DTO boundary', () => {
  it('maps nullable and camelCase fields without assuming a Supabase EventRow', () => {
    const result = toCloudflareReadModel(parseCloudflareStateResponse(stateFixture()));
    expect(result.state).toMatchObject({ scene_payload: { example: 1 }, scene_seq: 2, version: 3, scene_started_at: null, current_match_id: null });
    expect(result.event).not.toHaveProperty('admin_token');
  });
  it('maps a started match and preserves the D1 string ID', () => {
    const f = stateFixture(); Object.assign(f.state, { startedAt: '2026-10-24T12:00:01Z', currentMatchId: 'd1-match-uuid' });
    expect(toCloudflareReadModel(parseCloudflareStateResponse(f)).state).toMatchObject({ scene_started_at: '2026-10-24T12:00:01Z', current_match_id: 'd1-match-uuid' });
  });
  it.each([{ version: -1 }, { version: '3' }, { sceneSeq: NaN }, { scene: 'unknown' }, { scenePayload: [] }, { audioEnabled: 0 }, { currentMatchId: 2 }, { updatedAt: 'invalid' }])('rejects malformed response %j', change => {
    const f = stateFixture(); Object.assign(f.state, change);
    expect(() => parseCloudflareStateResponse(f)).toThrow('INVALID_STATE_RESPONSE');
  });
  it('rejects the wrong event or live environment', () => {
    const f = stateFixture(); f.event.id = 'another-event'; expect(() => parseCloudflareStateResponse(f)).toThrow();
    f.event.id = 'cf-rehearsal-001'; f.event.environment = 'live'; expect(() => parseCloudflareStateResponse(f)).toThrow();
  });
  it('only issues a local GET with no authorization or cookies', async () => {
    const request = vi.fn().mockResolvedValue(Response.json(stateFixture())); vi.stubGlobal('fetch', request);
    const result = await fetchCloudflareState();
    expect(result.state.version).toBe(3);
    expect(request).toHaveBeenCalledWith('/__cloudflare_check/api/events/cf-rehearsal-001/state', expect.objectContaining({ method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } }));
    await expect(fetchCloudflareState('another')).rejects.toMatchObject({ status: 403 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404, 500, 502, 503, 504])('distinguishes HTTP %i', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream private details', { status })));
    await expect(fetchCloudflareState()).rejects.toMatchObject({ status });
  });
  it('reports missing server configuration separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'CHECK_NOT_CONFIGURED' }, { status: 503 })));
    await expect(fetchCloudflareState()).rejects.toMatchObject({ code: 'CHECK_NOT_CONFIGURED' });
  });
  it('rejects a successful HTML response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SPA fallback</html>')));
    await expect(fetchCloudflareState()).rejects.toMatchObject({ code: 'INVALID_STATE_RESPONSE' });
  });
  it('classifies network failures without leaking fetch error text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network details')));
    await expect(fetchCloudflareState()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  it('times out and cancels the request', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, opts: RequestInit) => new Promise((_resolve, reject) => opts.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))));
    await expect(fetchCloudflareState(undefined, undefined, 5)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
  it('respects component unmount cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(fetchCloudflareState(undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
