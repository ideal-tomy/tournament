import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VsBoard from './VsBoard';

describe('VsBoard', () => {
  it('places both teams and four players on the venue card', () => {
    const markup = renderToStaticMarkup(<VsBoard
      roundLabel="FINAL"
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
  });
});
