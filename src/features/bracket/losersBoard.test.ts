import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount } from './manager';
import { toStageData } from './stageData';
import { losersColumns } from './losersBoard';

describe('losersColumns', () => {
  it('空の枠にも、誰を待っているかを書く', async () => {
    const columns = losersColumns(toStageData(await buildSnapshotForTeamCount(8)));
    const first = columns[0]?.matches[0];
    expect(first?.slots[0].teamId).toBeNull();
    expect(first?.slots[0].source).toBe('ウィナーズ 1回戦の敗者');
    expect(first?.slots[1].source).toBe('ウィナーズ 1回戦の敗者');
    const second = columns[1]?.matches[0];
    expect(second?.slots.map((slot) => slot.source).sort()).toEqual([
      'ウィナーズ 2回戦の敗者',
      'ルーザーズ 1回戦の勝者',
    ]);
  });

  it('20チームでも回戦の列が揃う', async () => {
    const columns = losersColumns(toStageData(await buildSnapshotForTeamCount(20)));
    expect(columns.length).toBeGreaterThan(4);
    expect(columns.every((column, index) => column.round === index + 1)).toBe(true);
    expect(columns.flatMap((column) => column.matches).length).toBeGreaterThan(10);
  });

  it('奇数回戦は同じ段へ、偶数回戦は2試合が1つに繋がる', async () => {
    const columns = losersColumns(toStageData(await buildSnapshotForTeamCount(8)));
    const [first, second, third] = columns;
    expect(first.matches[0]?.nextId).toBe(second.matches[0]?.id);
    expect(first.matches[1]?.nextId).toBe(second.matches[1]?.id);
    expect(second.matches[0]?.nextId).toBe(third.matches[0]?.id);
    expect(second.matches[1]?.nextId).toBe(third.matches[0]?.id);
  });
});
