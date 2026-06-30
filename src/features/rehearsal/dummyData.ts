/** リハーサル用 32 名（16 チーム）のダミー参加者定義 */

export interface DummyParticipantSpec {
  name: string;
  rating: number;
  /** public/images/test01.png など（拡張子なし） */
  imageFile: string;
}

export const REHEARSAL_IMAGE_DIR = '/images';

export const REHEARSAL_PARTICIPANT_COUNT = 32;

/** 登録名（2 人 1 組でペア表示される） */
const REHEARSAL_NAMES = [
  'トミー', 'サトー', 'ケン', 'ユウキ', 'リョウ', 'ハルト', 'ソウタ', 'ダイキ',
  'アキラ', 'ショウ', 'タクミ', 'コウキ', 'ナオキ', 'マサト', 'ヒロキ', 'レン',
  'ミサキ', 'アヤカ', 'ユイ', 'サクラ', 'ヒナ', 'リナ', 'モモ', 'アオイ',
  'カナ', 'メイ', 'ノゾミ', 'ユナ', 'マイ', 'ココ', 'レイ', 'ナナ',
] as const;

export const DUMMY_PARTICIPANTS: DummyParticipantSpec[] = REHEARSAL_NAMES.map(
  (name, i) => ({
    name,
    rating: 2200 - i * 12,
    imageFile: `test${String(i + 1).padStart(2, '0')}`,
  }),
);

export function rehearsalImageUrl(imageFile: string): string {
  return `${REHEARSAL_IMAGE_DIR}/${imageFile}.png`;
}

/** public/images の PNG を顔 JPEG に変換して Blob 化 */
export async function loadRehearsalFaceBlob(imageFile: string): Promise<Blob> {
  const url = rehearsalImageUrl(imageFile);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`画像が見つかりません: ${url}（public/images に ${imageFile}.png を配置してください）`);
  }

  const bitmap = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas が利用できません');

  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 240, 240);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`画像変換失敗: ${imageFile}`))),
      'image/jpeg',
      0.92,
    );
  });
}

/** 画像未配置時の Canvas フォールバック */
export function createDummyFaceBlob(label: string, color: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas が利用できません'));
      return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 120, 120);

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像生成に失敗しました'))),
      'image/jpeg',
      0.92,
    );
  });
}
