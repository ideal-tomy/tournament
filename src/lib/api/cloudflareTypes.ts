import type { PresentationMode, Scene } from '../../types';

export const CLOUDFLARE_CHECK_EVENT_ID = 'cf-rehearsal-001';
export const CLOUDFLARE_CHECK_PREFIX = '/__cloudflare_check';

/** A read model, not a Supabase EventRow: the API has no status/admin_token. */
export interface CloudflareStateResponse {
  role: 'display' | 'admin';
  event: { id: string; title: string; environment: 'rehearsal' };
  state: {
    scene: Scene;
    scenePayload: Record<string, unknown>;
    sceneSeq: number;
    version: number;
    startedAt: string | null;
    awaitingOperator: boolean;
    currentMatchId: string | null;
    presentationMode: PresentationMode;
    audioEnabled: boolean;
    playback: 'playing' | 'paused' | 'holding' | 'error';
    playbackPositionMs: number;
    updatedAt: string;
  };
}

const scenes: readonly string[] = ['idle', 'opening', 'draw', 'bracket', 'vs_card', 'match_live', 'result', 'interval', 'award', 'finished'];
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** Reconstruct the contract; do not pass unknown properties to the browser. */
export function parseCloudflareStateResponse(input: unknown, eventId = CLOUDFLARE_CHECK_EVENT_ID): CloudflareStateResponse {
  if (!record(input) || !record(input.event) || !record(input.state)) throw new Error('INVALID_STATE_RESPONSE');
  const e = input.event;
  const s = input.state;
  if (!['admin', 'display'].includes(String(input.role)) || e.id !== eventId || typeof e.title !== 'string' || e.environment !== 'rehearsal'
    || typeof s.scene !== 'string' || !scenes.includes(s.scene) || !record(s.scenePayload)
    || !count(s.sceneSeq) || !count(s.version) || !(s.startedAt === null || timestamp(s.startedAt))
    || !nullableString(s.currentMatchId) || typeof s.awaitingOperator !== 'boolean'
    || typeof s.audioEnabled !== 'boolean' || !['full', 'short', 'lite'].includes(String(s.presentationMode))
    || !['playing', 'paused', 'holding', 'error'].includes(String(s.playback))
    || !count(s.playbackPositionMs) || !timestamp(s.updatedAt)) throw new Error('INVALID_STATE_RESPONSE');
  return {
    role: input.role as CloudflareStateResponse['role'],
    event: { id: e.id as string, title: e.title, environment: 'rehearsal' },
    state: {
      scene: s.scene as Scene, scenePayload: s.scenePayload, sceneSeq: s.sceneSeq, version: s.version,
      startedAt: s.startedAt, awaitingOperator: s.awaitingOperator, currentMatchId: s.currentMatchId,
      presentationMode: s.presentationMode as PresentationMode, audioEnabled: s.audioEnabled,
      playback: s.playback as CloudflareStateResponse['state']['playback'], playbackPositionMs: s.playbackPositionMs,
      updatedAt: s.updatedAt,
    },
  };
}

export function toCloudflareReadModel(response: CloudflareStateResponse) {
  const s = response.state;
  return {
    event: response.event,
    role: response.role,
    state: {
      event_id: response.event.id,
      scene: s.scene, scene_payload: s.scenePayload, scene_seq: s.sceneSeq,
      scene_started_at: s.startedAt, current_match_id: s.currentMatchId, version: s.version,
      awaiting_operator: s.awaitingOperator, presentation_mode: s.presentationMode, audio_enabled: s.audioEnabled,
      playback: s.playback, playback_position_ms: s.playbackPositionMs, updated_at: s.updatedAt,
    },
  };
}
export type CloudflareReadModel = ReturnType<typeof toCloudflareReadModel>;
