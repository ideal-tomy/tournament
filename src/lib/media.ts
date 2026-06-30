/** 演出素材・顔写真のプリロード */

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
