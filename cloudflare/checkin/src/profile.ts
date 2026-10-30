import type { CheckinEnv } from './domain';
import type { RehearsalTimingPreset } from '../../../src/lib/rehearsalTiming';
export async function eventProfile(env: CheckinEnv) {
  const row = await env.DB.prepare('SELECT format,subtitle FROM events WHERE id=?').bind(env.CHECKIN_EVENT_ID).first<{format:string;subtitle:string|null}>();
  let timingPreset: RehearsalTimingPreset = 'show';
  try { if (JSON.parse(row?.subtitle ?? '{}').rehearsalTiming === 'fast') timingPreset = 'fast'; } catch { /* older human-readable subtitles */ }
  return { format: row?.format ?? 'double_elimination', timingPreset };
}
