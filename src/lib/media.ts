/** 演出素材・顔写真のプリロード */

import placeholderFace from '../assets/placeholder_face.svg';

export const DISPLAY_STATIC_ASSET_URLS = [placeholderFace];

/** public/ 配置の任意 WebM（無くても CSS フォールバック） */
export const OPTIONAL_VIDEO_URLS = ['/assets/bg_main.webm', '/assets/explosion_alpha.webm'];

export async function preloadImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;

  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
          img.src = url;
        }),
    ),
  );
}

export async function preloadVideo(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`Failed to preload video: ${url}`));
    video.src = url;
    video.load();
  });
}

/** 存在しない URL は無視（procedural フォールバック用） */
export async function preloadVideosOptional(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map((url) =>
      preloadVideo(url).catch(() => {
        console.info('[media] optional video not found:', url);
      }),
    ),
  );
}

function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4)(\?|$)/i.test(url);
}

export class MediaPreloader {
  private loadedUrls = new Set<string>();
  private inFlight = new Map<string, Promise<void>>();

  /** 指定 URL がすべてロード済みか（urls 省略時は 1 件以上ロード済み） */
  isReady(urls?: string[]): boolean {
    if (urls && urls.length > 0) {
      const unique = [...new Set(urls.filter(Boolean))];
      return unique.every((url) => this.loadedUrls.has(url));
    }
    return this.loadedUrls.size > 0;
  }

  hasLoaded(url: string): boolean {
    return this.loadedUrls.has(url);
  }

  async preloadAll(urls: string[]): Promise<void> {
    const unique = [...new Set(urls.filter(Boolean))];
    await Promise.all(unique.map((url) => this.preloadOne(url)));
  }

  /** Display マウント時の静的素材 */
  async preloadDisplayAssets(): Promise<void> {
    await this.preloadAll([...DISPLAY_STATIC_ASSET_URLS, ...OPTIONAL_VIDEO_URLS]);
  }

  private async preloadOne(url: string): Promise<void> {
    if (this.loadedUrls.has(url)) return;

    let pending = this.inFlight.get(url);
    if (!pending) {
      pending = this.loadUrl(url).finally(() => {
        this.inFlight.delete(url);
      });
      this.inFlight.set(url, pending);
    }

    await pending;
    this.loadedUrls.add(url);
  }

  private async loadUrl(url: string): Promise<void> {
    if (isVideoUrl(url)) {
      try {
        await preloadVideo(url);
      } catch {
        console.info('[media] optional video skip:', url);
      }
      return;
    }
    await preloadImages([url]);
  }
}

export const displayMediaPreloader = new MediaPreloader();
