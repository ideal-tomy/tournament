export type VsCallout = 'semifinal' | 'losers-semifinal' | 'final' | 'final-again';

/**
 * ファイナルは優勝が決まる試合だけ。
 * アゲインは、ルーザーズから上がったチームが勝って組まれるリセット戦だけ。
 * ダブルイリミネーションのセミファイナルは、ルーザーズ最終回戦だけ。
 * シングルは、その山の決勝のひとつ前。
 */
export function calloutForRound(input: {
  single: boolean;
  kind: string;
  round: number;
  maxRoundOfKind: number;
  singleFinalRound?: number;
}): VsCallout | null {
  const { single, kind, round, maxRoundOfKind } = input;
  if (kind === 'grand_final') return round === 1 ? 'final' : round > 1 ? 'final-again' : null;
  if (single) {
    const finalRound = input.singleFinalRound ?? maxRoundOfKind;
    if (round === finalRound) return 'final';
    if (finalRound > 1 && round === finalRound - 1) return 'semifinal';
    return null;
  }
  if (kind === 'loser' && maxRoundOfKind >= 1 && round === maxRoundOfKind) return 'losers-semifinal';
  return null;
}
