import { ClientError, decodePortrait, imageTypes, readBody, response, type CheckinEnv } from './domain';
import { openingFromTheme } from './profile';

const OPENING_LIMIT = 4 * 1024 * 1024;
const BODY_LIMIT = 6 * 1024 * 1024;

async function theme(env: CheckinEnv) {
  const row = await env.DB.prepare("SELECT theme FROM events WHERE id=? AND environment='rehearsal'").bind(env.CHECKIN_EVENT_ID).first<{ theme: string | null }>();
  if (!row) throw new ClientError('NOT_FOUND', 404);
  return row.theme;
}

/** The venue standby image of one event. It can be replaced only while the announcement has not started. */
export async function openingRoute(request: Request, env: CheckinEnv): Promise<Response | null> {
  const match = /^\/api\/events\/([a-zA-Z0-9_-]{1,128})\/opening$/.exec(new URL(request.url).pathname);
  if (!match) return null;
  if (match[1] !== env.CHECKIN_EVENT_ID) throw new ClientError('NOT_FOUND', 404);
  if (request.method === 'GET') {
    const opening = openingFromTheme(await theme(env));
    if (!opening) throw new ClientError('NOT_FOUND', 404);
    const object = await env.PORTRAITS.get(opening.key);
    if (!object?.body) throw new ClientError('PHOTO_UNAVAILABLE', 404);
    const headers = new Headers({ 'Content-Type': opening.contentType });
    if (object.size !== undefined) headers.set('Content-Length', String(object.size));
    return new Response(object.body, { headers });
  }
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const picture = decodePortrait((await readBody(request, BODY_LIMIT)).image, OPENING_LIMIT);
  const previous = openingFromTheme(await theme(env));
  const locked = () => env.DB.prepare("SELECT 1 AS locked FROM event_state WHERE event_id=? AND scene<>'idle'").bind(env.CHECKIN_EVENT_ID).first();
  if (await locked()) throw new ClientError('OPENING_LOCKED', 409);
  const key = `events/${env.CHECKIN_EVENT_ID}/opening/${crypto.randomUUID()}.${picture.format}`;
  const uploaded = await env.PORTRAITS.put(key, picture.bytes.buffer as ArrayBuffer, { httpMetadata: { contentType: picture.contentType }, customMetadata: { eventId: env.CHECKIN_EVENT_ID, kind: 'opening' }, onlyIf: { etagDoesNotMatch: '*' } });
  if (uploaded === null) throw new ClientError('REQUEST_CONFLICT', 409);
  const opening = { key, contentType: imageTypes[picture.format], version: new Date().toISOString() };
  const saved = await env.DB.prepare(`UPDATE events SET theme=json_set(theme,'$.opening',json(?)),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=? AND environment='rehearsal' AND NOT EXISTS(SELECT 1 FROM event_state WHERE event_id=? AND scene<>'idle')`).bind(JSON.stringify(opening), env.CHECKIN_EVENT_ID, env.CHECKIN_EVENT_ID).run();
  if (!saved.meta.changes) {
    await env.PORTRAITS.delete(key).catch(() => undefined);
    throw new ClientError('OPENING_LOCKED', 409);
  }
  if (previous && previous.key !== key) await env.PORTRAITS.delete(previous.key).catch(() => undefined);
  return response({ openingVersion: opening.version });
}
