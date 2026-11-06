/** "名前（12.5）" may wrap only before the rating, so the name itself is never split. */
export default function RatedName({ text }: { text: string }) {
  const at = text.lastIndexOf('（');
  if (at <= 0 || !text.endsWith('）')) return <>{text}</>;
  return <>{text.slice(0, at)}<wbr />{text.slice(at)}</>;
}
