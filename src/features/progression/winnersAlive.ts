import { Status } from 'brackets-model';
import type { StageData } from '../bracket/layout';
import { getMatchBracketKind } from './tiers';

/** ウィナーズでまだ負けていないチーム（本線に残っている） */
export function getActiveWinnersTeamIds(data: StageData): string[] {
  const lost = new Set<string>();
  for (const match of data.match) {
    if (getMatchBracketKind(data, match) !== 'winner') continue;
    if (match.status < Status.Completed) continue;
    for (const slot of [match.opponent1, match.opponent2]) {
      if (slot?.result !== 'loss' || slot.id == null) continue;
      const person = data.participant.find((row) => row.id === slot.id);
      if (person?.name) lost.add(String(person.name));
    }
  }
  return data.participant.map((p) => String(p.name)).filter((id) => id && !lost.has(id));
}
