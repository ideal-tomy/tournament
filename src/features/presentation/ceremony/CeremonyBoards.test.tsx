import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WinnerBoard from './WinnerBoard';
import ChampionBoard from './ChampionBoard';
import PodiumBoard from './PodiumBoard';
import ThanksBoard from './ThanksBoard';
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
    expect(markup).toContain('left:492px;top:176px;width:420px;height:600px');
    expect(markup).toContain('left:996px;top:176px;width:420px;height:600px');
    expect(markup).toContain('champion-corona.webp');
  });

  it('titles a place board and keeps the rating with the name', () => {
    const markup = renderToStaticMarkup(<WinnerBoard team={{ ...blue, members: ['山田（Rt.12）'] }} title="3RD PLACE" label="3位" />);
    expect(markup).toContain('3RD PLACE');
    expect(markup).not.toContain('WINNER');
    expect(markup).toContain('山田</span><br/><span class="rated-name-line">（Rt.12）');
  });

  it('introduces 3rd, 2nd and 1st on the podium, skipping an absent place', () => {
    const full = renderToStaticMarkup(<PodiumBoard first={blue} second={red} third={{ ...red, name: 'TEAM GREEN' }} />);
    expect(full.indexOf('pd-place-3')).toBeLessThan(full.indexOf('pd-place-2'));
    expect(full.indexOf('pd-place-2')).toBeLessThan(full.indexOf('pd-place-1'));
    expect(full).toContain('TEAM GREEN');
    const two = renderToStaticMarkup(<PodiumBoard first={blue} second={red} />);
    expect(two).not.toContain('pd-place-3');
  });

  it('thanks the participants in two lines', () => {
    const markup = renderToStaticMarkup(<ThanksBoard />);
    expect(markup).toContain('本日は、<br/>ご参加ありがとうございました');
  });
});
