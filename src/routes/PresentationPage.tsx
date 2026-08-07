import { useNavigate } from 'react-router-dom';
import PresentationControls from '../features/guide/PresentationControls';
import PresentationOverlay from '../features/guide/PresentationOverlay';
import PresentationPanel from '../features/guide/PresentationPanel';
import { usePresentationController } from '../features/guide/usePresentationController';

const PLAYERS = [
  { name: '佐藤 ハル', rating: 12.4, face: '/images/test01.png' },
  { name: '鈴木 ミオ', rating: 5.8, face: '/images/test02.png' },
  { name: '高橋 レン', rating: 11.9, face: '/images/test03.png' },
  { name: '田中 ユイ', rating: 6.2, face: '/images/test04.png' },
] as const;

export default function PresentationPage() {
  const navigate = useNavigate();
  const controller = usePresentationController();

  return (
    <div
      data-guide-shell
      className={`flex h-screen min-h-[620px] flex-col overflow-hidden bg-slate-950 ${controller.playing ? '' : 'guide-paused'}`}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(290px,24vw)]">
        <main className="relative min-h-0 overflow-hidden bg-[#06101c]">
          <div className="absolute inset-0 guide-ambient-bg" aria-hidden />
          <div className="relative h-full p-5">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/85 shadow-2xl">
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700/80 px-5 text-white">
                <div>
                  <p className="font-black text-cyan-300">DARTS TOURNAMENT</p>
                  <p className="text-[10px] tracking-widest text-slate-500">PRESENTATION MODE · SAMPLE DATA</p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-xs text-emerald-300">DB更新なし</span>
              </header>
              <div className="min-h-0 flex-1 overflow-hidden">
                <GuideScene stepIndex={controller.stepIndex} />
              </div>
            </div>
          </div>
        </main>
        <PresentationPanel step={controller.step} stepIndex={controller.stepIndex} />
      </div>
      <PresentationControls
        playing={controller.playing}
        isFirst={controller.isFirst}
        isLast={controller.isLast}
        onPrevious={controller.previous}
        onToggle={() => controller.setPlaying((playing) => !playing)}
        onNext={controller.next}
        onRestart={controller.restart}
        onExit={() => navigate('/')}
      />
      <PresentationOverlay step={controller.step} />
    </div>
  );
}

function GuideScene({ stepIndex }: { stepIndex: number }) {
  if (stepIndex <= 3) return <AdminGuideScene stepIndex={stepIndex} />;
  if (stepIndex === 4) return <DartImpactScene />;
  if (stepIndex === 5) return <PlayerRevealScene />;
  if (stepIndex === 6) return <PairScene />;
  if (stepIndex === 7) return <BracketScene />;
  if (stepIndex === 8 || stepIndex === 9) return <NextMatchScene showStart={stepIndex === 9} />;
  if (stepIndex === 10) return <WinnerInputScene />;
  if (stepIndex === 11) return <WinnerScene />;
  if (stepIndex === 12) return <AutomaticTransitionScene />;
  return <FlowSummaryScene />;
}

function AdminGuideScene({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="flex h-full bg-slate-100 text-slate-900">
      <nav className="w-44 shrink-0 bg-slate-900 p-4 text-sm text-slate-300">
        <p className="mb-5 text-xs font-black tracking-widest text-slate-500">運営メニュー</p>
        {['参加者登録', '抽選', '試合進行', 'メディア', 'シーン'].map((label, index) => (
          <div key={label} className={`mb-2 rounded-lg px-3 py-3 ${index === Math.min(stepIndex, 1) ? 'bg-cyan-700 text-white' : ''}`}>{label}</div>
        ))}
      </nav>
      <section className="min-w-0 flex-1 overflow-auto p-6">
        {stepIndex === 0 && (
          <div data-guide="guide-overview" className="mx-auto grid max-w-3xl grid-cols-2 gap-4 pt-10">
            {[
              ['01', '参加者登録', '写真・名前・レーティング'],
              ['02', 'ペア抽選', '均等編成と発表演出'],
              ['03', 'トーナメント', '対戦順と結果を管理'],
              ['04', 'ライブ演出', 'WINNER・NEXT MATCH'],
            ].map(([number, title, text]) => (
              <article key={number} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-cyan-700">{number}</p><h2 className="mt-2 text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        )}
        {stepIndex === 1 && (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xl font-black">体験メニュー</h2>
            <button data-guide="participant-registration" type="button" className="mt-5 w-full rounded-xl border-2 border-cyan-600 bg-white p-6 text-left shadow-lg">
              <span className="text-lg font-black">参加者登録体験（運営）</span>
              <span className="mt-1 block text-sm text-slate-500">顔写真付きで参加者を登録 → 抽選 → 大会進行</span>
            </button>
          </div>
        )}
        {stepIndex === 2 && <ParticipantForm />}
        {stepIndex === 3 && <DrawPreview />}
      </section>
    </div>
  );
}

function ParticipantForm() {
  return (
    <div data-guide="participant-form" className="mx-auto grid max-w-3xl grid-cols-[230px_1fr] gap-6 rounded-xl bg-white p-6 shadow">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900">
        <img src={PLAYERS[0].face} alt="サンプル参加者" className="h-full w-full object-cover" />
        <span className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-xs text-white">顔検出済み</span>
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-black">参加者登録</h2>
        <MockInput label="参加者名" value={PLAYERS[0].name} />
        <MockInput label="レーティング" value={String(PLAYERS[0].rating)} />
        <button type="button" className="w-full rounded-lg bg-emerald-600 py-3 font-bold text-white">この内容で登録</button>
        <p className="text-xs text-amber-700">Presentation Modeでは保存されません</p>
      </div>
    </div>
  );
}

function MockInput({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-bold text-slate-600">{label}<input readOnly value={value} className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-lg text-slate-900" /></label>;
}

function DrawPreview() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-black">ダブルス編成プレビュー</h2>
      <p className="mt-1 text-sm text-slate-500">高レーティング × 低レーティングでチーム差を抑えます。</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[['TEAM 01', PLAYERS[0], PLAYERS[1]], ['TEAM 02', PLAYERS[2], PLAYERS[3]]].map(([team, a, b]) => (
          <div key={String(team)} className="rounded-lg border bg-slate-50 p-4"><p className="text-xs font-black text-cyan-700">{String(team)}</p><p className="mt-2 font-bold">{typeof a === 'object' ? a.name : ''} ＋ {typeof b === 'object' ? b.name : ''}</p></div>
        ))}
      </div>
      <button data-guide="draw-start" type="button" className="mt-6 w-full rounded-xl bg-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-200">確定 → 抽選演出開始</button>
    </div>
  );
}

function ShowStage({ children }: { children: React.ReactNode }) {
  return <div className="relative flex h-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#17345a_0%,#07111f_52%,#02060c_100%)] text-white"><div className="guide-stars absolute inset-0" />{children}</div>;
}

function DartImpactScene() {
  return (
    <ShowStage>
      <div data-guide="dart-card" className="guide-impact-card relative h-[68%] aspect-[2/3]">
        <img src="/tournament-effects/cards/card-back.webp" alt="カード裏面" className="h-full w-full object-contain drop-shadow-[0_0_40px_rgba(34,211,238,.65)]" />
        <img src="/tournament-effects/darts/dart-main.png" alt="ダーツ" className="guide-dart absolute left-1/2 top-1/2 z-20 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 object-contain" />
        <img src="/tournament-effects/effects/golden-sparks.png" alt="" className="guide-impact-spark absolute left-1/2 top-1/2 z-10 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 object-contain" />
      </div>
    </ShowStage>
  );
}

function PlayerRevealScene() {
  return <ShowStage><PlayerCard player={PLAYERS[0]} guide="player-reveal" /></ShowStage>;
}

function PlayerCard({ player, guide }: { player: (typeof PLAYERS)[number]; guide?: string }) {
  return (
    <article data-guide={guide} className="relative h-[68%] aspect-[2/3] overflow-hidden rounded-2xl">
      <img src="/tournament-effects/cards/card-front.webp" alt="" className="absolute inset-0 h-full w-full object-contain" />
      <img src={player.face} alt={player.name} className="absolute inset-[14%_13%_22%] h-[64%] w-[74%] rounded-xl object-cover" />
      <div className="absolute bottom-[8%] left-[14%] right-[14%] py-3 text-center text-xl font-black text-white">{player.name}</div>
    </article>
  );
}

function PairScene() {
  return (
    <ShowStage>
      <div data-guide="pair-confirmed" className="flex w-full max-w-4xl flex-col items-center">
        <p className="text-sm font-black tracking-[.5em] text-amber-300">TEAM 01</p><h2 className="mt-2 text-4xl font-black tracking-[.18em]">PAIR CONFIRMED</h2>
        <div className="mt-6 flex h-[55vh] max-h-[460px] gap-8"><PlayerCard player={PLAYERS[0]} /><PlayerCard player={PLAYERS[1]} /></div>
      </div>
    </ShowStage>
  );
}

function BracketScene() {
  return (
    <ShowStage>
      <div className="w-full max-w-5xl px-10">
        <h2 className="mb-8 text-center text-2xl font-black tracking-widest text-cyan-300">DOUBLE ELIMINATION BRACKET</h2>
        <div className="grid grid-cols-3 items-center gap-12">
          <div className="space-y-7">
            <BracketMatch guide="bracket-first-match" title="MATCH 1" a="TEAM 01" b="TEAM 04" active />
            <BracketMatch title="MATCH 2" a="TEAM 02" b="TEAM 03" />
          </div>
          <BracketMatch title="WINNERS FINAL" a="WINNER M1" b="WINNER M2" />
          <BracketMatch title="GRAND FINAL" a="TBD" b="TBD" />
        </div>
      </div>
    </ShowStage>
  );
}

function BracketMatch({ title, a, b, active, guide }: { title: string; a: string; b: string; active?: boolean; guide?: string }) {
  return <div data-guide={guide} className={`rounded-lg border-2 bg-slate-900/90 p-3 ${active ? 'border-amber-300 shadow-[0_0_24px_rgba(251,191,36,.45)]' : 'border-cyan-900'}`}><p className="text-[10px] font-black tracking-widest text-cyan-400">{title}</p><p className="mt-2 border-b border-slate-700 pb-2 font-bold">{a}</p><p className="pt-2 font-bold">{b}</p></div>;
}

function NextMatchScene({ showStart }: { showStart: boolean }) {
  return (
    <ShowStage>
      <div className="flex w-full flex-col items-center px-8">
        <div data-guide="next-match-card" className="w-full max-w-5xl text-center">
          <p className="text-4xl font-black tracking-[.3em]">NEXT MATCH</p><p className="mt-3 text-sm font-black tracking-widest text-cyan-300">WINNERS ROUND 1 · MATCH 1</p>
          <div className="mt-8 grid grid-cols-[1fr_100px_1fr] items-center gap-6"><Team playerA={PLAYERS[0]} playerB={PLAYERS[1]} label="TEAM 01" /><p className="text-5xl font-black text-amber-300">VS</p><Team playerA={PLAYERS[2]} playerB={PLAYERS[3]} label="TEAM 02" /></div>
        </div>
        {showStart && <button data-guide="start-match" type="button" className="mt-8 rounded-xl bg-cyan-500 px-16 py-4 text-xl font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,.55)]">試合開始 / START MATCH</button>}
      </div>
    </ShowStage>
  );
}

function Team({ playerA, playerB, label }: { playerA: (typeof PLAYERS)[number]; playerB: (typeof PLAYERS)[number]; label: string }) {
  return <div className="rounded-xl border border-cyan-400/40 bg-black/45 p-5"><div className="flex justify-center gap-3">{[playerA, playerB].map((p) => <img key={p.name} src={p.face} alt={p.name} className="h-24 w-24 rounded-xl object-cover" />)}</div><p className="mt-3 text-xl font-black">{label}</p><p className="text-sm text-slate-300">{playerA.name} ＋ {playerB.name}</p></div>;
}

function WinnerInputScene() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-8 text-slate-900"><div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"><p className="text-xs font-black text-slate-500">WINNERS BRACKET · ROUND 1</p><h2 className="mt-2 text-xl font-black">勝者を選択</h2><div className="mt-5 grid grid-cols-2 gap-4"><button className="rounded-xl bg-emerald-600 py-8 text-lg font-black text-white">TEAM 01<span className="mt-1 block text-xs">勝者候補</span></button><button className="rounded-xl border-2 border-slate-300 py-8 text-lg font-black">TEAM 02</button></div><button data-guide="winner-confirm" className="mt-6 w-full rounded-xl bg-slate-900 py-4 text-lg font-black text-white">勝敗を確定</button></div></div>
  );
}

function WinnerScene() {
  return (
    <ShowStage><div data-guide="winner-stage" className="relative flex w-full max-w-5xl items-center justify-center gap-16"><div className="guide-confetti absolute -inset-32" /><div className="relative z-10 scale-110 text-center brightness-125 saturate-125"><div className="flex gap-2">{[PLAYERS[0], PLAYERS[1]].map((p) => <img key={p.name} src={p.face} alt={p.name} className="h-36 w-36 rounded-2xl object-cover shadow-[0_0_35px_rgba(251,191,36,.65)]" />)}</div><p className="mt-5 text-5xl font-black text-amber-300">WINNER</p><p className="mt-2 text-2xl font-black">TEAM 01</p></div><div className="text-center opacity-40 grayscale-[.3] brightness-50"><div className="flex gap-2">{[PLAYERS[2], PLAYERS[3]].map((p) => <img key={p.name} src={p.face} alt={p.name} className="h-28 w-28 rounded-xl object-cover" />)}</div><p className="mt-3 text-xl font-bold">TEAM 02</p></div></div></ShowStage>
  );
}

function AutomaticTransitionScene() {
  return (
    <ShowStage><div data-guide="automatic-transition" className="grid w-full max-w-5xl grid-cols-[1fr_100px_1fr] items-center gap-6"><div className="guide-auto-winner rounded-xl border border-amber-400/40 bg-amber-950/30 p-8 text-center"><p className="text-3xl font-black text-amber-300">WINNER</p><p className="mt-2 font-bold">TEAM 01</p></div><div className="guide-flow-arrow text-center text-5xl text-cyan-300">→</div><div className="guide-auto-next rounded-xl border border-cyan-400/40 bg-cyan-950/30 p-8 text-center"><p className="text-3xl font-black">NEXT MATCH</p><p className="mt-2 font-bold text-cyan-200">TEAM 03 VS TEAM 04</p></div></div></ShowStage>
  );
}

function FlowSummaryScene() {
  return (
    <ShowStage><div data-guide="guide-flow-summary" className="w-full max-w-5xl text-center"><p className="text-sm font-black tracking-[.5em] text-cyan-300">TOURNAMENT FLOW</p><div className="mt-10 flex items-center justify-center gap-3 text-sm font-black">{['参加者登録', '抽選', '対戦', '勝者', 'NEXT MATCH', '手動 START'].map((label, index) => <div key={label} className="contents"><div className={`rounded-xl border px-4 py-5 ${index === 5 ? 'border-amber-300 bg-amber-950/40 text-amber-200' : 'border-cyan-500/40 bg-cyan-950/30'}`}>{label}</div>{index < 5 && <span className="text-cyan-400">→</span>}</div>)}</div><p className="mt-12 text-3xl font-black">これで大会運営の準備は完了です</p></div></ShowStage>
  );
}
