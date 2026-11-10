import { describe, expect, it } from 'vitest';
import { pairCardsMeetOffset } from './appendPresentationBackdrop';
import { cueCatchUpOffset, syncedCueAt } from './playPresentationAudio';

describe('effect cue sync', () => {
  it('lands the pair impact when the two cards first meet', () => {
    expect(pairCardsMeetOffset(2)).toBeCloseTo(0.44);
    expect(syncedCueAt(10 + pairCardsMeetOffset(2), 'pairImpact')).toBeCloseTo(9.74);
  });

  it('puts the card-open peak on the revealed face and the dart attack on the stick', () => {
    expect(syncedCueAt(8.7, 'cardOpen')).toBeCloseTo(8.28);
    expect(syncedCueAt(3, 'impact')).toBeCloseTo(2.96);
    expect(syncedCueAt(1.2, 'dartFly')).toBe(1.2);
  });

  it('keeps a late display inside the wind-up and stays silent after the hit', () => {
    expect(cueCatchUpOffset(1.2, 0.2, 'pairImpact')).toBeNull();
    expect(cueCatchUpOffset(1.2, 0.8, 'pairImpact')).toBeCloseTo(0.3);
    expect(cueCatchUpOffset(1.05, 0.6, 'pairImpact')).toBeCloseTo(0.25);
    expect(cueCatchUpOffset(1.05, 1.4, 'pairImpact')).toBeNull();
  });
});
