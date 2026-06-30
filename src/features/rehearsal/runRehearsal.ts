import {
  createFreshRehearsal,
  reuseRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from './rehearsalActions';

export type { RehearsalProgress, RehearsalResult };

export interface RunRehearsalOptions {
  /** true: 最新 [REHEARSAL] の参加者を維持してブラケットだけ再生成 */
  reuseExisting?: boolean;
  matchCount?: number;
}

/** @deprecated rehearsalActions を直接利用 */
export async function runRehearsal(
  onProgress: (p: RehearsalProgress) => void,
  matchCount = 0,
  options?: RunRehearsalOptions,
): Promise<RehearsalResult> {
  const count = options?.matchCount ?? matchCount;
  if (options?.reuseExisting) {
    return reuseRehearsal(onProgress, count);
  }
  return createFreshRehearsal(onProgress, count);
}
