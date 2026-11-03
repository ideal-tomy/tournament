import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WinnerBoard from './WinnerBoard';
import ChampionBoard from './ChampionBoard';
import { cardSlots } from './CeremonyFrame';

const blue = { name: 'TEAM BLUE', members: ['NAME 01', 'NAME 02'], faces: ['/a.jpg', '/b.jpg'] };
const red = { name: 'TEAM RED', members: ['NAME 03', 'NAME 04'], faces: ['/c.jpg', '/d.jpg'] };

describe('ceremony boards', () => {
  it('centers card slots around the given x', () => {
    expect(cardSlots(2, 300, 36)).toEqual([642, 978]);
    expect(cardSlots(1, 320, 84, 962)).toEqual([802]);
  });

  it('shows the winners without turning into the next VS', () => {
    const markup = renderToStaticMarkup(<WinnerBoard team={blue} opponent={red} />);
    expect(markup).toContain('WINNER');
    expect(markup).toContain('NAME 01');
    expect(markup).toContain('vs TEAM RED');
    expect(markup).not.toContain('NAME 03');
    expect(markup).toContain('winner-shaft.webp');
  });

  it('stands the champions on the two podiums', () => {
    const markup = renderToStaticMarkup(<ChampionBoard team={blue} />);
    expect(markup).toContain('CHAMPION');
    expect(markup).toContain('left:552px');
    expect(markup).toContain('left:1056px');
    expect(markup).toContain('champion-corona.webp');
  });
});
