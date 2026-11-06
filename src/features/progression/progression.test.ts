import { describe, expect, it } from 'vitest';
import { Status } from 'brackets-model';
import {
  buildSnapshotForTeamCount,
  createManagerFromSnapshot,
  exportSnapshot,
  toStageData,
  type BracketSnapshot,
} from '../bracket/manager';
import type { StageData } from '../bracket/layout';
import {
  applyResult,
  getBottomTierMatches,
  getChampionTeamId,
  getFinalPlacements,
  getMatchBracketKind,
  getMatchTier,
  getNextMatch,
  isTournamentFinished,
} from './progression';

async function playNext(
  snapshot: BracketSnapshot,
  pickWinner?: (match: StageData['match'][0], data: StageData) => 0 | 1,
): Promise<BracketSnapshot> {
  const view = toStageData(snapshot);
  const next = getNextMatch(view);
  if (!next) return snapshot;

  let winnerSlot: 0 | 1 = next.opponent1?.id != null ? 0 : 1;
  if (next.opponent1?.id != null && next.opponent2?.id != null) {
    winnerSlot = pickWinner ? pickWinner(next, view) : 0;
  }

  const manager = createManagerFromSnapshot(snapshot);
  await applyResult(manager, view, next.id, winnerSlot, next.id);
  return exportSnapshot(manager);
}

async function runToCompletion(
  teamCount: number,
  pickWinner?: (match: StageData['match'][0], data: StageData) => 0 | 1,
): Promise<{ snapshot: BracketSnapshot; champion: string | null }> {
  let snapshot = await buildSnapshotForTeamCount(teamCount);
  let guard = 0;

  while (guard++ < 200) {
    const manager = createManagerFromSnapshot(snapshot);
    if (await isTournamentFinished(manager)) break;
    const next = getNextMatch(toStageData(snapshot));
    if (!next) break;
    snapshot = await playNext(snapshot, pickWinner);
  }

  const manager = createManagerFromSnapshot(snapshot);
  const champion = await getChampionTeamId(manager);
  return { snapshot, champion };
}

describe('progression — full tournament', () => {
  it.each([0,1] as const)('2 チームの保存済み決勝結果から優勝を取得（slot %i）',async slot=>{
    let snapshot=await buildSnapshotForTeamCount(2);const before=createManagerFromSnapshot(snapshot);
    expect(await getChampionTeamId(before)).toBeNull();expect(await isTournamentFinished(before)).toBe(false);
    snapshot=await playNext(snapshot,()=>slot);const manager=createManagerFromSnapshot(snapshot);
    expect(await getChampionTeamId(manager)).toBe(`team-${slot}`);expect(await isTournamentFinished(manager)).toBe(true);
  });
  it('2 チームは 1位・2位だけ、4 チーム DE は 1位・2位・3位が1チームずつ', async () => {
    let two = await buildSnapshotForTeamCount(2);
    expect(await getFinalPlacements(createManagerFromSnapshot(two))).toBeNull();
    two = await playNext(two, () => 1);
    expect(await getFinalPlacements(createManagerFromSnapshot(two))).toEqual({ first: 'team-1', second: ['team-0'], third: [] });
    const { snapshot, champion } = await runToCompletion(4);
    const placements = (await getFinalPlacements(createManagerFromSnapshot(snapshot)))!;
    expect(placements.first).toBe(champion);
    expect(placements.second).toHaveLength(1);
    expect(placements.third).toHaveLength(1);
    expect(new Set([placements.first, ...placements.second, ...placements.third]).size).toBe(3);
  });
  it('4 チーム DE: 全試合完走・優勝 1 チーム', async () => {
    const { snapshot, champion } = await runToCompletion(4);
    const manager = createManagerFromSnapshot(snapshot);
    expect(await isTournamentFinished(manager)).toBe(true);
    expect(champion).toMatch(/^team-\d+$/);
  });

  it('8 チーム DE: 全試合完走', async () => {
    const { champion } = await runToCompletion(8);
    expect(champion).toMatch(/^team-\d+$/);
  });

  it('7 チーム + BYE: 完走', async () => {
    const { champion } = await runToCompletion(7);
    expect(champion).toMatch(/^team-\d+$/);
  });
});

describe('progression — grand final reset', () => {
  it('GF 第1試合 LB 勝利 → 第2試合が Ready', async () => {
    let snapshot = await buildSnapshotForTeamCount(4);

    for (let i = 0; i < 50; i++) {
      const manager = createManagerFromSnapshot(snapshot);
      if (await isTournamentFinished(manager)) break;

      const view = toStageData(snapshot);
      const next = getNextMatch(view);
      if (!next) break;

      const group = view.group.find((g) => g.id === next.group_id);
      let winnerSlot: 0 | 1 = next.opponent1?.id != null ? 0 : 1;
      if (next.opponent1?.id != null && next.opponent2?.id != null) {
        winnerSlot = group?.number === 3 ? 1 : 0;
      }

      const manager2 = createManagerFromSnapshot(snapshot);
      await applyResult(manager2, view, next.id, winnerSlot, next.id);
      snapshot = await exportSnapshot(manager2);
    }

    const view = toStageData(snapshot);
    const gfGroup = view.group.find((g) => g.number === 3)!;
    const gfMatches = view.match
      .filter((m) => m.group_id === gfGroup.id)
      .sort((a, b) => a.id - b.id);

    expect(gfMatches.length).toBeGreaterThanOrEqual(2);
    expect(gfMatches[0].status).toBe(Status.Archived);
    expect(gfMatches[1].status).toBe(Status.Completed);
  });

  it('GF 第1試合 WB 勝利 → 即優勝（finalStandings 成立）', async () => {
    let snapshot = await buildSnapshotForTeamCount(4);

    for (let i = 0; i < 50; i++) {
      const manager = createManagerFromSnapshot(snapshot);
      if (await isTournamentFinished(manager)) break;

      const view = toStageData(snapshot);
      const next = getNextMatch(view);
      if (!next) break;

      const group = view.group.find((g) => g.id === next.group_id);
      let winnerSlot: 0 | 1 = next.opponent1?.id != null ? 0 : 1;
      if (next.opponent1?.id != null && next.opponent2?.id != null) {
        winnerSlot = group?.number === 3 ? 0 : 0;
      }

      const manager2 = createManagerFromSnapshot(snapshot);
      await applyResult(manager2, view, next.id, winnerSlot, next.id);
      snapshot = await exportSnapshot(manager2);

      if (group?.number === 3) break;
    }

    const manager = createManagerFromSnapshot(snapshot);
    expect(await isTournamentFinished(manager)).toBe(true);
    const champion = await getChampionTeamId(manager);
    expect(champion).toBe('team-0');
  });
});

describe('progression — bottom tier first', () => {
  it('8 チーム DE: ウィナーズ1回戦とルーザーズ1回戦を2回戦より先に返す', async () => {
    let snapshot = await buildSnapshotForTeamCount(8);
    let data = toStageData(snapshot);
    const first = getBottomTierMatches(data);
    expect(first).toHaveLength(4);
    expect(first.every((m) => getMatchBracketKind(data, m) === 'winner' && getMatchTier(data, m) === 1)).toBe(true);
    for (const match of first) {
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
    }
    data = toStageData(snapshot);
    const second = getBottomTierMatches(data);
    expect(second.map((m) => getMatchBracketKind(data, m))).toEqual(['loser', 'loser']);
    expect(second.every((m) => getMatchTier(data, m) === 1)).toBe(true);
    expect(getBottomTierMatches(data, new Set(second.map((m) => m.id)))).toEqual([]);
  });

  it.each([8, 18])('%i チーム DE: 下の段を終えてから上の段へ進み、優勝まで届く', async (count) => {
    let snapshot = await buildSnapshotForTeamCount(count);
    let tier = 0;
    for (let guard = 0; guard < 200; guard++) {
      const data = toStageData(snapshot);
      const [match] = getBottomTierMatches(data);
      if (!match) break;
      const at = getMatchTier(data, match);
      expect(at).toBeGreaterThanOrEqual(tier);
      tier = at;
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, data, match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
      if (await isTournamentFinished(createManagerFromSnapshot(snapshot))) break;
    }
    expect(await getChampionTeamId(createManagerFromSnapshot(snapshot))).toMatch(/^team-\d+$/);
  });
});

describe('progression — undo', () => {
  it('undo → 別勝者入力でブラケット整合', async () => {
    let snapshot = await buildSnapshotForTeamCount(4);
    const before = structuredClone(snapshot);

    snapshot = await playNext(snapshot);
    const afterFirst = structuredClone(snapshot);

    const undoneMatch = getNextMatch(toStageData(before));
    expect(undoneMatch).not.toBeNull();

    snapshot = before;
    const manager = createManagerFromSnapshot(snapshot);
    await applyResult(
      manager,
      toStageData(snapshot),
      undoneMatch!.id,
      1,
      undoneMatch!.id,
    );
    snapshot = await exportSnapshot(manager);

    expect(snapshot).not.toEqual(afterFirst);

    const origWinner = toStageData(afterFirst).match.find((m) => m.id === undoneMatch!.id);
    const newWinner = toStageData(snapshot).match.find((m) => m.id === undoneMatch!.id);
    expect(origWinner?.opponent1?.result).not.toBe(newWinner?.opponent1?.result);

    for (let i = 0; i < 50; i++) {
      const mgr = createManagerFromSnapshot(snapshot);
      if (await isTournamentFinished(mgr)) break;
      const next = getNextMatch(toStageData(snapshot));
      if (!next) break;
      snapshot = await playNext(snapshot);
    }

    expect(await isTournamentFinished(createManagerFromSnapshot(snapshot))).toBe(true);
  });
});
