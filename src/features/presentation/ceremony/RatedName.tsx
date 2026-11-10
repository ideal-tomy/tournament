import './ratedName.css';

/** 名前とレーティングは常に2行。1行目が名前、2行目が（Rt.12）。 */
export default function RatedName({ text }: { text: string }) {
  const at = text.lastIndexOf('（');
  if (at <= 0 || !text.endsWith('）')) return <>{text}</>;
  return <><span className="rated-name-line">{text.slice(0, at)}</span><br /><span className="rated-name-line">{text.slice(at)}</span></>;
}
