/** 1×1 のデコード可能な JPEG（進行テスト・Vitest 用）。旧 80 バイト stub は API 検証は通るがブラウザ decode に失敗する。 */
const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAI/8QAFBABAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/ADf/2Q==';

export function sampleJpegDataUrl(): string {
  return `data:image/jpeg;base64,${MINIMAL_JPEG_BASE64}`;
}