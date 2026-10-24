import { CLOUDFLARE_CHECK_EVENT_ID, CLOUDFLARE_CHECK_PREFIX, parseCloudflareStateResponse, toCloudflareReadModel } from './cloudflareTypes';

export class CloudflareReadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number | null = null) {
    super(message);
    this.name = 'CloudflareReadError';
  }
}

export function readFailure(status: number, code?: string): CloudflareReadError {
  if (code === 'CHECK_NOT_CONFIGURED') return new CloudflareReadError(code, '開発サーバーの接続設定がありません。確認手順に従って設定してください。', status);
  if (status === 401) return new CloudflareReadError('UNAUTHORIZED', '読取認証に失敗しました。サーバー側のDisplay用キーを確認してください。', status);
  if (status === 403) return new CloudflareReadError('FORBIDDEN', 'この大会または接続元の読取は許可されていません。', status);
  if (status === 404) return new CloudflareReadError('NOT_FOUND', '大会・stateまたは開発専用の接続経路が見つかりません。', status);
  if (status === 504) return new CloudflareReadError('TIMEOUT', 'Cloudflareへの接続がタイムアウトしました。再取得してください。', status);
  if (code === 'INVALID_STATE_RESPONSE') return new CloudflareReadError(code, 'APIの応答形式が想定と異なります。接続先とAPIのバージョンを確認してください。', status);
  return new CloudflareReadError('SERVER_ERROR', 'Workerまたは接続先DBから状態を取得できませんでした。時間をおいて再取得してください。', status);
}

/** This client has no credentials and only one GET operation. */
export async function fetchCloudflareState(eventId = CLOUDFLARE_CHECK_EVENT_ID, signal?: AbortSignal, timeoutMs = 12000) {
  if (eventId !== CLOUDFLARE_CHECK_EVENT_ID) throw readFailure(403);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(`${CLOUDFLARE_CHECK_PREFIX}/api/events/${eventId}/state`, {
      method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) {
      let code: string | undefined;
      try { const body: unknown = await response.json(); if (typeof body === 'object' && body && 'error' in body && typeof body.error === 'string') code = body.error; } catch { /* Use the HTTP status; never show upstream HTML. */ }
      throw readFailure(response.status, code);
    }
    try { return toCloudflareReadModel(parseCloudflareStateResponse(await response.json(), eventId)); }
    catch { throw new CloudflareReadError('INVALID_STATE_RESPONSE', 'APIの応答形式が想定と異なります。JSONとフィールドを確認してください。', response.status); }
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    if (timedOut) throw readFailure(504);
    if (error instanceof CloudflareReadError) throw error;
    throw new CloudflareReadError('NETWORK_ERROR', '通信できません。開発サーバーとネットワークを確認して再取得してください。');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
