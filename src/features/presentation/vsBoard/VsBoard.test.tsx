import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VsBoard from './VsBoard';

describe('VsBoard', () => {
  it('places both teams and four players on the venue card', () => {
    const markup = renderToStaticMarkup(<VsBoard
      roundLabel="FINAL"
      callout="final-again"
      left={{ name: 'TEAM BLUE', members: ['NAME 01', 'NAME 02'], faces: ['/a.jpg', '/b.jpg'] }}
      right={{ name: 'TEAM RED', members: ['NAME 03', 'NAME 04'], faces: ['/c.jpg', '/d.jpg'] }}
    />);
    expect(markup).toContain('TEAM BLUE');
    expect(markup).toContain('TEAM RED');
    expect(markup).toContain('NAME 01');
    expect(markup).toContain('NAME 04');
    expect(markup).toContain('left:120');
    expect(markup).toContain('left:1500');
    expect(markup).toContain('alt="VS"');
    expect(markup).toContain('ファイナル');
    expect(markup).toContain('アゲイン');
    expect(markup).toContain('vsb-callout-again');
    expect(markup).not.toContain('バトル');
  });

  it('labels losers semifinal as セミファイナル with a ルーザーズ cue', () => {
    const markup = renderToStaticMarkup(<VsBoard
      callout="losers-semifinal"
      left={{ name: 'A', members: ['1'], faces: [] }}
      right={{ name: 'B', members: ['2'], faces: [] }}
    />);
    expect(markup).toContain('セミファイナル');
    expect(markup).toContain('ルーザーズ');
    expect(markup).not.toContain('準決勝');
  });
});
