import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount } from './manager';
import { toStageData } from './stageData';
import { buildVenueAdvances } from '../../checkin/venueAdvance';
import {
  computeLosersBoardLayout,
  loserRoundLabel,
  losersColumns,
  resolveLosersAdvancePath,
  shownLoserColumns,
} from './losersBoard';

describe('losersColumns', () => {
  it('空の枠にも、誰を待っているかを書く', async () => {
    const columns = losersColumns(toStageData(await buildSnapshotForTeamCount(8)));
    const first = columns[0]?.matches[0];
    expect(first?.slots[0].teamId).toBeNull();
    expect(first?.slots[0].source).toBe('ウィナーズ 1回戦の敗者');
    expect(first?.slots[0].origin).toBe('wb_drop');
    expect(first?.slots[1].source).toBe('ウィナーズ 1回戦の敗者');
    const second = columns[1]?.matches[0];
    expect(second?.slots.map((slot) => slot.source).sort()).toEqual([
      'ウィナーズ 2回戦の敗者',
      'ルーザーズ 1回戦の勝者',
    ]);
  });

  it('対戦相手のいない枠は、見出しごと出さない', async () => {
    const shown = shownLoserColumns(losersColumns(toStageData(await buildSnapshotForTeamCount(20))));
    const first = shown[0];
    expect(first?.round).toBe(1);
    expect(first?.matches).toHaveLength(2);
    expect(first?.matches.every((match) => match.slots.every((slot) => slot.source === 'ウィナーズ 1回戦の敗者'))).toBe(true);
    expect(shown.some((column) => column.matches.some((match) => match.slots.every((slot) => slot.source === 'ひとつ前の勝者' && !slot.teamId)))).toBe(false);
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

function noOverlap(matches: { x: number; w: number }[]) {
  const ordered = [...matches].sort((a, b) => a.x - b.x);
  for (let index = 1; index < ordered.length; index += 1) {
    expect(ordered[index].x).toBeGreaterThanOrEqual(ordered[index - 1].x + ordered[index - 1].w - 0.5);
  }
}

describe('computeLosersBoardLayout', () => {
  it('8組で真下つなぎと合流の座標が分かる', async () => {
    const steps = await buildVenueAdvances(
      Array.from({ length: 8 }, (_, index) => `team-${index + 1}`),
      40,
    );
    const found = steps
      .map((step) => computeLosersBoardLayout(toStageData(step.after)))
      .find((layout) => layout.rounds.filter((round) => round.matches.length > 0).length >= 3);
    expect(found).toBeTruthy();
    if (!found) return;
    const [first, second, third] = found.rounds;
    expect(first.kind).toBe('wb_drop_pair');
    expect(first.label).toBe(loserRoundLabel('wb_drop_pair', first.round, first.matches[0]?.slots));
    expect(['survivor_vs_drop', 'survivor_merge']).toContain(second.kind);
    expect(third.y).toBeGreaterThan(second.y);
    for (const row of found.rounds) {
      noOverlap(row.matches);
      expect(row.matches.every((match) => match.slots.length === 2)).toBe(true);
      expect(row.matches.every((match) => match.slots.some((slot) => slot.teamId != null))).toBe(true);
    }
    const stay = found.connectors.find((connector) => connector.fromMatchId === first.matches[0]?.id);
    if (stay && stay.toMatchId > 0) {
      const child = found.byId[stay.toMatchId];
      expect(child.y).toBeGreaterThan(first.matches[0].y);
    }
  });

  it('20組は人が入った試合だけを重ねずに最終戦まで置く', async () => {
    const steps = await buildVenueAdvances(
      Array.from({ length: 20 }, (_, index) => `team-${index + 1}`),
      80,
    );
    const layout = computeLosersBoardLayout(toStageData(steps[steps.length - 1].after));
    expect(layout.rounds.length).toBeGreaterThan(4);
    const rounds = layout.rounds.map((round) => round.round);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
    for (const row of layout.rounds) {
      expect(['wb_drop_pair', 'survivor_vs_drop', 'survivor_merge']).toContain(row.kind);
      expect(row.label).toBe(loserRoundLabel(row.kind, row.round, row.matches[0]?.slots));
      noOverlap(row.matches);
      expect(row.matches.every((match) => match.slots.some((slot) => slot.teamId != null))).toBe(true);
    }
    const last = layout.rounds[layout.rounds.length - 1];
    expect(last.matches).toHaveLength(1);
    expect(layout.grandFinal?.fromMatchId).toBe(last.matches[0].id);
    expect(layout.grandFinal!.y).toBeGreaterThan(last.matches[0].y);
  });

  it('勝者の進む線を試合から取れる', async () => {
    const steps = await buildVenueAdvances(
      Array.from({ length: 8 }, (_, index) => `team-${index + 1}`),
      20,
    );
    const loser = steps.find((step) => step.kind === 'loser');
    expect(loser).toBeTruthy();
    if (!loser) return;
    const layout = computeLosersBoardLayout(toStageData(loser.after));
    const path = resolveLosersAdvancePath(layout, loser.matchId);
    expect(path?.path.length).toBeGreaterThan(0);
    expect(path?.fromMatchId).toBe(loser.matchId);
    expect(path?.target.y).toBeGreaterThan(path!.source.y);
  });
});
