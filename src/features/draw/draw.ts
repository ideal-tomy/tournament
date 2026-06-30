export type DrawStrategy = 'trio' | 'bye';

function shuffle<T>(a: T[], random: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** participantIds をシャッフルしてチーム(配列)を作る */
export function makeTeams(
  participantIds: string[],
  strategy: DrawStrategy = 'trio',
  random: () => number = Math.random,
): string[][] {
  if (participantIds.length === 0) return [];

  const ids = shuffle([...participantIds], random);
  const teams: string[][] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) teams.push([ids[i], ids[i + 1]]);

  if (ids.length % 2 === 1) {
    const leftover = ids[ids.length - 1];
    if (strategy === 'trio' && teams.length > 0) teams[teams.length - 1].push(leftover);
    else teams.push([leftover]);
  }
  return teams;
}

export function teamCount(participantIds: string[], strategy: DrawStrategy): number {
  return makeTeams(participantIds, strategy, () => 0).length;
}
