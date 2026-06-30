/** リハーサル用 8 名分のダミー参加者定義 */

export interface DummyParticipantSpec {
  name: string;
  rating: number;
  color: string;
  label: string;
}

export const DUMMY_PARTICIPANTS: DummyParticipantSpec[] = [
  { name: '赤井 太郎', rating: 2100, color: '#e11d48', label: '赤' },
  { name: '青木 次郎', rating: 2050, color: '#2563eb', label: '青' },
  { name: '緑川 三郎', rating: 1980, color: '#16a34a', label: '緑' },
  { name: '黄田 四郎', rating: 1920, color: '#ca8a04', label: '黄' },
  { name: '紫原 五郎', rating: 1880, color: '#9333ea', label: '紫' },
  { name: '橙本 六郎', rating: 1820, color: '#ea580c', label: '橙' },
  { name: '白井 七郎', rating: 1760, color: '#64748b', label: '白' },
  { name: '黒田 八郎', rating: 1700, color: '#1e293b', label: '黒' },
];

/** Canvas で単色 + 文字の顔 JPEG を生成 */
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
