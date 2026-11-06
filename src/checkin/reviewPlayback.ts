import type { DrawState } from './DrawControl';

export const REVIEW_SCENES = ['draw', 'vs', 'winner', 'champion'] as const;
export type ReviewScene = (typeof REVIEW_SCENES)[number];

export function currentReview(): ReviewScene | null {
  const value = new URLSearchParams(location.search).get('review');
  return REVIEW_SCENES.includes(value as ReviewScene) ? value as ReviewScene : null;
}

export function reviewUrl(scene: ReviewScene) {
  const url = new URL(location.href);
  url.pathname = '/display';
  url.searchParams.set('review', scene);
  return url.pathname + url.search;
}

/** Read-only view of the saved roster. The live scene and results stay unchanged. */
export function reviewState(state: DrawState, scene: Exclude<ReviewScene, 'draw'>): DrawState {
  if (!state.flow) return { ...state, scene: 'award', elapsedSeconds: 0 };
  const match = reviewMatch(state);
  const champion = state.flow?.championTeamId ?? match?.teamA ?? null;
  const opponent = match && match.teamA === champion ? match.teamB : match && match.teamB === champion ? match.teamA : match?.teamB ?? null;
  const flow = { ...state.flow!, currentMatch: match, winnerTeamId: scene === 'winner' ? champion : state.flow?.winnerTeamId ?? null, loserTeamId: scene === 'winner' ? opponent : state.flow?.loserTeamId ?? null, championTeamId: champion, ceremony: scene === 'champion' ? 'champion' as const : null, canStart: false, phase: scene };
  return { ...state, scene: scene === 'vs' ? 'vs_card' : scene === 'winner' ? 'result' : 'award', elapsedSeconds: 0, sceneSeq: state.sceneSeq + (scene === 'vs' ? 1 : scene === 'winner' ? 2 : 3), flow };
}

function reviewMatch(state: DrawState): NonNullable<DrawState['flow']>['currentMatch'] {
  const participants = state.bracket?.participant ?? [];
  const teamOf = (id: number | string | null | undefined) => participants.find(person => person.id === id)?.name ?? null;
  const matches = [...(state.bracket?.match ?? [])].reverse();
  const final = matches.find(match => teamOf(match.opponent1?.id) && teamOf(match.opponent2?.id));
  if (final) {
    return { id: Number(final.id), teamA: teamOf(final.opponent1?.id)!, teamB: teamOf(final.opponent2?.id)!, round: Number(final.round_id), roundName: 'FINAL', kind: 'grand_final', final: true };
  }
  const [teamA, teamB] = state.teams;
  return teamA && teamB ? { id: 0, teamA: teamA.id, teamB: teamB.id, round: 1, roundName: 'REVIEW', kind: 'review', final: true } : null;
}
