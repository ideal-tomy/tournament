export type DrawCardSide = 'back' | 'front';

export type DrawVisualPhase =
  | 'cardReady'
  | 'dartFlying'
  | 'impact'
  | 'flipping'
  | 'playerRevealed'
  | 'pairConfirmed';

/** 穴・亀裂などの裏面専用素材は、裏面への着弾中だけ表示できる。 */
export function shouldShowBackOnlyEffect(
  cardSide: DrawCardSide,
  phase: DrawVisualPhase,
): boolean {
  return cardSide === 'back' && phase === 'impact';
}

/** 確定済みの公開順を崩さず、チーム人数単位に分割する。 */
export function groupDrawParticipants<T>(items: T[], teamSize: number): T[][] {
  const safeSize = Math.max(1, Math.floor(teamSize) || 1);
  const teams: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) {
    teams.push(items.slice(index, index + safeSize));
  }
  return teams;
}
