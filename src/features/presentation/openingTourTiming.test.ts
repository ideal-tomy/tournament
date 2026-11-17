import { describe, expect, it } from 'vitest';
import { buildDoubleElimination, buildSnapshotForTeamCount, toStageData } from '../bracket/manager';
import { computeBracketLayout } from '../bracket/layout';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';
import {
  BRACKET_TOUR_HOLD_SEC,
  BRACKET_TOUR_OVERVIEW_SEC,
  BRACKET_TOUR_STOPS,
  BRACKET_TOUR_ZOOM_SEC,
  openingTourCaption,
  openingTourCaptionIndex,
  openingTourDurationSec,
  fitTourAspect,
  openingTourFrame,
  openingTourStops,
  openingTourViewAt,
} from './openingTourTiming';

describe('opening bracket camera', () => {
  it('introduces each of 20 teams once, including bye placements, from left to right', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const stops = openingTourStops(data);
    const teams = stops.flatMap((stop) => stop.teamIds);
    expect(stops).toHaveLength(BRACKET_TOUR_STOPS);
    expect(stops.every((stop) => stop.matchIds.length === 4)).toBe(true);
    expect(new Set(teams).size).toBe(teams.length);
    expect(teams).toHaveLength(20);

    const layout = computeBracketLayout(data, undefined, 'winners');
    const centers = stops.map((stop) => layout.byId[stop.matchIds[0]].box.x);
    expect(centers).toEqual([...centers].sort((a, b) => a - b));
    const frames = stops.map((stop) => openingTourFrame(data, stop.matchIds).x);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    const matchIds = stops.flatMap((stop) => stop.matchIds);
    expect(new Set(matchIds).size).toBe(matchIds.length);

    const bothSidedFirstRound = data.match.filter(
      (match) =>
        getMatchBracketKind(data, match) === 'winner' &&
        getMatchRoundLabel(data, match) === 1 &&
        match.opponent1?.id != null &&
        match.opponent2?.id != null,
    );
    expect(teams.length).toBeGreaterThan(bothSidedFirstRound.length * 2);
  });

  it('describes an undecided opponent as the winner of the feeder match', async () => {
    const data = toStageData(
      await buildDoubleElimination(['A', 'B', 'C', null, 'D', null, null, null], { balanceByes: false }),
    );
    const labels = Object.fromEntries(data.participant.map((person) => [person.name, person.name]));
    const waiting = data.match.find(
      (match) =>
        getMatchBracketKind(data, match) === 'winner' &&
        getMatchRoundLabel(data, match) === 2 &&
        (match.opponent1?.id == null || match.opponent2?.id == null) &&
        (match.opponent1?.id != null || match.opponent2?.id != null),
    );
    expect(waiting).toBeTruthy();
    const caption = openingTourCaption(data, [waiting!.id], labels);
    expect(caption).toContain('A対Bの勝者');
    expect(caption).toContain('C');
    expect(caption).not.toContain('BYE');
  });

  it('centers the second round and keeps the zoom aspect steady', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const layout = computeBracketLayout(data, undefined, 'winners');
    const stop = openingTourStops(data)[0];
    const frame = openingTourFrame(data, stop.matchIds);
    for (const id of stop.matchIds) {
      const box = layout.byId[id].box;
      expect(frame.x).toBeLessThanOrEqual(box.x);
      expect(frame.x + frame.w).toBeGreaterThanOrEqual(box.x + box.w);
    }
    const parents = [...new Set(stop.matchIds.map((id) => layout.matches.find((match) => match.round === 2 && Math.abs(layout.byId[id].center.x - match.center.x) < layout.byId[id].box.w)))];
    expect(parents.length).toBeGreaterThan(0);
    const cx = parents.reduce((sum, match) => sum + match!.center.x, 0) / parents.length;
    const cy = parents.reduce((sum, match) => sum + match!.center.y, 0) / parents.length;
    expect(Math.abs(cx - (frame.x + frame.w / 2))).toBeLessThan(2);
    expect(Math.abs(cy - (frame.y + frame.h / 2))).toBeLessThan(2);
    const aspect = frame.w / frame.h;
    const full = fitTourAspect({ x: 0, y: 0, w: layout.width, h: layout.height }, aspect);
    const mid = openingTourViewAt(BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_ZOOM_SEC / 2, full, [frame]);
    expect(mid.w / mid.h).toBeCloseTo(aspect, 2);
    expect(frame.w).toBeLessThan(layout.width * 0.4);
  });

  it('keeps the adjustable timings in the operator gate', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(8));
    const cycle = BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC + BRACKET_TOUR_ZOOM_SEC;
    expect(BRACKET_TOUR_OVERVIEW_SEC).toBe(2);
    expect(BRACKET_TOUR_ZOOM_SEC).toBe(2.8);
    expect(BRACKET_TOUR_HOLD_SEC).toBe(4);
    expect(openingTourDurationSec(data)).toBe(BRACKET_TOUR_OVERVIEW_SEC + openingTourStops(data).length * cycle);
    expect(openingTourCaptionIndex(0, 3)).toBeNull();
    expect(openingTourCaptionIndex(2, 3)).toBe(0);
    expect(openingTourCaptionIndex(2 + cycle, 3)).toBe(1);
    expect(openingTourCaptionIndex(2 + cycle * 3, 3)).toBeNull();
  });
});
