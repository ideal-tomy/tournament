import { describe, expect, it } from 'vitest';
import { Status } from 'brackets-model';
import {
  buildDoubleElimination,
  buildSnapshotForTeamCount,
  createManagerFromSnapshot,
  exportSnapshot,
  toStageData,
  type BracketSnapshot,
} from '../bracket/manager';
import type { StageData } from '../bracket/layout';
import {
  applyResult,
  getChampionTeamId,
  getMatchBracketKind,
  getMatchRoundLabel,
  reassignCall,
  selectTwenty,
  TWENTY_WAIT,
  winnersFieldRound,
  type TwentyPhase,
  type TwentyView,
} from './progression';

interface LogRow {
  t: number;
  board: 1 | 2;
  matchId: number;
  kind: string;
  round: number;
  teams: [string, string];
  played: [number, number];
  rest: [number, number];
  reason: string | null;
}

function teamsOf(data: StageData) {
  return data.participant.map((row) => String(row.name)).filter((id) => id.length > 0);
}

function played(data: StageData) {
  const counts = new Map<string, number>();
  for (const match of data.match) {
    if (match.status < Status.Completed || match.opponent1?.id == null || match.opponent2?.id == null) continue;
    for (const slot of [match.opponent1, match.opponent2]) {
      const name = data.participant.find((row) => row.id === slot?.id)?.name;
      if (name) counts.set(String(name), (counts.get(String(name)) ?? 0) + 1);
    }
  }
  return counts;
}

async function finish(
  snapshot: BracketSnapshot,
  options: {
    duration: (board: 1 | 2, nth: number) => number;
    slot: (data: StageData, matchId: number, kind: string) => 0 | 1;
    manual?: boolean;
  },
) {
  let snapshotNow = snapshot;
  let now = 0;
  const openedAt = 0;
  const endedAt = new Map<number, number>();
  let stored: TwentyPhase = 'A';
  const boards: { board: 1 | 2; matchId: number | null; until: number; nth: number }[] = [
    { board: 1, matchId: null, until: 0, nth: 0 },
    { board: 2, matchId: null, until: 0, nth: 0 },
  ];
  const log: LogRow[] = [];
  const idle: { t: number; wait: string | null; candidates: number }[] = [];
  let manualAt: number | null = null;
  let manualCount = 0;
  let swapped = false;
  let sawSwitchWhileLosersRemain = false;
  const active = new Map<number, Set<string>>();

  const view = (): TwentyView => {
    const data = toStageData(snapshotNow);
    const reserved = new Set(boards.flatMap((board) => (board.matchId == null ? [] : [board.matchId])));
    return selectTwenty({ data, storedPhase: stored, reservedMatchIds: reserved, endedAt, openedAt, now });
  };

  for (let guard = 0; guard < 80 && !(await getChampionTeamId(createManagerFromSnapshot(snapshotNow))); guard += 1) {
    const current = view();
    stored = current.phase;
    const data = toStageData(snapshotNow);
    if (current.manual && manualAt == null) {
      manualAt = now;
      manualCount = [...played(data).values()].reduce((sum, count) => sum + count, 0) / 2;
      expect(teamsOf(data).every((id) => (played(data).get(id) ?? 0) >= 1)).toBe(true);
    }
    if (current.phase === 'B' && current.canSwitch && current.candidates.some((row) => getMatchBracketKind(data, row.match) === 'loser')) {
      sawSwitchWhileLosersRemain = true;
    }
    if (options.manual && current.manual && !swapped) {
      const board = boards.find((row) => row.matchId != null);
      if (board?.matchId != null) {
        const reserved = new Set(boards.flatMap((row) => (row.matchId == null || row.board === board.board ? [] : [row.matchId])));
        const choice = selectTwenty({ data, storedPhase: stored, reservedMatchIds: reserved, endedAt, openedAt, now });
        const next = [...choice.candidates].reverse().find((row) => row.match.id !== board.matchId);
        if (next) {
          const rejected = reassignCall(
            { data, storedPhase: stored, reservedMatchIds: new Set([...reserved, board.matchId]), endedAt, openedAt, now },
            board.matchId,
            -1,
          );
          expect(rejected).toBeNull();
          expect(board.matchId).not.toBe(next.match.id);
          const accepted = reassignCall(
            { data, storedPhase: stored, reservedMatchIds: new Set([...reserved, board.matchId]), endedAt, openedAt, now },
            board.matchId,
            next.match.id,
          );
          expect(accepted).toBe(next.match.id);
          const previous = board.matchId;
          board.matchId = next.match.id;
          const again = selectTwenty({
            data,
            storedPhase: stored,
            reservedMatchIds: new Set(boards.flatMap((row) => (row.matchId == null ? [] : [row.matchId]))),
            endedAt,
            openedAt,
            now,
          });
          expect(again.candidates.some((row) => row.match.id === next.match.id)).toBe(false);
          expect(again.priority?.match.id).not.toBe(next.match.id);
          expect(again.candidates.some((row) => row.match.id === previous) || again.wait !== null).toBe(true);
          swapped = true;
        }
      }
    }

    let assigned = false;
    for (const board of boards) {
      if (board.matchId != null) continue;
      const pick = view();
      if (!pick.priority) {
        idle.push({ t: now, wait: pick.wait, candidates: pick.candidates.length });
        expect(pick.candidates).toHaveLength(0);
        continue;
      }
      const row = pick.priority;
      const kind = getMatchBracketKind(data, row.match);
      const busy = new Set<string>();
      for (const other of boards) {
        if (other.matchId == null) continue;
        active.get(other.matchId)?.forEach((id) => busy.add(id));
      }
      expect(busy.has(row.teamA)).toBe(false);
      expect(busy.has(row.teamB)).toBe(false);
      expect(boards.some((other) => other.matchId === row.match.id)).toBe(false);
      if (pick.phase === 'A') {
        expect(kind).toBe('winner');
        expect(getMatchRoundLabel(data, row.match)).toBeLessThanOrEqual(winnersFieldRound(data));
      }
      if (pick.phase === 'B') expect(kind).toBe('loser');
      board.nth += 1;
      board.matchId = row.match.id;
      board.until = now + options.duration(board.board, board.nth);
      active.set(row.match.id, new Set([row.teamA, row.teamB]));
      log.push({
        t: now,
        board: board.board,
        matchId: row.match.id,
        kind,
        round: getMatchRoundLabel(data, row.match),
        teams: [row.teamA, row.teamB],
        played: [row.playedA, row.playedB],
        rest: [row.restA, row.restB],
        reason: row.reason,
      });
      assigned = true;
    }

    if (!boards.some((board) => board.matchId != null)) {
      if (current.phase === 'B' && current.promptSwitch) {
        stored = 'C';
        continue;
      }
      if (current.wait === TWENTY_WAIT.finished || current.wait === TWENTY_WAIT.opponent || current.wait === TWENTY_WAIT.phase) break;
      throw new Error(current.wait ?? '候補があるのに割り当てられていません');
      break;
    }
    if (!assigned && boards.every((board) => board.matchId == null)) break;

    const nextAt = Math.min(...boards.flatMap((board) => (board.matchId == null ? [] : [board.until])));
    now = nextAt;
    for (const board of boards) {
      if (board.matchId == null || board.until !== now) continue;
      const dataNow = toStageData(snapshotNow);
      const match = dataNow.match.find((row) => row.id === board.matchId);
      expect(match).toBeTruthy();
      const kind = getMatchBracketKind(dataNow, match!);
      const slot = options.slot(dataNow, match!.id, kind);
      const manager = createManagerFromSnapshot(snapshotNow);
      await applyResult(manager, dataNow, match!.id, slot, match!.id);
      snapshotNow = await exportSnapshot(manager);
      endedAt.set(match!.id, now);
      active.delete(match!.id);
      board.matchId = null;
    }
  }

  const champion = await getChampionTeamId(createManagerFromSnapshot(snapshotNow));
  return { log, idle, champion, manualAt, manualCount, swapped, sawSwitchWhileLosersRemain, snapshot: snapshotNow };
}

describe('20チーム・2台の進行', () => {
  it('1回戦が確保中でも、決まっている2回戦を空いた側の候補にする', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const first = data.match.filter(
      (match) => getMatchBracketKind(data, match) === 'winner' && getMatchRoundLabel(data, match) === 1 && match.opponent1?.id != null && match.opponent2?.id != null,
    );
    expect(first.length).toBeGreaterThan(0);
    const view = selectTwenty({
      data,
      storedPhase: 'A',
      reservedMatchIds: new Set(first.map((match) => match.id)),
      endedAt: new Map(),
      openedAt: 0,
      now: 0,
    });
    expect(view.priority?.reason).toBe('初戦同士');
    expect(getMatchRoundLabel(data, view.priority!.match)).toBe(2);
    expect(view.manual).toBe(false);
    expect(reassignCall({ data, storedPhase: 'A', reservedMatchIds: new Set(), endedAt: new Map(), openedAt: 0, now: 0 }, null, view.priority!.match.id)).toBeNull();
  });

  it('標準配置は長短の試合と手動入替のあと完走し、全員の初戦で手動が開く', async () => {
    const result = await finish(await buildSnapshotForTeamCount(20), {
      duration: (board) => (board === 1 ? 10 : 25),
      slot: (_data, _id, kind) => (kind === 'grand_final' ? 0 : 0),
      manual: true,
    });
    expect(result.champion).toMatch(/^team-/);
    expect(result.swapped).toBe(true);
    expect(result.sawSwitchWhileLosersRemain).toBe(true);
    expect(result.manualCount).toBe(10);
    expect(result.log.some((row) => row.kind === 'grand_final')).toBe(true);
    expect(result.log.filter((row) => row.kind === 'grand_final')).toHaveLength(1);
    const firstEnd = Math.min(...result.log.filter((row) => row.board === 1).map((row) => row.t + 10));
    expect(result.log.some((row) => row.board === 2 && row.t >= 25)).toBe(true);
    expect(firstEnd).toBeLessThan(25);
    expect(result.idle.every((row) => row.candidates === 0)).toBe(true);
  });

  it('台2が先に終わり、勝敗を散らすとリセット戦まで完走する', async () => {
    const result = await finish(await buildSnapshotForTeamCount(20), {
      duration: (board, nth) => (board === 1 && nth === 1 ? 40 : board === 1 ? 10 : 8),
      slot: (_data, matchId, kind) => (kind === 'grand_final' ? 1 : (matchId % 2 === 0 ? 0 : 1)),
    });
    expect(result.champion).toMatch(/^team-/);
    expect(result.log.filter((row) => row.kind === 'grand_final').length).toBeGreaterThanOrEqual(2);
    const board2 = result.log.find((row) => row.board === 2 && row.t === 8);
    expect(board2).toBeTruthy();
    expect(result.log.some((row) => row.board === 1 && row.t === 0 && row.matchId !== board2!.matchId)).toBe(true);
  });

  it('不戦勝の位置が違っても、手動解禁は全チームの実試合数で決まる', async () => {
    const reversed = await buildDoubleElimination(
      Array.from({ length: 20 }, (_, index) => `team-${index % 2 === 0 ? index / 2 : 19 - (index - 1) / 2}`),
    );
    const result = await finish(reversed, {
      duration: () => 12,
      slot: (_data, matchId) => (matchId % 2 === 0 ? 0 : 1),
    });
    expect(result.champion).toMatch(/^team-/);
    expect(result.manualAt).not.toBeNull();
    const at = toStageData(result.snapshot);
    expect(teamsOf(at).every((id) => (played(at).get(id) ?? 0) >= 1)).toBe(true);
    expect(result.sawSwitchWhileLosersRemain).toBe(true);
  });
});
