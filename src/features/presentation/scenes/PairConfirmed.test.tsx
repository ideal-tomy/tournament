import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PairConfirmed from './PairConfirmed';

describe('PairConfirmed', () => {
  it('shows both confirmed players and no back-only impact assets', () => {
    const markup = renderToStaticMarkup(
      <PairConfirmed
        teamNumber={1}
        members={[
          { id: 'a', displayName: 'RYOJI', faceUrl: '/faces/a.jpg' },
          { id: 'b', displayName: 'TAKUMA', faceUrl: '/faces/b.jpg' },
        ]}
      />,
    );

    expect(markup).toContain('TEAM 01');
    expect(markup).toContain('PAIR CONFIRMED');
    expect(markup).toContain('RYOJI');
    expect(markup).toContain('TAKUMA');
    expect(markup).not.toContain('impact-mark');
    expect(markup).not.toContain('draw-dart');
  });

  it('uses TEAM CONFIRMED for a trio', () => {
    const markup = renderToStaticMarkup(
      <PairConfirmed
        teamNumber={2}
        members={[
          { id: 'a', displayName: 'A', faceUrl: null },
          { id: 'b', displayName: 'B', faceUrl: null },
          { id: 'c', displayName: 'C', faceUrl: null },
        ]}
      />,
    );

    expect(markup).toContain('TEAM 02');
    expect(markup).toContain('TEAM CONFIRMED');
  });
});
