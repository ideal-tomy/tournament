import type { CheckinEnv } from './domain';
import type { RehearsalTimingPreset } from '../../../src/lib/rehearsalTiming';
export interface OpeningImage { key: string; contentType: string; version: string }
export function openingFromTheme(theme: string | null | undefined): OpeningImage | null {
  try {
    const value = JSON.parse(theme ?? '{}').opening;
    return value && typeof value.key === 'string' && typeof value.contentType === 'string' && typeof value.version === 'string' ? value : null;
  } catch { return null; }
}
export async function eventProfile(env: CheckinEnv) {
  const row = await env.DB.prepare('SELECT format,subtitle,theme FROM events WHERE id=?').bind(env.CHECKIN_EVENT_ID).first<{format:string;subtitle:string|null;theme:string|null}>();
  let timingPreset: RehearsalTimingPreset = 'show';
  try { if (JSON.parse(row?.subtitle ?? '{}').rehearsalTiming === 'fast') timingPreset = 'fast'; } catch { /* older human-readable subtitles */ }
  return { format: row?.format ?? 'double_elimination', timingPreset, openingVersion: openingFromTheme(row?.theme)?.version ?? null };
}
