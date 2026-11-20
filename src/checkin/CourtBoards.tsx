import VsBoard, { type VsSide } from '../features/presentation/vsBoard/VsBoard';
import type { CourtBoard, DrawState, FlowMatch } from './DrawControl';
import './courts.css';

const stageLabel: Record<CourtBoard['stage'], string> = { idle: '待機', call: '呼び出し中', live: '試合中', result: '勝者確定' };

function progressLabel(match: FlowMatch): string {
  if (match.callout === 'final-again') return 'FINAL AGAIN';
  if (match.callout === 'final' || match.final) return 'FINAL';
  if (match.roundName) return match.roundName;
  if (match.kind === 'loser') return `ルーザーズ ${match.round}回戦`;
  if (match.kind === 'grand_final') return 'グランドファイナル';
  return `ウィナーズ ${match.round}回戦`;
}

function Cell({ board, teamOf }: { board: CourtBoard; teamOf(id: string | null | undefined): VsSide }) {
  const match = board.match;
  if (!match || board.stage === 'result') return <div className="court-idle"><p>次の試合を待っています</p></div>;
  const label = [progressLabel(match), stageLabel[board.stage]].filter(Boolean).join(' · ');
  return <VsBoard key={`${board.board}-${match.id}`} contained settled left={teamOf(match.teamA)} right={teamOf(match.teamB)} roundLabel={label} />;
}

function onStage(board: CourtBoard) {
  return board.stage === 'call' || board.stage === 'live';
}

/** 出す試合が1つのときだけ全画面。台の割り当ては変えず、台番号は残す。 */
export default function CourtBoards({ state, teamOf }: { state: DrawState; teamOf(id: string | null | undefined): VsSide }) {
  const boards = state.flow?.courts?.boards ?? [];
  const playing = boards.filter((board) => board.match && onStage(board));
  const shown = playing.length === 1 ? playing : boards;
  return <div className="court-split" style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }} aria-label={shown.length === 1 ? `台 ${shown[0]?.board}` : `${boards.length}台で進行中`}>
    {shown.map(board => <section key={board.board} className="court-cell" data-board={board.board} data-stage={board.stage}>
      <Cell board={board} teamOf={teamOf} />
      {board.match && board.stage !== 'result' && (
        <p className={`court-progress${board.match.kind === 'loser' ? ' is-losers' : ''}`}>{progressLabel(board.match)}</p>
      )}
      <p className="court-tag">台 {board.board}</p>
    </section>)}
  </div>;
}
