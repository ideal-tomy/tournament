import { describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { Env } from './index';

const admin = 'a'.repeat(64);
const display = 'd'.repeat(64);
function fixture() {
  const first = vi.fn().mockResolvedValue({ event_id: 'cf-rehearsal-001', title: 'sample',
    environment: 'rehearsal', scene: 'idle', scene_payload: '{}', scene_seq: 0, version: 0,
    awaiting_operator: 1, audio_enabled: 0 });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  const env: Env = { DB: { prepare }, ADMIN_API_TOKEN: admin,
    DISPLAY_API_TOKEN: display, ALLOWED_EVENT_IDS: 'cf-rehearsal-001' };
  return { env, first, prepare, bind };
}
function request(token?: string, event = 'cf-rehearsal-001', method = 'GET') {
  return new Request(`https://example.test/api/events/${event}/state`, {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('Cloudflare read-only security boundary', () => {
  it('health does not expose configuration or access the database', async () => {
    const f = fixture();
    const response = await worker.fetch(new Request('https://example.test/api/health'), f.env);
    expect(response.status).toBe(200);
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it.each([undefined, 'wrong-token'])('rejects missing or invalid credentials', async token => {
    const f = fixture();
    expect((await worker.fetch(request(token), f.env)).status).toBe(401);
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('fails closed if credentials are missing or identical', async () => {
    const f = fixture();
    for (const token of ['', admin]) {
      f.env.DISPLAY_API_TOKEN = token;
      expect((await worker.fetch(request(admin), f.env)).status).toBe(503);
    }
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('rejects access to a different event before a database query', async () => {
    const f = fixture();
    expect((await worker.fetch(request(admin, 'another-event'), f.env)).status).toBe(403);
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it.each([[admin, 'admin'], [display, 'display']])('reads with an authorized role', async (token, role) => {
    const f = fixture();
    const response = await worker.fetch(request(token), f.env);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe(role);
    expect(body.state.awaitingOperator).toBe(true);
    expect(body.state.audioEnabled).toBe(false);
    expect(body.state.scenePayload).toEqual({});
    expect(f.bind).toHaveBeenCalledWith('cf-rehearsal-001');
    expect(f.prepare.mock.calls[0][0]).toContain("e.environment = 'rehearsal'");
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each([admin, display])('does not allow writes for either role', async token => {
    const f = fixture();
    const response = await worker.fetch(request(token, 'cf-rehearsal-001', 'POST'), f.env);
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('returns 404 for absent event state', async () => {
    const f = fixture(); f.first.mockResolvedValue(null);
    expect((await worker.fetch(request(admin), f.env)).status).toBe(404);
  });
  it('hides internal database errors', async () => {
    const f = fixture(); f.first.mockRejectedValue(new Error('private SQL details'));
    const response = await worker.fetch(request(admin), f.env);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
});
