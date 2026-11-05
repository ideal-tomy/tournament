import { describe, expect, it } from 'vitest';
import { venueOpeningMedia } from './venueOpeningMedia';

describe('venueOpeningMedia', () => {
  it('shows the title image until a store asks for its own picture or silent video', () => {
    expect(venueOpeningMedia.kind).toBe('image');
    if (venueOpeningMedia.kind !== 'image') return;
    expect(decodeURIComponent(venueOpeningMedia.src)).toBe('/tournament-effects/opening/T-RIP 20周年記念ダーツトーナメント.png');
    expect(venueOpeningMedia.alt).toContain('T-RIP');
  });
});