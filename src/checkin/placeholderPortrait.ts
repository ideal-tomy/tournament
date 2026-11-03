/** 受付で撮影しない場合に R2 へ保存する仮の顔写真（JPEG data URL）。 */
export function buildPlaceholderPortrait(displayName: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('仮画像を作成できませんでした。');
  const name = displayName.trim().normalize('NFC');
  const label = [...name.replace(/\s+/g, '')].slice(0, 2).join('') || '？';
  ctx.fillStyle = '#1c2d43';
  ctx.fillRect(0, 0, 480, 480);
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(240, 200, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.ellipse(240, 420, 140, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 96px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 240, 210);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 28px system-ui,sans-serif';
  ctx.fillText('仮の画像', 240, 52);
  return canvas.toDataURL('image/jpeg', 0.85);
}
