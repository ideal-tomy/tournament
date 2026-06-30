import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MediaPreloader } from './media';

describe('MediaPreloader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isReady returns true when all urls loaded', async () => {
    const preloader = new MediaPreloader();
    const loadSpy = vi.spyOn(preloader as unknown as { loadUrl: (u: string) => Promise<void> }, 'loadUrl')
      .mockResolvedValue(undefined);

    await preloader.preloadAll(['a.png', 'b.png']);
    expect(preloader.isReady(['a.png', 'b.png'])).toBe(true);
    expect(loadSpy).toHaveBeenCalledTimes(2);

    await preloader.preloadAll(['a.png']);
    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  it('hasLoaded tracks individual urls', async () => {
    const preloader = new MediaPreloader();
    vi.spyOn(preloader as unknown as { loadUrl: (u: string) => Promise<void> }, 'loadUrl')
      .mockResolvedValue(undefined);

    expect(preloader.hasLoaded('/x.jpg')).toBe(false);
    await preloader.preloadAll(['/x.jpg']);
    expect(preloader.hasLoaded('/x.jpg')).toBe(true);
  });
});
