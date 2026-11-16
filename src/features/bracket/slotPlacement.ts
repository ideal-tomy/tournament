/** 次の2の累乗の枠数 */
export function bracketSize(teamCount: number): number {
  return 1 << Math.ceil(Math.log2(Math.max(2, teamCount)));
}

/** 固定するチーム数に応じた山の数（本線で合流するまで当たらない単位） */
export function mountainCount(fixedCount: number): number {
  if (fixedCount <= 2) return 2;
  if (fixedCount <= 4) return 4;
  return 8;
}

function mountainSpans(size: number, mountains: number): number[][] {
  const span = size / mountains;
  return Array.from({ length: mountains }, (_, index) => {
    const start = index * span;
    return Array.from({ length: span }, (_, offset) => start + offset);
  });
}

/**
 * 固定チームを別の山へ置き、残りを randomOrder の順で空枠へ埋める。
 * 固定チームには不戦勝を自動では付けない（空き枠の端に寄せない）。
 */
export function placeTeamsInSlots(
  teamIds: string[],
  fixed: Array<{ teamId: string; mountain: number }>,
  randomOrder: string[],
): (string | null)[] {
  const size = bracketSize(teamIds.length);
  const slots: (string | null)[] = Array.from({ length: size }, () => null);
  const known = new Set(teamIds);
  const mountains = mountainCount(fixed.length || 2);
  const spans = mountainSpans(size, mountains);
  const used = new Set<string>();

  for (const item of fixed) {
    if (!known.has(item.teamId) || used.has(item.teamId)) continue;
    const mountain = Math.max(0, Math.min(mountains - 1, item.mountain));
    const open = spans[mountain].find((index) => slots[index] == null);
    if (open == null) continue;
    slots[open] = item.teamId;
    used.add(item.teamId);
  }

  const rest = randomOrder.filter((id) => known.has(id) && !used.has(id));
  const leftovers = teamIds.filter((id) => !used.has(id) && !rest.includes(id));
  const queue = [...rest, ...leftovers];
  for (let index = 0; index < slots.length && queue.length; index += 1) {
    if (slots[index] != null) continue;
    slots[index] = queue.shift() ?? null;
  }
  return slots;
}

/** サーバーが残り枠を埋めるときの乱順（演出コンポーネントでは呼ばない） */
export function shuffleTeamIds(teamIds: string[], random = Math.random): string[] {
  const copy = [...teamIds];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
