import { Status } from 'brackets-model';
import type { BMMatch, BMOpponent, StageData } from './layout';

export type LoserSlotStatus = 'done' | 'live' | 'ready' | 'wait';

export interface LoserSlotView {
  teamId: string | null;
  /** 人が未定のとき、その枠が誰を待っているか */
  source: string;
}

export interface LoserMatchView {
  id: number;
  round: number;
  number: number;
  status: LoserSlotStatus;
  /** この試合の勝者が入る、次の回戦の試合 */
  nextId: number | null;
  slots: [LoserSlotView, LoserSlotView];
}

export interface LoserColumn {
  round: number;
  matches: LoserMatchView[];
}

interface Meta {
  match: BMMatch;
  bracket: 'winner' | 'loser';
  round: number;
  row: number;
}

function metasOf(data: StageData): Meta[] {
  const groupNumber = new Map(data.group.map((group) => [group.id, group.number]));
  const roundInfo = new Map(
    data.round.map((round) => [round.id, { group: groupNumber.get(round.group_id) ?? 1, round: round.number }]),
  );
  const buckets = new Map<string, BMMatch[]>();
  for (const match of data.match) {
    const info = roundInfo.get(match.round_id);
    if (!info || (info.group !== 1 && info.group !== 2)) continue;
    const key = `${info.group}:${info.round}`;
    const list = buckets.get(key) ?? [];
    list.push(match);
    buckets.set(key, list);
  }
  const metas: Meta[] = [];
  for (const [key, matches] of buckets) {
    const [group, roundText] = key.split(':');
    matches.sort((a, b) => a.number - b.number);
    matches.forEach((match, row) => {
      metas.push({
        match,
        bracket: group === '1' ? 'winner' : 'loser',
        round: Number(roundText),
        row,
      });
    });
  }
  return metas;
}

function lbAdvanceRow(fromRound: number, fromRow: number): number {
  return fromRound % 2 === 1 ? fromRow : Math.floor(fromRow / 2);
}

function findWb(metas: Meta[], loser: Meta, position: number): Meta | null {
  if (loser.round === 1) {
    const row = Math.floor((position - 1) / 2);
    return metas.find((meta) => meta.bracket === 'winner' && meta.round === 1 && meta.row === row) ?? null;
  }
  const round = loser.round % 2 === 0 ? loser.round : loser.round - 1;
  return metas.find((meta) => meta.bracket === 'winner' && meta.round === round && meta.match.number === position) ?? null;
}

function feeders(metas: Meta[], loser: Meta): Meta[] {
  return metas.filter(
    (meta) => meta.bracket === 'loser' && meta.round + 1 === loser.round && lbAdvanceRow(meta.round, meta.row) === loser.row,
  );
}

function sourceOf(metas: Meta[], loser: Meta, slot: 0 | 1, opponent: BMOpponent | null): string {
  if (opponent?.position != null) {
    const from = findWb(metas, loser, opponent.position);
    return from ? `ウィナーズ ${from.round}回戦の敗者` : 'ウィナーズの敗者';
  }
  const from = feeders(metas, loser).sort((a, b) => a.match.number - b.match.number);
  const pick = from.length === 1 ? from[0] : from[slot];
  return pick ? `ルーザーズ ${pick.round}回戦の勝者` : 'ひとつ前の勝者';
}

function nextIdOf(metas: Meta[], meta: Meta): number | null {
  const row = lbAdvanceRow(meta.round, meta.row);
  const next = metas.find((item) => item.bracket === 'loser' && item.round === meta.round + 1 && item.row === row);
  return next?.match.id ?? null;
}

function statusOf(match: BMMatch): LoserSlotStatus {
  if (match.status >= Status.Completed) return 'done';
  if (match.status === Status.Running) return 'live';
  if (match.status === Status.Ready) return 'ready';
  return 'wait';
}

function teamId(data: StageData, opponent: BMOpponent | null): string | null {
  if (opponent?.id == null) return null;
  return data.participant.find((person) => person.id === opponent.id)?.name ?? null;
}

/** ルーザーズの試合を、回戦の列にする。進行の計算はしない。 */
export function losersColumns(data: StageData): LoserColumn[] {
  const metas = metasOf(data);
  const losers = metas.filter((meta) => meta.bracket === 'loser');
  const rounds = [...new Set(losers.map((meta) => meta.round))].sort((a, b) => a - b);
  return rounds.map((round) => ({
    round,
    matches: losers
      .filter((meta) => meta.round === round)
      .sort((a, b) => a.row - b.row)
      .map((meta) => ({
        id: meta.match.id,
        round,
        number: meta.match.number,
        status: statusOf(meta.match),
        nextId: nextIdOf(metas, meta),
        slots: [0, 1].map((slot) => {
          const opponent = slot === 0 ? meta.match.opponent1 : meta.match.opponent2;
          return {
            teamId: teamId(data, opponent),
            source: sourceOf(metas, meta, slot as 0 | 1, opponent),
          };
        }) as [LoserSlotView, LoserSlotView],
      })),
  }));
}
