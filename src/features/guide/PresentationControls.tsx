interface Props {
  playing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export default function PresentationControls(props: Props) {
  return (
    <footer className="flex h-20 items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 px-5 text-white">
      <button type="button" onClick={props.onPrevious} disabled={props.isFirst} className="guide-control">← 戻る</button>
      <button type="button" onClick={props.onToggle} className="guide-control guide-control-primary">
        {props.playing ? 'Ⅱ 一時停止' : '▶ 再生'}
      </button>
      <button type="button" onClick={props.onNext} disabled={props.isLast} className="guide-control">次へ →</button>
      <button type="button" onClick={props.onRestart} className="guide-control">↻ 最初から</button>
      <button type="button" onClick={props.onExit} className="guide-control border-rose-500/50 text-rose-200">終了</button>
    </footer>
  );
}
