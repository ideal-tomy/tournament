export interface Participant {
  id: string; eventId: string; name: string; rating: number | null;
  portraitUrl: string; photoUrl: string; portraitContentType: string;
  portraitSource: 'uploaded' | 'automated-test'; createdAt: string; version: number; updatedAt: string;
}
const messages: Record<string, string> = {
  VERSION_CONFLICT: '別の端末で更新されました。一覧を更新して編集し直してください。',
  PARTICIPANT_IN_USE: '大会で使用中の参加者は変更できません。',
  CHECKIN_NOT_READY: '受付終了の確認項目を解消してください。',
  PARTICIPANT_DELETED: 'この登録は削除済みです。新しく登録してください。',
  NOT_FOUND: '参加者が見つかりません。一覧を更新してください。',
  CHECKIN_NOT_CLOSED: '先に受付終了を行ってください。',
  EVEN_PARTICIPANTS_REQUIRED: '今回は2名ペア・4名以上の偶数人数でDrawを開始してください。',
  ROSTER_CHANGED: '受付完了時の参加者と一致しません。運営担当者に確認してください。',
  DRAW_NOT_FINISHED: 'Draw演出の完了を待っています。',
  MATCH_NOT_READY: 'VS演出が完了してから試合開始してください。',
  MATCH_NOT_LIVE: '先に試合開始してください。',
  SPOTLIGHT_PLAYING: '会場でこの台の演出を再生中です。終わってから操作してください。',
  NO_PLAYABLE_MATCH: '実施可能な試合がありません。大会データを確認してください。',
  GAME_NOT_READY: 'ペア発表とBracket表示が完了してからゲームスタートしてください。',
  PAIRS_NOT_PREPARED: '先に組み合わせを確定してください。',
  INVALID_PAIRS: '全員が1回ずつ入る2人組にしてください。',
  PAIRS_LOCKED: 'ペア発表が始まったので、組み直せません。',
  TEAM_NAME_LOCKED: 'ペア発表が始まったので、チーム名は変更できません。',
  TEAM_NAME_TOO_LONG: '会場に出すチーム名は16文字以内にしてください。',
  REPLAY_NOT_AVAILABLE: 'ペア発表前なので、やり直す進行はありません。',
  REOPEN_NOT_AVAILABLE: 'この大会は受付からやり直せません。',
  INVALID_TITLE: '大会名は80文字以内で入力してください。',
  OPENING_LOCKED: 'ペア発表が始まったので、待機画像は変更できません。',
  INVALID_REHEARSAL_PROFILE: 'ゲーム形式を選び直してください。',
  UNAUTHORIZED: '確認コードを入力してログインしてください。',
  NOT_CONFIGURED: '受付の準備ができていません。運営担当者に確認してください。',
  INVALID_NAME: '名前は80文字以内で入力してください。',
  INVALID_RATING: 'ratingは0より大きく30以下で入力してください。',
  INVALID_PHOTO: '写真を読み取れませんでした。撮り直してください。',
  PHOTO_TOO_LARGE: '写真が大きすぎます。撮り直してください。',
  CHECKIN_CLOSED: '現在、この大会の受付は停止しています。',
  REQUEST_CONFLICT: 'この送信と異なる内容が保存されています。運営担当者に確認してください。',
  SERVICE_UNAVAILABLE: '保存先に接続できません。入力内容を保持しています。同じ登録を再試行してください。',
};
export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(messages[code] ?? '処理できませんでした。時間をおいて再試行してください。'); }
}
export function currentRunId(): string | null {
  return new URLSearchParams(location.search).get('run');
}
export function scopedUrl(path:string){
 const run=currentRunId();
 if(!run)return path;
 const url=new URL(path,location.origin);url.searchParams.set('run',run);return url.pathname+url.search;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const external = options.signal;
  const abort = () => controller.abort();
  external?.addEventListener('abort', abort, { once: true });
  if (external?.aborted) controller.abort();
  try {
    const result = await fetch(scopedUrl(path), { ...options, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const body = await result.json() as T & { error?: string };
    if (!result.ok) throw new ApiError(result.status, body.error ?? 'UNKNOWN');
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('通信できませんでした。接続を確認し、同じ登録を再試行してください。');
  } finally { clearTimeout(timer); external?.removeEventListener('abort', abort); }
}
