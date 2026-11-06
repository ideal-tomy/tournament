import { useRef } from 'react';
import type { Participant } from './api';
import CeremonyFrame from '../features/presentation/ceremony/CeremonyFrame';
import type { CourtBoard, DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import { ratedName } from './presentationAdapter';
import './courts.css';

const stageLabel: Record<CourtBoard['stage'], string> = { idle: '次の試合を待っています', call: '呼び出し中', live: '試合中', result: '勝者確定' };

function Side({ state, teamId, board }: { state: DrawState; teamId: string | null | undefined; board: CourtBoard }) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return <div className="court-side is-empty" />;
  const people = team.memberIds.map(id => state.participants.find(p => p.id === id)).filter((p): p is Participant => p != null);
  const outcome = board.stage !== 'result' ? '' : board.winnerTeamId === team.id ? ' is-winner' : ' is-loser';
  return <div className={`court-side${outcome}`}>
    <div className="court-faces">{people.map(p => <img key={p.id} src={portraitUrlFor(p)} alt={p.name} />)}</div>
    <p className="court-names">{people.map(p => <span key={p.id}>{ratedName(p)}</span>)}</p>
  </div>;
}

/** Venue view while 2 or 3 boards run at once: one readable match card per board. */
export default function CourtBoards({ state }: { state: DrawState }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const boards = state.flow?.courts?.boards ?? [];
  return <CeremonyFrame stageRef={stageRef} className="court-stage" label={`${boards.length}台で進行中`}>
    <div className="court-grid" style={{ gridTemplateColumns: `repeat(${boards.length}, 1fr)` }}>
      {boards.map(board => <section key={board.board} className={`court-column is-${board.match?.kind ?? 'idle'}`} data-board={board.board} data-stage={board.stage}>
        <header className="court-head">
          <p className="court-no">台 {board.board}</p>
          <p className="court-round">{board.match?.roundName ?? ''}</p>
        </header>
        {board.match ? <div className="court-match">
          <Side state={state} teamId={board.match.teamA} board={board} />
          <p className="court-vs">VS</p>
          <Side state={state} teamId={board.match.teamB} board={board} />
        </div> : <div className="court-match is-idle" />}
        <p className={`court-status is-${board.stage}`}>{stageLabel[board.stage]}</p>
      </section>)}
    </div>
  </CeremonyFrame>;
}
