import { describe, expect, it } from 'vitest';
import { buildDoubleElimination, buildSnapshotForTeamCount, toStageData } from '../bracket/manager';
import { computeBracketLayout } from '../bracket/layout';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';
import {
  BRACKET_TOUR_APPROACH_SEC,
  BRACKET_TOUR_CARD_SEC,
  BRACKET_TOUR_OVERVIEW_SEC,
  BRACKET_TOUR_RETURN_SEC,
  SCREEN_ASPECT,
  openingCardFrames,
  openingOverviewFrame,
  openingTourCaption,
  openingTourCaptionIndex,
  openingTourDurationSec,
  openingTourPhase,
  openingTourStops,
  openingTourViewAt,
} from './openingTourTiming';

describe('opening bracket camera', () => {
  it('visits every first-round card once, including bye placements, from left to right', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const stops = openingTourStops(data);
    const teams = stops.flatMap((stop) => stop.teamIds);
    expect(stops.every((stop) => stop.matchIds.length === 1)).toBe(true);
    expect(new Set(teams).size).toBe(teams.length);
    expect(teams).toHaveLength(20);

    const layout = computeBracketLayout(data, undefined, 'winners');
    const centers = stops.map((stop) => layout.byId[stop.matchIds[0]].box.x);
    expect(centers).toEqual([...centers].sort((a, b) => a - b));
    const frames = openingCardFrames(data);
    expect(frames.map((frame) => frame.x)).toEqual([...frames.map((frame) => frame.x)].sort((a, b) => a - b));
    expect(new Set(frames.map((frame) => frame.w)).size).toBe(1);
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

  it('fills a 16:9 frame and approaches the first card slowly, then faster', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(20));
    const layout = computeBracketLayout(data, undefined, 'winners');
    const full = openingOverviewFrame(data);
    const cards = openingCardFrames(data);
    const first = cards[0];
    expect(full.w / full.h).toBeCloseTo(SCREEN_ASPECT, 2);
    expect(first.w / first.h).toBeCloseTo(SCREEN_ASPECT, 2);
    const winnerBoxes = layout.matches.filter((match) => match.bracket === 'winner').map((match) => match.box);
    for (const box of winnerBoxes) {
      expect(full.x).toBeLessThanOrEqual(box.x + 1);
      expect(full.x + full.w).toBeGreaterThanOrEqual(box.x + box.w - 1);
    }
    expect(first.w).toBeLessThan(full.w * 0.35);

    const halfway = BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC / 2;
    const mid = openingTourViewAt(halfway, full, cards);
    const arrived = openingTourViewAt(BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC, full, cards);
    const fullCenter = full.x + full.w / 2;
    const cardCenter = first.x + first.w / 2;
    expect(Math.abs(mid.x + mid.w / 2 - fullCenter)).toBeLessThan(Math.abs(mid.x + mid.w / 2 - cardCenter));
    expect(arrived.w).toBeCloseTo(first.w, 1);
    expect(mid.w / mid.h).toBeCloseTo(SCREEN_ASPECT, 2);
    expect(openingTourPhase(halfway, cards.length)).toBe('in');
  });

  it('pans across the first round and returns to the whole bracket', async () => {
    const data = toStageData(await buildSnapshotForTeamCount(8));
    const cards = openingCardFrames(data);
    const full = openingOverviewFrame(data);
    const pan = (cards.length - 1) * BRACKET_TOUR_CARD_SEC;
    expect(BRACKET_TOUR_OVERVIEW_SEC).toBe(2);
    expect(BRACKET_TOUR_APPROACH_SEC).toBe(2);
    expect(openingTourDurationSec(data)).toBe(
      BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC + pan + BRACKET_TOUR_RETURN_SEC,
    );
    const panStart = BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC;
    const crossing = openingTourViewAt(panStart + pan / 2, full, cards);
    expect(crossing.x).toBeGreaterThan(cards[0].x);
    expect(crossing.x).toBeLessThan(cards[cards.length - 1].x);
    expect(openingTourPhase(panStart + pan / 2, cards.length)).toBe('pan');
    const back = openingTourViewAt(panStart + pan + BRACKET_TOUR_RETURN_SEC, full, cards);
    expect(back.w).toBeCloseTo(full.w, 1);
    expect(openingTourCaptionIndex(0, cards.length)).toBeNull();
    expect(openingTourCaptionIndex(panStart, cards.length)).toBe(0);
    expect(openingTourCaptionIndex(panStart + pan + 0.1, cards.length)).toBeNull();
  });
});
