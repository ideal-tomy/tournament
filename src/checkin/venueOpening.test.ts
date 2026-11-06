import { describe, expect, it } from 'vitest';
import { venueOpeningMedia } from './venueOpeningMedia';
import { openingMedia } from './VenueOpening';

describe('venueOpeningMedia', () => {
  it('shows the title image until a store asks for its own picture or silent video', () => {
    expect(venueOpeningMedia.kind).toBe('image');
    if (venueOpeningMedia.kind !== 'image') return;
    expect(decodeURIComponent(venueOpeningMedia.src)).toBe('/tournament-effects/opening/T-RIP 20周年記念ダーツトーナメント.png');
    expect(venueOpeningMedia.alt).toContain('T-RIP');
  });
  it('uses the event image only for the event that posted one', () => {
    expect(openingMedia('cf-through-a', null)).toBe(venueOpeningMedia);
    const own = openingMedia('cf-through-a', '2026-11-07T01:00:00.000Z', '渋谷会場');
    expect(own).toEqual({ kind: 'image', src: '/api/events/cf-through-a/opening?run=cf-through-a&v=2026-11-07T01%3A00%3A00.000Z', alt: '渋谷会場' });
  });
});