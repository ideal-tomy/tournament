import { describe, expect, it } from 'vitest';
import { calloutForRound } from './callout';

describe('calloutForRound', () => {
  it('グランドファイナルの第1戦だけをファイナルにする', () => {
    expect(calloutForRound({ single: false, kind: 'grand_final', round: 1, maxRoundOfKind: 2 })).toBe('final');
    expect(calloutForRound({ single: false, kind: 'grand_final', round: 2, maxRoundOfKind: 2 })).toBe('final-again');
  });

  it('ウィナーズとルーザーズの決勝には見出しを出さない', () => {
    expect(calloutForRound({ single: false, kind: 'winner', round: 4, maxRoundOfKind: 4 })).toBeNull();
    expect(calloutForRound({ single: false, kind: 'loser', round: 6, maxRoundOfKind: 6 })).toBeNull();
  });

  it('準決勝の位置だけをセミファイナルにする', () => {
    expect(calloutForRound({ single: false, kind: 'winner', round: 3, maxRoundOfKind: 4 })).toBe('semifinal');
    expect(calloutForRound({ single: false, kind: 'loser', round: 5, maxRoundOfKind: 6 })).toBe('losers-semifinal');
    expect(calloutForRound({ single: false, kind: 'winner', round: 2, maxRoundOfKind: 4 })).toBeNull();
  });

  it('シングルは最後とそのひとつ前だけ', () => {
    expect(calloutForRound({ single: true, kind: 'winner', round: 3, maxRoundOfKind: 3, singleFinalRound: 3 })).toBe('final');
    expect(calloutForRound({ single: true, kind: 'winner', round: 2, maxRoundOfKind: 3, singleFinalRound: 3 })).toBe('semifinal');
    expect(calloutForRound({ single: true, kind: 'winner', round: 1, maxRoundOfKind: 3, singleFinalRound: 3 })).toBeNull();
  });
});
