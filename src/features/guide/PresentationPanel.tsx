import { PRESENTATION_STEPS, type PresentationStep } from './presentationSteps';

export default function PresentationPanel({ step, stepIndex }: { step: PresentationStep; stepIndex: number }) {
  const progress = ((stepIndex + 1) / PRESENTATION_STEPS.length) * 100;
  return (
    <aside className="flex min-h-0 flex-col border-l border-cyan-500/20 bg-slate-950/95 p-6 text-white">
      <p className="text-xs font-black tracking-[0.25em] text-cyan-300">
        操作説明 {stepIndex + 1} / {PRESENTATION_STEPS.length}
      </p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div key={step.id} className="guide-panel-enter mt-8">
        <h2 className="text-2xl font-black leading-tight">{step.title}</h2>
        <p className="mt-5 text-sm leading-7 text-slate-300">{step.description}</p>
      </div>
      <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs leading-5 text-slate-400">
        このモードは説明専用です。本番データ、勝敗、写真は変更しません。
      </div>
    </aside>
  );
}
