import { describe, expect, it } from 'vitest';
import { makeBalancedTeams, teamRatingSum } from './draw';

function rated(entries: [string, number][]) {
  return entries.map(([id, rating]) => ({ id, rating }));
}

describe('makeBalancedTeams', () => {
  it('偶数6名: 高低ペアで合計が均等', () => {
    const teams = makeBalancedTeams(
      rated([
        ['a', 10],
        ['b', 9],
        ['c', 8],
        ['d', 7],
        ['e', 6],
        ['f', 5],
      ]),
    );
    expect(teams).toHaveLength(3);
    expect(teams.every((t) => t.length === 2)).toBe(true);
    const ratingById = new Map([
      ['a', 10],
      ['b', 9],
      ['c', 8],
      ['d', 7],
      ['e', 6],
      ['f', 5],
    ]);
    const sums = teams.map((t) => teamRatingSum(t, ratingById));
    expect(sums).toEqual([15, 15, 15]);
  });

  it('奇数 + trio: 3名チーム1つ', () => {
    const teams = makeBalancedTeams(
      rated([
        ['a', 10],
        ['b', 9],
        ['c', 8],
        ['d', 7],
        ['e', 6],
        ['f', 5],
        ['g', 4],
      ]),
      'trio',
    );
    expect(teams).toHaveLength(3);
    expect(teams.some((t) => t.length === 3)).toBe(true);
    expect(teams.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('奇数 + bye: 最低レート1名が単独チーム', () => {
    const teams = makeBalancedTeams(
      rated([
        ['a', 10],
        ['b', 8],
        ['c', 6],
      ]),
      'bye',
    );
    expect(teams).toHaveLength(2);
    expect(teams.some((t) => t.length === 1 && t[0] === 'c')).toBe(true);
  });

  it('空配列', () => {
    expect(makeBalancedTeams([])).toEqual([]);
  });
});
