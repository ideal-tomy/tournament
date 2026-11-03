import { currentRunId, scopedUrl } from './api';
import { useState } from 'react';
import DrawControl from './DrawControl';
import ParticipantPhoto from './ParticipantPhoto';
import RunContextBanner from './RunContextBanner';
import { useParticipants } from './useParticipants';

export default function DisplayPage({ onAuthRequired, sessionVersion, administration = false }: { onAuthRequired(): void; sessionVersion: number; administration?: boolean }) {
  const [drawActive, setDrawActive] = useState(false);
  const { checkin, participants, excludedTests, error, loading, revision, updated, refresh } = useParticipants(onAuthRequired, sessionVersion, administration);
  const venueOnly = !administration;
  const run = currentRunId();
  return <>
    {administration && <RunContextBanner role="admin" sessionVersion={sessionVersion} />}
    <DrawControl administration={administration} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} onActiveChange={setDrawActive} />
    {venueOnly ? (
      drawActive ? null : (
        <section className="display display-venue-idle" aria-live="polite">
          <p className="display-venue-status">
            {loading ? '接続を確認しています…' : `登録 ${participants.length} 名 · 受付${checkin?.status === 'closed' ? '終了' : '中'}`}
            {run && ` · 大会ID …${run.slice(-12)}`}
          </p>
          {participants.length === 0 && !loading && (
            <p className="hint display-venue-hint">スマホ受付で登録が始まると、運営が受付終了・発表開始後にここへ演出が表示されます。</p>
          )}
          {error && <p role="alert" className="error">{error}</p>}
        </section>
      )
    ) : (
      <section className="display" hidden={drawActive}>
        <header className="display-header">
          <div>
            <p className="eyebrow">REHEARSAL / OPERATIONS</p>
            <h1>大会運営・参加者確認</h1>
            <p>受付終了でペアを自動確定し、「ペア発表開始」で会場Displayに演出を出します。</p>
          </div>
          <button onClick={refresh}>今すぐ更新</button>
        </header>
        <p role="status" className="display-status">{loading ? '読み込み中…' : `登録済み ${participants.length}名`}{updated && ` · 最終更新 ${updated}`}</p>
        {checkin?.status === 'closed' && <p className="hint">受付完了済みの参加者一覧です。</p>}
        {excludedTests > 0 && <p className="hint">自動試験データ{excludedTests}件は通常表示・演出の対象外です。</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {!loading && !error && participants.length === 0 && (
          <div className="card empty">
            <h2>写真付き参加者の登録を待っています</h2>
            <p>スマホの受付画面で名前と写真を登録してください。</p>
            <a className="button" href={scopedUrl('/checkin')}>受付を開く</a>
          </div>
        )}
        <div className="participants">{participants.map(participant => (
          <article className="participant" key={participant.id}>
            <ParticipantPhoto key={`${participant.id}-${revision}-${sessionVersion}`} participant={participant} refreshKey={`${revision}-${sessionVersion}`} onRetry={refresh} />
            <div>
              <h2>{participant.name}</h2>
              {participant.rating !== null && <p>rating {participant.rating}</p>}
              <p className="participant-id">{participant.id}</p>
              <a className="button" href={scopedUrl(`/show-preview?participant=${encodeURIComponent(participant.id)}`)}>この参加者で演出確認</a>
            </div>
          </article>
        ))}</div>
      </section>
    )}
  </>;
}
