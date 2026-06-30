/** Phase 2 以降: 演出素材・顔写真のプリロード */

export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(
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
