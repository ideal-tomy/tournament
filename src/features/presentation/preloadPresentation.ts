import { preloadImages, preloadVideosOptional } from '../../lib/media';

let preloadPromise: Promise<boolean> | null = null;
let isReady = false;

/** 任意 WebM（存在しなくても procedural 演出で継続） */
const OPTIONAL_VIDEO_URLS: string[] = [
  // 将来: import.meta.url ベースの public アセット
];

export async function ensurePresentationPreloaded(
  faceUrls: string[] = [],
): Promise<boolean> {
  if (isReady) return true;
  if (!preloadPromise) {
    preloadPromise = (async () => {
      try {
        const urls = [...new Set(faceUrls.filter(Boolean))];
        if (urls.length > 0) {
          await preloadImages(urls).catch((e) => {
            console.warn('[presentation] face preload partial fail', e);
          });
        }
        await preloadVideosOptional(OPTIONAL_VIDEO_URLS);
        isReady = true;
        return true;
      } catch (e) {
        console.warn('[presentation] preload failed', e);
        isReady = true;
        return true;
      }
    })();
  }
  return preloadPromise;
}

export function isPresentationPreloaded(): boolean {
  return isReady;
}

/** Vitest / 開発用リセット */
export function resetPresentationPreload(): void {
  isReady = false;
  preloadPromise = null;
}
