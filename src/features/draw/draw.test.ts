import { describe, expect, it, vi } from 'vitest';
import { makeTeams } from './draw';

describe('makeTeams', () => {
  it('偶数人数: 2名ずつペア', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const teams = makeTeams(['a', 'b', 'c', 'd'], 'trio');
    expect(teams).toHaveLength(2);
    expect(teams.every((t) => t.length === 2)).toBe(true);
    expect(teams.flat().sort()).toEqual(['a', 'b', 'c', 'd']);
    vi.restoreAllMocks();
  });

  it('奇数 + trio: 末尾チームが3名', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const teams = makeTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'trio');
    expect(teams).toHaveLength(3);
    expect(teams[2]).toHaveLength(3);
    expect(teams.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    vi.restoreAllMocks();
  });

  it('奇数 + bye: 1名チームができる', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const teams = makeTeams(['a', 'b', 'c'], 'bye');
    expect(teams).toHaveLength(2);
    expect(teams.some((t) => t.length === 1)).toBe(true);
    expect(teams.flat().sort()).toEqual(['a', 'b', 'c']);
    vi.restoreAllMocks();
  });

  it('空配列', () => {
    expect(makeTeams([])).toEqual([]);
  });
});
