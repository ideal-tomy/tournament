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
    return 'PC運営で「受付終了」を押し、ペアを確定します。';
  }
  if (!s.session) return 'Adminで受付終了を再試行してください。';
  if (s.scene === 'idle') return 'Adminで「ペア発表開始」を押してください。';
  if (s.scene === 'draw') return 'Displayでペア発表が終わるまで待ちます。';
  if (s.scene === 'bracket' && s.flow?.canGameStart) return 'Adminで「ゲームスタート」を押してください。';
  if (s.scene === 'vs_card') return '対戦表示を確認し、Adminで「試合開始」を押してください。';
  if (s.scene === 'match_live') return 'Adminで実際の勝者を選んでください。';
  if (s.flow?.canAdvance) return 'DisplayでBracketの勝ち上がりを確認します。';
  if (s.scene === 'result') return 'DisplayでWINNER表示を確認してください。';
  if (s.scene === 'award') return 'DisplayでCHAMPION演出を確認してください。';
  return 'Displayで進行を確認してください（' + s.scene + '）。';
}

export default function SharedRunOverview({ status }: { status: Status }) {
  const name = (id: string | null | undefined) => status.teams.find(team => team.id === id)?.name ?? '—';
  return <>
    <section className="shared-run">
      <h2>同じ大会を各画面で開く</h2>
      <p>大会ID：<code>{status.eventId}</code></p>
      <div className="actions">
        <a className="button" href={scopedUrl('/checkin')} target="_blank" rel="noreferrer">スマホ受付</a>
        <a className="button" href={scopedUrl('/admin')} target="_blank" rel="noreferrer">PC運営（Admin）</a>
        <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">会場Display</a>
      </div>
      <p>各端末で同じ確認コードを入力し、URLの大会IDが一致していることを確認してください。受付・参加者一覧は約5秒ごとに更新されます。</p>
      <ol className="connection-flow">
        <li><strong>スマホ受付</strong><span>登録内容 → D1の参加者データ、写真 → 非公開R2</span></li>
        <li><strong>PC運営</strong><span>Adminでの操作 → 同じ大会の進行状態を保存</span></li>
        <li><strong>会場Display</strong><span>保存された状態を取得して演出・試合・結果を表示</span></li>
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
