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
