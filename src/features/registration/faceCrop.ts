import { FaceDetection } from '@mediapipe/face_detection';

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const OUT_SIZE = 512;
const FACE_DETECT_TIMEOUT_MS = 5000;
const MEDIAPIPE_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229';

let detector: FaceDetection | null = null;
let detectorInit: Promise<FaceDetection> | null = null;

function getDetector(): Promise<FaceDetection> {
  if (detector) return Promise.resolve(detector);
  if (detectorInit) return detectorInit;

  detectorInit = (async () => {
    const fd = new FaceDetection({
      locateFile: (file) => `${MEDIAPIPE_CDN}/${file}`,
    });
    fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
    detector = fd;
    return fd;
  })();

  return detectorInit;
}

function sourceSize(source: HTMLCanvasElement | HTMLVideoElement): {
  w: number;
  h: number;
} {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  return { w: source.width, h: source.height };
}

/** ストリーム停止前に video → canvas へフレーム固定 */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) {
    throw new Error('カメラ映像の取得に失敗しました。もう一度撮影してください。');
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}

function drawSourceToCanvas(source: HTMLCanvasElement | HTMLVideoElement): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) return source;
  return captureVideoFrame(source);
}

/** MediaPipe で顔 BB を取得。検出失敗・タイムアウト時は undefined */
export async function detectFaceBox(
  source: HTMLCanvasElement | HTMLVideoElement,
): Promise<FaceBox | undefined> {
  const { w: sw, h: sh } = sourceSize(source);
  if (sw === 0 || sh === 0) return undefined;

  try {
    const canvas = drawSourceToCanvas(source);
    const fd = await getDetector();

    const detection = await Promise.race([
      new Promise<FaceBox | undefined>((resolve) => {
        fd.onResults((results) => {
          const bb = results.detections?.[0]?.boundingBox;
          if (!bb) {
            resolve(undefined);
            return;
          }
          resolve({
            x: (bb.xCenter - bb.width / 2) * sw,
            y: (bb.yCenter - bb.height / 2) * sh,
            w: bb.width * sw,
            h: bb.height * sh,
          });
        });
        void fd.send({ image: canvas });
      }),
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), FACE_DETECT_TIMEOUT_MS);
      }),
    ]);

    return detection;
  } catch {
    return undefined;
  }
}

/** 1:1 正方形クロップ。box 無しは中央フォールバック */
export async function cropToSquare(
  source: HTMLCanvasElement | HTMLVideoElement,
  box?: FaceBox,
): Promise<Blob> {
  const { w: sw, h: sh } = sourceSize(source);
  if (sw === 0 || sh === 0) {
    throw new Error('画像サイズが不正です');
  }

  let cx: number;
  let cy: number;
  let size: number;
  if (box) {
    size = Math.min(sw, sh, Math.max(box.w, box.h) * 1.6);
    cx = box.x + box.w / 2;
    cy = box.y + box.h / 2;
  } else {
    size = Math.min(sw, sh);
    cx = sw / 2;
    cy = sh / 2;
  }
  const sx = Math.max(0, Math.min(sw - size, cx - size / 2));
  const sy = Math.max(0, Math.min(sh - size, cy - size / 2));

  const out = document.createElement('canvas');
  out.width = OUT_SIZE;
  out.height = OUT_SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(source, sx, sy, size, size, 0, 0, OUT_SIZE, OUT_SIZE);

  return blobFromCanvas(out);
}

/** 原画像をそのまま JPEG 化 */
export async function captureOriginal(
  source: HTMLVideoElement | HTMLCanvasElement,
): Promise<Blob> {
  const canvas = drawSourceToCanvas(source);
  return blobFromCanvas(canvas, 0.92);
}

/** canvas から顔検出 → クロップ（撮影後はこちらを使う） */
export async function processCaptureFromCanvas(canvas: HTMLCanvasElement): Promise<{
  photo: Blob;
  face: Blob;
  faceDetected: boolean;
  facePreviewUrl: string;
}> {
  const photo = await captureOriginal(canvas);
  const box = await detectFaceBox(canvas);
  const face = await cropToSquare(canvas, box);
  const facePreviewUrl = URL.createObjectURL(face);
  return { photo, face, faceDetected: box != null, facePreviewUrl };
}

/** @deprecated ストリーム停止前に captureVideoFrame → processCaptureFromCanvas を使う */
export async function processCapture(source: HTMLVideoElement) {
  return processCaptureFromCanvas(captureVideoFrame(source));
}

/** iOS Safari では toBlob が null を返すことがある → toDataURL でフォールバック */
function blobFromCanvas(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
          return;
        }
        try {
          resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg', quality)));
        } catch {
          reject(new Error('画像の生成に失敗しました'));
        }
      },
      'image/jpeg',
      quality,
    );
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  if (!base64) throw new Error('画像の生成に失敗しました');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
