/** ローカル instant 進行ハーネス（ALLOW_INSTANT_TIMING のみ）。公開 Worker では使用しない。 */
export const PROGRESSION_HARNESS = {
  teams: 40,
  courts: 2 as 2 | 3,
  format: 'double_elimination' as const,
  title: '40チーム・ダブルイリミ進行確認',
  /** 部分自動の既定：40チーム時はウィナーズ1回戦（20試合）まで */
  partialMatchGoal: 20,
};