import VsBoard, { type VsSide } from '../features/presentation/vsBoard/VsBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import type { CourtBoard, DrawState, FlowMatch } from './DrawControl';
import './courts.css';

const stageLabel: Record<CourtBoard['stage'], string> = { idle: '待機', call: '呼び出し中', live: '試合中', result: '勝者確定' };

function progressLabel(match: FlowMatch): string {
  if (match.final) return 'FINAL';
  if (match.roundName) return match.roundName;
  if (match.kind === 'loser') return `ルーザーズ ${match.round}回戦`;
  if (match.kind === 'grand_final') return 'グランドファイナル';
  return `ウィナーズ ${match.round}回戦`;
}

function Cell({ board, teamOf }: { board: CourtBoard; teamOf(id: string | null | undefined): VsSide }) {
  const match = board.match;
  if (!match) return <div className="court-idle"><p>次の試合を待っています</p></div>;
  if (board.stage === 'result' && board.winnerTeamId) {
    return (
      <WinnerBoard
        key={`${board.board}-${match.id}-result`}
        contained
        settled
        team={teamOf(board.winnerTeamId)}
        opponent={teamOf(board.loserTeamId)}
        dropLabel={match.kind === 'winner' ? 'ルーザーへ→' : '敗退→'}
      />
    );
  }
  const label = [progressLabel(match), stageLabel[board.stage]].filter(Boolean).join(' · ');
  return <VsBoard key={`${board.board}-${match.id}`} contained settled left={teamOf(match.teamA)} right={teamOf(match.teamB)} roundLabel={label} />;
}

/** Waiting view while 2 or 3 boards run: the single-board VS stage, scaled into one column per board. */
export default function CourtBoards({ state, teamOf }: { state: DrawState; teamOf(id: string | null | undefined): VsSide }) {
  const boards = state.flow?.courts?.boards ?? [];
  return <div className="court-split" style={{ gridTemplateColumns: `repeat(${boards.length}, 1fr)` }} aria-label={`${boards.length}台で進行中`}>
    {boards.map(board => <section key={board.board} className="court-cell" data-board={board.board} data-stage={board.stage}>
      <Cell board={board} teamOf={teamOf} />
      {board.match && (
        <p className={`court-progress${board.match.kind === 'loser' ? ' is-losers' : ''}`}>{progressLabel(board.match)}</p>
      )}
      <p className="court-tag">台 {board.board}</p>
    </section>)}
  </div>;
}
