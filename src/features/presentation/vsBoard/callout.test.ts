import { describe, expect, it } from 'vitest';
import { calloutForRound } from './callout';

describe('calloutForRound', () => {
  it('グランドファイナルの第1戦だけをファイナルにする', () => {
    expect(calloutForRound({ single: false, kind: 'grand_final', round: 1, maxRoundOfKind: 2 })).toBe('final');
    expect(calloutForRound({ single: false, kind: 'grand_final', round: 2, maxRoundOfKind: 2 })).toBe('final-again');
  });

  it('ウィナーズにはセミファイナルを出さない', () => {
    expect(calloutForRound({ single: false, kind: 'winner', round: 3, maxRoundOfKind: 5 })).toBeNull();
    expect(calloutForRound({ single: false, kind: 'winner', round: 4, maxRoundOfKind: 5 })).toBeNull();
    expect(calloutForRound({ single: false, kind: 'winner', round: 5, maxRoundOfKind: 5 })).toBeNull();
  });

  it('ルーザーズ最終回戦だけをセミファイナルにする', () => {
    expect(calloutForRound({ single: false, kind: 'loser', round: 8, maxRoundOfKind: 8 })).toBe('losers-semifinal');
    expect(calloutForRound({ single: false, kind: 'loser', round: 7, maxRoundOfKind: 8 })).toBeNull();
    expect(calloutForRound({ single: false, kind: 'loser', round: 5, maxRoundOfKind: 6 })).toBeNull();
    expect(calloutForRound({ single: false, kind: 'loser', round: 6, maxRoundOfKind: 6 })).toBe('losers-semifinal');
  });

  it('シングルは最後とそのひとつ前だけ', () => {
    expect(calloutForRound({ single: true, kind: 'winner', round: 3, maxRoundOfKind: 3, singleFinalRound: 3 })).toBe('final');
    expect(calloutForRound({ single: true, kind: 'winner', round: 2, maxRoundOfKind: 3, singleFinalRound: 3 })).toBe('semifinal');
    expect(calloutForRound({ single: true, kind: 'winner', round: 1, maxRoundOfKind: 3, singleFinalRound: 3 })).toBeNull();
  });
});
