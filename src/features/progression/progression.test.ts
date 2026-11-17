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
  getChapterMatches,
  COURT_WAIT,
  explainCourtFillWait,
  getCourtFillMatches,
  getChampionTeamId,
  getFinalPlacements,
  getMatchBracketKind,
  getMatchRoundLabel,
  getNextMatch,
  getSlotTeamUuid,
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

describe('progression — chapter schedule', () => {
  it('8 チーム DE: 無敗4チームになったあとルーザーへ入り、ウィナー2回戦の前に戻さない', async () => {
    let snapshot = await buildSnapshotForTeamCount(8);
    let data = toStageData(snapshot);
    const first = getChapterMatches(data);
    expect(first).toHaveLength(4);
    expect(first.every((m) => getMatchBracketKind(data, m) === 'winner' && getMatchRoundLabel(data, m) === 1)).toBe(true);
    for (const match of first) {
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
    }
    data = toStageData(snapshot);
    const second = getChapterMatches(data);
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((m) => getMatchBracketKind(data, m) === 'loser')).toBe(true);
    for (let guard = 0; guard < 20; guard += 1) {
      const chapter = getChapterMatches(toStageData(snapshot));
      if (!chapter.length || getMatchBracketKind(toStageData(snapshot), chapter[0]) !== 'loser') break;
      for (const match of chapter) {
        const manager = createManagerFromSnapshot(snapshot);
        await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
        snapshot = await exportSnapshot(manager);
      }
    }
    data = toStageData(snapshot);
    const back = getChapterMatches(data);
    expect(back.length).toBeGreaterThan(0);
    expect(back.every((m) => getMatchBracketKind(data, m) === 'winner' && getMatchRoundLabel(data, m) >= 2)).toBe(true);
  });

  it.each([8, 20])('%i チーム DE: 無敗が4チームになるまでルーザーを出さず、優勝まで届く', async (count) => {
    let snapshot = await buildSnapshotForTeamCount(count);
    let sawLoser = false;
    for (let guard = 0; guard < 400; guard++) {
      const data = toStageData(snapshot);
      const [match] = getChapterMatches(data);
      if (!match) break;
      const kind = getMatchBracketKind(data, match);
      const round = getMatchRoundLabel(data, match);
      if (kind === 'loser') {
        sawLoser = true;
        const field = count <= 4 ? 0 : Math.round(Math.log2(2 ** Math.ceil(Math.log2(count)) / 4));
        const fieldOpen = data.match.some(
          (m) =>
            getMatchBracketKind(data, m) === 'winner' &&
            getMatchRoundLabel(data, m) <= field &&
            m.status < Status.Completed &&
            m.opponent1 !== null &&
            m.opponent2 !== null,
        );
        expect(fieldOpen).toBe(false);
      } else if (kind === 'winner' && round <= (count <= 4 ? 0 : Math.round(Math.log2(2 ** Math.ceil(Math.log2(count)) / 4)))) {
        expect(sawLoser).toBe(false);
      }
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, data, match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
      if (await isTournamentFinished(createManagerFromSnapshot(snapshot))) break;
    }
    expect(sawLoser).toBe(true);
    expect(await getChampionTeamId(createManagerFromSnapshot(snapshot))).toMatch(/^team-\d+$/);
  });
});

describe('progression — court fill', () => {
  it('8チームは1回戦のあと、進行中のルーザー回戦だけを返す', async () => {
    let snapshot = await buildSnapshotForTeamCount(8);
    for (const match of getChapterMatches(toStageData(snapshot))) {
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
    }
    const data = toStageData(snapshot);
    const chapter = getChapterMatches(data);
    expect(chapter.every((m) => getMatchBracketKind(data, m) === 'loser')).toBe(true);
    const [running] = chapter;
    const manager = createManagerFromSnapshot(snapshot);
    await manager.update.match({ id: running.id, status: Status.Running });
    snapshot = await exportSnapshot(manager);
    const after = toStageData(snapshot);
    const fill = getCourtFillMatches(after, new Set([running.id]));
    expect(fill.matches.length).toBeGreaterThan(0);
    expect(fill.matches.every((m) => m.id !== running.id && getMatchBracketKind(after, m) === 'loser')).toBe(true);
  });

  it('ルーザー1回戦が残っているあいだは2回戦を出さない', async () => {
    let snapshot = await buildSnapshotForTeamCount(8);
    for (const match of getChapterMatches(toStageData(snapshot))) {
      const manager = createManagerFromSnapshot(snapshot);
      await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
      snapshot = await exportSnapshot(manager);
    }
    const firstLoser = getChapterMatches(toStageData(snapshot))[0];
    expect(firstLoser).toBeTruthy();
    expect(getMatchBracketKind(toStageData(snapshot), firstLoser!)).toBe('loser');
    expect(getMatchRoundLabel(toStageData(snapshot), firstLoser!)).toBe(1);
    const manager = createManagerFromSnapshot(snapshot);
    await applyResult(manager, toStageData(snapshot), firstLoser!.id, 0, firstLoser!.id);
    snapshot = await exportSnapshot(manager);
    const after = toStageData(snapshot);
    const chapter = getChapterMatches(after);
    expect(chapter.length).toBeGreaterThan(0);
    expect(chapter.every((m) => getMatchBracketKind(after, m) === 'loser' && getMatchRoundLabel(after, m) === 1)).toBe(true);
    const rested = new Set(
      [getSlotTeamUuid(after, firstLoser!, 0), getSlotTeamUuid(after, firstLoser!, 1)].filter((id): id is string => !!id),
    );
    const fill = getCourtFillMatches(after, new Set(), rested);
    expect(fill.matches.every((m) => getMatchRoundLabel(after, m) === 1)).toBe(true);
  });

  it('20チームは未出場を先に入れ、ウィナー2回戦が終わるまでルーザーを出さない', async () => {
    let snapshot = await buildSnapshotForTeamCount(20);
    const playChapter = async () => {
      for (const match of getChapterMatches(toStageData(snapshot))) {
        const manager = createManagerFromSnapshot(snapshot);
        await applyResult(manager, toStageData(snapshot), match.id, 0, match.id);
        snapshot = await exportSnapshot(manager);
      }
    };
    await playChapter();
    const afterR1 = toStageData(snapshot);
    const fill = getCourtFillMatches(afterR1).matches;
    const played = new Set<string>();
    for (const match of afterR1.match) {
      if (match.status < Status.Completed || match.opponent1?.id == null || match.opponent2?.id == null) continue;
      for (const slot of [0, 1] as const) {
        const id = getSlotTeamUuid(afterR1, match, slot);
        if (id) played.add(id);
      }
    }
    const load = (match: (typeof fill)[number]) =>
      [0, 1].reduce((sum, slot) => sum + (played.has(getSlotTeamUuid(afterR1, match, slot as 0 | 1) ?? '') ? 1 : 0), 0);
    expect(fill.length).toBeGreaterThan(1);
    expect(fill.every((m) => getMatchBracketKind(afterR1, m) === 'winner' && getMatchRoundLabel(afterR1, m) === 2)).toBe(true);
    expect(load(fill[0])).toBe(0);
    expect(Math.min(...fill.map(load))).toBe(load(fill[0]));
    const rested = new Set(
      [getSlotTeamUuid(afterR1, fill.find((m) => load(m) > 0) ?? fill[0], 0), getSlotTeamUuid(afterR1, fill.find((m) => load(m) > 0) ?? fill[0], 1)].filter(
        (id): id is string => !!id,
      ),
    );
    const deferred = getCourtFillMatches(afterR1, new Set(), rested);
    expect(deferred.matches[0] && load(deferred.matches[0])).toBe(0);
    await playChapter();
    const afterR2 = toStageData(snapshot);
    expect(getCourtFillMatches(afterR2).matches.every((m) => getMatchBracketKind(afterR2, m) === 'winner' && getMatchRoundLabel(afterR2, m) === 3)).toBe(true);
    await playChapter();
    const afterR3 = toStageData(snapshot);
    expect(getCourtFillMatches(afterR3).matches.every((m) => getMatchBracketKind(afterR3, m) === 'loser')).toBe(true);
  });

  it('直前のチームを含む試合は、他に候補があるとき後回しにする', async () => {
    const snapshot = await buildSnapshotForTeamCount(8);
    const data = toStageData(snapshot);
    const ready = getCourtFillMatches(data).matches;
    expect(ready.length).toBeGreaterThan(1);
    const first = ready[0];
    const rest = new Set(
      [getSlotTeamUuid(data, first, 0), getSlotTeamUuid(data, first, 1)].filter((id): id is string => !!id),
    );
    const deferred = getCourtFillMatches(data, new Set(), rest);
    expect(deferred.deferredRest).toBe(true);
    expect(explainCourtFillWait(data, new Set(), rest)).toBe(COURT_WAIT.rest);
    expect(deferred.matches[0]?.id).not.toBe(first.id);
    const only = getCourtFillMatches(data, new Set(ready.slice(1).map((m) => m.id)), rest);
    expect(only.matches.map((m) => m.id)).toContain(first.id);
  });

  it('同じ回戦がまだ終わっていない空欄は、次の回戦を待たせる', async () => {
    const snapshot = await buildSnapshotForTeamCount(8);
    const data = toStageData(snapshot);
    const ready = getCourtFillMatches(data).matches;
    expect(explainCourtFillWait(data)).toBeNull();
    const running = ready[0];
    const manager = createManagerFromSnapshot(snapshot);
    await manager.update.match({ id: running.id, status: Status.Running });
    const after = toStageData(await exportSnapshot(manager));
    const exclude = new Set([...getCourtFillMatches(after).matches.map((m) => m.id), running.id]);
    expect(getCourtFillMatches(after, exclude).matches).toEqual([]);
    expect(explainCourtFillWait(after, exclude)).toBe(COURT_WAIT.round);
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
