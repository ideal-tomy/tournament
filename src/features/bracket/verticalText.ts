/** 縦書き用: 伸ばし棒（ー）を縦棒（｜）に変換 */
export function toVerticalDisplayChar(ch: string): string {
  if (ch === 'ー' || ch === '−' || ch === '-' || ch === '―' || ch === '─') return '｜';
  return ch;
}

export function toVerticalDisplayChars(text: string): string[] {
  return [...text].map(toVerticalDisplayChar);
}
