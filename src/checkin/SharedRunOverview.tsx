import { useState } from 'react';
import { scopedUrl } from './api';
import type { Status } from './RehearsalPage';

const flowSteps = [
  ['参加者登録', (s: Status) => s.participants.length > 0],
  ['受付終了', (s: Status) => s.checkinStatus === 'closed'],
  ['ペア確定', (s: Status) => !!s.session],
  ['ペア発表', (s: Status) => !!s.session && s.scene !== 'idle'],
  ['Bracket', (s: Status) => !!s.bracket && !['idle', 'draw'].includes(s.scene)],
  ['試合', (s: Status) => !!s.flow?.currentMatch || !!s.flow?.completedMatches],
  ['Winner', (s: Status) => !!s.flow?.completedMatches],
  ['次試合', (s: Status) => !!s.flow?.completedMatches && !!s.flow?.currentMatch],
  ['FINAL', (s: Status) => !!s.flow?.currentMatch?.final || !!s.flow?.championTeamId],
  ['CHAMPION', (s: Status) => s.scene === 'finished'],
] as const;

function nextAction(s: Status) {
  const count = s.participants.length;
  if (s.scene === 'finished') return '大会終了。CHAMPIONをDisplayで確認できます。';
  if (s.checkinStatus === 'open') {
    if (count < 4 || count % 2) return 'スマホ受付を続けてください（現在' + count + '名。4名以上の偶数人数が必要です）。';
    return '運営（Admin）で「受付終了」を押すと、ペアが自動確定します。';
  }
  if (!s.session) return '運営（Admin）で受付終了を再試行してください。';
  if (s.scene === 'idle') return '運営（Admin）で「ペア発表開始」を押してください。会場モニター（Display）に演出が出ます。';
  if (s.scene === 'draw') return '会場Displayでペア発表が終わるまで待ちます。';
  if (s.scene === 'bracket' && s.flow?.canGameStart) return '運営（Admin）で「ゲームスタート」を押してください。';
  if (s.scene === 'vs_card') return '会場Displayで対戦を確認し、運営で「試合開始」を押してください。';
  if (s.scene === 'match_live') return '運営（Admin）で実際の勝者を選んでください。';
  if (s.flow?.canAdvance) return 'DisplayでBracketの勝ち上がりを確認します。';
  if (s.scene === 'result') return 'DisplayでWINNER表示を確認してください。';
  if (s.scene === 'award') return 'DisplayでCHAMPION演出を確認してください。';
  return 'Displayで進行を確認してください（' + s.scene + '）。';
}

export default function SharedRunOverview({ status }: { status: Status }) {
  const name = (id: string | null | undefined) => status.teams.find(team => team.id === id)?.name ?? '—';
  const checkinUrl = location.origin + scopedUrl('/checkin');
  const [qrFailed, setQrFailed] = useState(false);
  return <>
    <section className="shared-run">
      <h2>当日の3画面（URLの大会IDを必ず揃える）</h2>
      <p>大会ID：<code>{status.eventId}</code></p>
      <figure className="checkin-qr">
        {qrFailed
          ? <p className="hint">QRを表示できません。「① スマホ受付」のURLをコピーして配布してください。</p>
          : <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkinUrl)}`} alt="受付QR" width={180} height={180} onError={() => setQrFailed(true)} />}
        <figcaption>このQRは①受付専用です。モニターは③のリンクをPCで開いてください。</figcaption>
      </figure>
      <div className="actions day-of-links">
        <a className="button primary" href={scopedUrl('/checkin')} target="_blank" rel="noreferrer">① スマホ受付</a>
        <a className="button primary" href={scopedUrl('/admin')} target="_blank" rel="noreferrer">② 運営（スマホ・PC）</a>
        <a className="button primary" href={scopedUrl('/display')} target="_blank" rel="noreferrer">③ 会場モニター</a>
      </div>
      <p>この3リンクだけを当日の正本にしてください。別途「大会を準備」を押すと別IDの大会ができ、モニターと連動しなくなります。</p>
      <ol className="connection-flow">
        <li><strong>① 受付</strong><span>撮影・登録。4名以上の偶数人数まで。</span></li>
        <li><strong>② 運営</strong><span>受付終了（ペア自動）→ ペア発表開始 → 試合・勝者。</span></li>
        <li><strong>③ モニター</strong><span>演出のみ。操作はしない。</span></li>
      </ol>
    </section>
    <section className="next-action" aria-live="polite">
      <p className="eyebrow">次に行う操作</p>
      <h2>{nextAction(status)}</h2>
      <p>現在：{status.checkinStatus} / {status.flow?.phase ?? status.scene} · 完了 {status.flow?.completedMatches ?? 0} 試合 · {status.participants.length} 名 / {status.teams.length} ペア</p>
    </section>
    <section className="progress-card">
      <h2>全体の進行</h2>
      <ol className="rehearsal-steps">{flowSteps.map(([label, done]) => <li key={label} data-complete={String(done(status))}>{done(status) ? '✓ ' : ''}{label}</li>)}</ol>
      <dl>
        <dt>次の対戦</dt><dd>{name(status.flow?.currentMatch?.teamA)} vs {name(status.flow?.currentMatch?.teamB)}</dd>
        <dt>試合の進捗</dt><dd>{status.flow?.currentMatch?.roundName ?? '—'} · {status.flow?.completedMatches ?? 0} / {status.integrity.matchCount}</dd>
        <dt>優勝</dt><dd>{name(status.flow?.championTeamId)}</dd>
      </dl>
    </section>
  </>;
}
