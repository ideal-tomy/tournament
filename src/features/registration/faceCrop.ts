import { FaceDetection } from '@mediapipe/face_detection';

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const OUT_SIZE = 512;
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

function drawSourceToCanvas(source: HTMLCanvasElement | HTMLVideoElement): HTMLCanvasElement {
  const { w, h } = sourceSize(source);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** MediaPipe で顔 BB を取得。検出失敗時は undefined */
export async function detectFaceBox(
  source: HTMLCanvasElement | HTMLVideoElement,
): Promise<FaceBox | undefined> {
  const { w: sw, h: sh } = sourceSize(source);
  if (sw === 0 || sh === 0) return undefined;

  const canvas = drawSourceToCanvas(source);
  const fd = await getDetector();

  return new Promise((resolve) => {
    fd.onResults((results) => {
      const detection = results.detections?.[0];
      const bb = detection?.boundingBox;
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
  });
}

/** 1:1 正方形クロップ。box 無しは中央フォールバック */
export async function cropToSquare(
  source: HTMLCanvasElement | HTMLVideoElement,
  box?: FaceBox,
): Promise<Blob> {
  const { w: sw, h: sh } = sourceSize(source);

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

/** 顔検出 → クロップを一括実行 */
export async function processCapture(source: HTMLVideoElement): Promise<{
  photo: Blob;
  face: Blob;
  faceDetected: boolean;
  facePreviewUrl: string;
}> {
  const photo = await captureOriginal(source);
  const box = await detectFaceBox(source);
  const face = await cropToSquare(source, box);
  const facePreviewUrl = URL.createObjectURL(face);
  return { photo, face, faceDetected: box != null, facePreviewUrl };
}

function blobFromCanvas(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('画像の生成に失敗しました'))),
      'image/jpeg',
      quality,
    );
  });
}
