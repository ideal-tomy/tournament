import {
  displayMediaPreloader,
  OPTIONAL_VIDEO_URLS,
} from '../../lib/media';

let bootstrapPromise: Promise<boolean> | null = null;
let bootstrapReady = false;

export async function ensurePresentationPreloaded(
  faceUrls: string[] = [],
): Promise<boolean> {
  const urls = [...new Set(faceUrls.filter(Boolean))];
  const pending = urls.filter((url) => !displayMediaPreloader.hasLoaded(url));

  if (pending.length === 0 && bootstrapReady) {
    return true;
  }

  try {
    if (!bootstrapReady) {
      if (!bootstrapPromise) {
        bootstrapPromise = displayMediaPreloader
          .preloadDisplayAssets()
          .then(() => true)
          .catch((e) => {
            console.warn('[presentation] display assets preload partial fail', e);
            return true;
          });
      }
      await bootstrapPromise;
      bootstrapReady = true;
    }

    if (pending.length > 0) {
      await displayMediaPreloader.preloadAll(pending);
    }

    return displayMediaPreloader.isReady(
      pending.length > 0 ? pending : OPTIONAL_VIDEO_URLS,
    );
  } catch (e) {
    console.warn('[presentation] preload failed', e);
    return false;
  }
}

export function isPresentationPreloaded(): boolean {
  return bootstrapReady;
}

/** Vitest / 開発用リセット */
export function resetPresentationPreload(): void {
  bootstrapReady = false;
  bootstrapPromise = null;
}
