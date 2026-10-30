import { scopedUrl } from './api';
import { useState } from 'react';
import DrawControl from './DrawControl';
import ParticipantPhoto from './ParticipantPhoto';
import { useParticipants } from './useParticipants';

export default function DisplayPage({ onAuthRequired, sessionVersion, administration = false }: { onAuthRequired(): void; sessionVersion: number; administration?: boolean }) {
  const [drawActive,setDrawActive] = useState(false);
  const { checkin, participants, excludedTests, error, loading, revision, updated, refresh } = useParticipants(onAuthRequired, sessionVersion, !administration);
  return <><DrawControl administration={administration} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} onActiveChange={setDrawActive}/><section className="display" hidden={!administration && drawActive}><header className="display-header"><div><p className="eyebrow">REHEARSAL / {administration ? 'OPERATIONS' : 'PARTICIPANTS'}</p><h1>{administration ? '大会運営・参加者確認' : '参加者確認'}</h1><p>{administration ? '受付終了後にペア発表開始、Bracket表示後にゲームスタートへ進みます。' : '登録した名前・写真を表示します。5秒ごとに更新します。'}</p></div>{administration&&<button onClick={refresh}>今すぐ更新</button>}</header>
    <p role="status" className="display-status">{loading ? '読み込み中…' : `登録済み ${participants.length}名`}{updated && ` · 最終更新 ${updated}`}</p>
    {checkin?.status === 'closed' && <p className="hint">受付完了済みの参加者一覧です。運営用確定一覧: GET /api/checkin/roster（同じ確認コードでログインが必要）</p>}
    {excludedTests > 0 && <p className="hint">自動試験データ{excludedTests}件は通常表示・演出の対象外です。実際の写真を受付から登録してください。</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!loading && !error && participants.length === 0 && <div className="card empty"><h2>写真付き参加者の登録を待っています</h2><p>スマホの受付画面で名前と実際の写真を登録してください。</p><a className="button" href={scopedUrl('/checkin')}>受付を開く</a></div>}
    <div className="participants">{participants.map(participant => <article className="participant" key={participant.id}><ParticipantPhoto key={`${participant.id}-${revision}-${sessionVersion}`} participant={participant} refreshKey={`${revision}-${sessionVersion}`} onRetry={refresh} /><div><h2>{participant.name}</h2>{participant.rating !== null && <p>rating {participant.rating}</p>}{administration && <><p className="participant-id">{participant.id}</p><a className="button" href={scopedUrl(`/show-preview?participant=${encodeURIComponent(participant.id)}`)}>この参加者で演出確認</a></>}</div></article>)}</div>
  </section></>;
}
