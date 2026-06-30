export type DrawStrategy = 'trio' | 'bye';

export interface RatedParticipant {
  id: string;
  rating: number;
}

/** チーム合計レーティング */
export function teamRatingSum(
  memberIds: string[],
  ratingById: Map<string, number>,
): number {
  return memberIds.reduce((sum, id) => sum + (ratingById.get(id) ?? 0), 0);
}

/** チーム平均レーティング */
export function teamRatingAvg(
  memberIds: string[],
  ratingById: Map<string, number>,
): number {
  if (memberIds.length === 0) return 0;
  return teamRatingSum(memberIds, ratingById) / memberIds.length;
}

/**
 * ダブルス（2名1チーム）前提のレーティング均等編成。
 * レーティング降順ソート後、最上位×最下位 … の高低ペアでチーム合計の偏りを抑える。
 */
export function makeBalancedTeams(
  participants: RatedParticipant[],
  strategy: DrawStrategy = 'trio',
): string[][] {
  if (participants.length === 0) return [];

  const ratingById = new Map(participants.map((p) => [p.id, p.rating]));
  const sorted = [...participants].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.id.localeCompare(b.id);
  });

  let pool = sorted;
  let byePlayer: RatedParticipant | null = null;

  if (sorted.length % 2 === 1 && strategy === 'bye') {
    byePlayer = sorted[sorted.length - 1];
    pool = sorted.slice(0, -1);
  }

  const teams: string[][] = [];
  let left = 0;
  let right = pool.length - 1;

  while (left < right) {
    teams.push([pool[left].id, pool[right].id]);
    left++;
    right--;
  }

  if (sorted.length % 2 === 1 && strategy === 'trio' && left === right) {
    const lone = pool[left];
    if (teams.length === 0) {
      teams.push([lone.id]);
    } else {
      let minIdx = 0;
      let minSum = Infinity;
      for (let i = 0; i < teams.length; i++) {
        const sum = teamRatingSum(teams[i], ratingById);
        if (sum < minSum) {
          minSum = sum;
          minIdx = i;
        }
      }
      teams[minIdx].push(lone.id);
    }
  }

  if (byePlayer) {
    teams.push([byePlayer.id]);
  }

  return teams;
}

/** @deprecated ランダム抽選。makeBalancedTeams を使用 */
export function makeTeams(
  participantIds: string[],
  strategy: DrawStrategy = 'trio',
): string[][] {
  const participants = participantIds.map((id) => ({ id, rating: 0 }));
  return makeBalancedTeams(participants, strategy);
}

export function teamCount(participants: RatedParticipant[], strategy: DrawStrategy): number {
  return makeBalancedTeams(participants, strategy).length;
}
