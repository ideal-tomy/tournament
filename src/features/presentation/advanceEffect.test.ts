import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount, toStageData } from '../bracket/manager';
import { detectAdvanceEffect } from './advanceEffect';
import { resolveAdvanceEffectLayout } from './resolveEffectLayout';

describe('detectAdvanceEffect', () => {
  it('1 試合目確定時は演出なし', async () => {
    const snap = await buildSnapshotForTeamCount(8);
    const view = toStageData(snap);
    const first = view.match.find((m) => m.opponent1?.id && m.opponent2?.id);
    expect(first).toBeTruthy();

    const afterFirst = structuredClone(view);
    const m = afterFirst.match.find((x) => x.id === first!.id)!;
    m.status = 4;
    m.opponent1 = { ...m.opponent1!, result: 'win' };
    m.opponent2 = { ...m.opponent2!, result: 'loss' };

    expect(detectAdvanceEffect(afterFirst, first!.id)).toBeNull();
  });

  it('ペア 2 試合目確定で次試合の advanceEffect を返す', async () => {
    const snap = await buildSnapshotForTeamCount(16);
    let view = toStageData(snap);
    const wbR1 = view.match
      .filter((m) => {
        const g = view.group.find((gr) => gr.id === m.group_id);
        const r = view.round.find((rd) => rd.id === m.round_id);
        return g?.number === 1 && r?.number === 1;
      })
      .sort((a, b) => a.number - b.number);

    expect(wbR1.length).toBeGreaterThanOrEqual(2);

    const applyWin = (matchId: number, slot: 0 | 1) => {
      const m = view.match.find((x) => x.id === matchId)!;
      m.status = 4;
      m.opponent1 = { ...m.opponent1!, result: slot === 0 ? 'win' : 'loss' };
      m.opponent2 = { ...m.opponent2!, result: slot === 1 ? 'win' : 'loss' };
    };

    applyWin(wbR1[0].id, 0);
    expect(detectAdvanceEffect(view, wbR1[0].id)).toBeNull();

    applyWin(wbR1[1].id, 1);
    const effect = detectAdvanceEffect(view, wbR1[1].id);
    expect(effect).not.toBeNull();
    expect(effect!.feederMatchIds).toContain(wbR1[0].id);
    expect(effect!.feederMatchIds).toContain(wbR1[1].id);
    expect(effect!.teamAId).toBeTruthy();
    expect(effect!.teamBId).toBeTruthy();

    const layout = resolveAdvanceEffectLayout(view, effect!);
    expect(layout).not.toBeNull();
    expect(layout!.slotA.x).not.toBeCloseTo(layout!.slotB.x, 0);
    expect(layout!.collision.y).toBe(layout!.junctionY);
  });
});
