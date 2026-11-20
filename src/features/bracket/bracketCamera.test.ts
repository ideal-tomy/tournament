import { describe, expect, it } from 'vitest';
import { Status } from 'brackets-model';
import { buildSnapshotForTeamCount } from './manager';
import { toStageData } from './stageData';
import {
  losersNextId,
  splitLoserWaitSource,
  venueCameraRounds,
  venueFocusRound,
  venuePulseMatchIds,
} from './bracketCamera';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';

describe('venueCameraRounds', () => {
  it('いまの回戦と次の1列だけを返す', () => {
    expect(venueCameraRounds(1, 8)).toEqual([1, 2]);
    expect(venueCameraRounds(5, 8)).toEqual([5, 6]);
    expect(venueCameraRounds(8, 8)).toEqual([8]);
  });
});

describe('venueFocusRound', () => {
  it('進行中の試合の回戦を優先する', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const loser = data.match.find((match) => getMatchBracketKind(data, match) === 'loser' && getMatchRoundLabel(data, match) === 5);
    expect(loser).toBeTruthy();
    expect(venueFocusRound(data, 'losers', { liveMatchIds: [loser!.id] })).toBe(5);
  });

  it('進行も呼び出しも無いときは未了の一番下', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(8));
    for (const match of data.match) {
      if (getMatchBracketKind(data, match) !== 'loser') continue;
      if (getMatchRoundLabel(data, match) === 1) match.status = Status.Completed;
    }
    expect(venueFocusRound(data, 'losers')).toBe(2);
  });
});

describe('venuePulseMatchIds', () => {
  it('進行中は両台だけ、確定後は次の枠だけ', () => {
    expect(venuePulseMatchIds({
      liveMatchIds: [10, 11],
      resultMatchIds: [],
      nextIdOf: () => 99,
    })).toEqual([10, 11]);
    expect(venuePulseMatchIds({
      liveMatchIds: [10],
      resultMatchIds: [20],
      nextIdOf: (id) => (id === 20 ? 21 : null),
    })).toEqual([10, 21]);
  });
});

describe('splitLoserWaitSource', () => {
  it('回戦と待機を2行に分ける', () => {
    expect(splitLoserWaitSource('ルーザーズ 4回戦の勝者')).toEqual(['ルーザーズ 4回戦', '勝者を待機']);
    expect(splitLoserWaitSource('ウィナーズ 2回戦の敗者')).toEqual(['ウィナーズ 2回戦', '敗者を待機']);
    expect(splitLoserWaitSource('ひとつ前の勝者')).toEqual(['ひとつ前の勝者', '待機']);
  });
});

describe('losersNextId', () => {
  it('ルーザーズの次の試合を返す', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(8));
    const first = data.match.find((match) => getMatchBracketKind(data, match) === 'loser' && getMatchRoundLabel(data, match) === 1);
    expect(first).toBeTruthy();
    expect(losersNextId(data, first!.id)).not.toBeNull();
  });
});
