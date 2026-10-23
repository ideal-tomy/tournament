/** Minimal structural types for the D1 methods used by this read-only API. */
export interface Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
    };
  };
}

export interface Env {
  DB: Database;
  ADMIN_API_TOKEN?: string;
  DISPLAY_API_TOKEN?: string;
  ALLOWED_EVENT_IDS?: string;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } });
}

async function equalToken(actual: string, expected: string): Promise<boolean> {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encode.encode(actual)),
    crypto.subtle.digest('SHA-256', encode.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

interface StateRecord {
  event_id: string;
  title: string;
  environment: string;
  scene: string;
  scene_payload: string;
  scene_seq: number;
  version: number;
  scene_started_at: string | null;
  awaiting_operator: number;
  current_match_id: string | null;
  presentation_mode: string;
  audio_enabled: number;
  playback: string;
  playback_position_ms: number;
  updated_at: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true, service: 'tournament-rehearsal-api', mode: 'read-only' });
    }
    const route = /^\/api\/events\/([a-zA-Z0-9_-]{1,128})\/state$/.exec(url.pathname);
    if (!route) return json({ error: 'NOT_FOUND' }, 404);
    const allowed = (env.ALLOWED_EVENT_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
    const admin = env.ADMIN_API_TOKEN ?? '';
    const display = env.DISPLAY_API_TOKEN ?? '';
    if (admin.length < 32 || display.length < 32 || admin === display || !allowed.length) {
      return json({ error: 'API_NOT_CONFIGURED' }, 503);
    }
    const token = /^Bearer ([^\s]{1,512})$/.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return json({ error: 'UNAUTHORIZED' }, 401);
    const [isAdmin, isDisplay] = await Promise.all([equalToken(token, admin), equalToken(token, display)]);
    if (!isAdmin && !isDisplay) return json({ error: 'UNAUTHORIZED' }, 401);
    if (!allowed.includes(route[1])) return json({ error: 'FORBIDDEN' }, 403);
    if (request.method !== 'GET') {
      const response = json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    try {
      // One query gives event and show state from the same database snapshot.
      const row = await env.DB.prepare(`SELECT e.title, e.environment, s.*
        FROM events e JOIN event_state s ON s.event_id = e.id
        WHERE e.id = ? AND e.environment = 'rehearsal'`).bind(route[1]).first<StateRecord>();
      if (!row) return json({ error: 'NOT_FOUND' }, 404);
      return json({
        role: isAdmin ? 'admin' : 'display',
        event: { id: row.event_id, title: row.title, environment: row.environment },
        state: {
          scene: row.scene, scenePayload: JSON.parse(row.scene_payload), sceneSeq: row.scene_seq,
          version: row.version, startedAt: row.scene_started_at,
          awaitingOperator: row.awaiting_operator === 1, currentMatchId: row.current_match_id,
          presentationMode: row.presentation_mode, audioEnabled: row.audio_enabled === 1,
          playback: row.playback, playbackPositionMs: row.playback_position_ms, updatedAt: row.updated_at,
        },
      });
    } catch {
      // Database errors can contain SQL or private values; do not return them.
      return json({ error: 'STATE_UNAVAILABLE' }, 503);
    }
  },
};
