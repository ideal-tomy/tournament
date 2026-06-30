import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureVideoFrame,
  processCaptureFromCanvas,
} from './faceCrop';
import {
  addParticipant,
  updateParticipantPhotos,
} from './registrationApi';

type Step = 'preview' | 'confirm' | 'saving';
export type CameraFacing = 'user' | 'environment';

interface CaptureDraft {
  photo: Blob;
  face: Blob;
  facePreviewUrl: string;
  faceDetected: boolean;
}

interface CameraCaptureProps {
  eventId: string;
  retakeTarget?: { id: string; name: string } | null;
  onDone: () => void;
  onCancelRetake?: () => void;
}

export default function CameraCapture({
  eventId,
  retakeTarget,
  onDone,
  onCancelRetake,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('preview');
  const [facingMode, setFacingMode] = useState<CameraFacing>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [name, setName] = useState(retakeTarget?.name ?? '');
  const [processing, setProcessing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        if (video.videoWidth > 0) {
          setCameraReady(true);
        }
      }
    } catch (e) {
      setCameraError(formatCameraError(e));
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (step === 'preview') {
      void startCamera();
    }
    return () => {
      if (step === 'preview') stopCamera();
    };
  }, [step, facingMode, startCamera, stopCamera]);

  useEffect(() => {
    setName(retakeTarget?.name ?? '');
  }, [retakeTarget]);

  useEffect(() => {
    return () => {
      if (draft?.facePreviewUrl) URL.revokeObjectURL(draft.facePreviewUrl);
    };
  }, [draft?.facePreviewUrl]);

  function resetToPreview() {
    if (draft?.facePreviewUrl) URL.revokeObjectURL(draft.facePreviewUrl);
    setDraft(null);
    setSaveError(null);
    setStep('preview');
  }

  function toggleFacing() {
    setFacingMode((f) => (f === 'user' ? 'environment' : 'user'));
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    setProcessing(true);
    setSaveError(null);
    try {
      // ストリーム停止前にフレームを canvas に固定（iOS で必須）
      const frame = captureVideoFrame(video);
      stopCamera();
      const result = await processCaptureFromCanvas(frame);
      setDraft(result);
      setStep('confirm');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '撮影処理に失敗しました');
      void startCamera();
    } finally {
      setProcessing(false);
    }
  }

  async function handleRegister() {
    if (!draft || !name.trim()) return;

    setStep('saving');
    setSaveError(null);
    try {
      if (retakeTarget) {
        await updateParticipantPhotos(
          retakeTarget.id,
          eventId,
          draft.photo,
          draft.face,
          name,
        );
      } else {
        await addParticipant(eventId, name, draft.photo, draft.face);
      }
      if (draft.facePreviewUrl) URL.revokeObjectURL(draft.facePreviewUrl);
      setDraft(null);
      onDone();
      setStep('preview');
      setName(retakeTarget ? retakeTarget.name : '');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '登録に失敗しました');
      setStep('confirm');
    }
  }

  if (cameraError && step === 'preview') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800 text-sm whitespace-pre-line">{cameraError}</p>
        <button
          type="button"
          onClick={() => void startCamera()}
          className="mt-3 rounded bg-red-800 text-white px-4 py-2 text-sm"
        >
          再試行
        </button>
      </div>
    );
  }

  if (step === 'confirm' && draft) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center">
          <p className="text-sm text-slate-600 mb-2">登録プレビュー（1:1 クロップ）</p>
          <img
            src={draft.facePreviewUrl}
            alt="顔プレビュー"
            className="w-48 h-48 rounded-lg object-cover border-2 border-slate-200"
          />
          {!draft.faceDetected && (
            <p className="text-xs text-amber-700 mt-2">
              顔を検出できなかったため、中央クロップで登録します
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="参加者名"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg"
            autoFocus
          />
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={resetToPreview}
            className="rounded-lg border border-slate-300 py-4 font-medium"
          >
            撮り直し
          </button>
          <button
            type="button"
            onClick={() => void handleRegister()}
            disabled={!name.trim()}
            className="rounded-lg bg-slate-800 text-white py-4 font-bold disabled:opacity-40"
          >
            {retakeTarget ? '更新する' : '登録する'}
          </button>
        </div>

        {retakeTarget && onCancelRetake && (
          <button
            type="button"
            onClick={onCancelRetake}
            className="w-full text-sm text-slate-500 underline"
          >
            キャンセル
          </button>
        )}
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="py-12 text-center text-slate-600">
        保存中…
      </div>
    );
  }

  const isSelfie = facingMode === 'user';

  return (
    <div className="space-y-4">
      {retakeTarget && (
        <p className="text-sm text-slate-600">
          「{retakeTarget.name}」の写真を撮り直します
        </p>
      )}

      <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={(e) => {
            if (e.currentTarget.videoWidth > 0) setCameraReady(true);
          }}
          className={`absolute inset-0 w-full h-full object-cover ${isSelfie ? 'mirror' : ''}`}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[55%] max-w-xs aspect-square rounded-full border-4 border-white/70 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <button
          type="button"
          onClick={toggleFacing}
          className="absolute top-3 right-3 rounded-full bg-black/60 text-white px-3 py-2 text-sm font-medium backdrop-blur-sm"
          aria-label="カメラ切替"
        >
          {isSelfie ? '📷 外カメラ' : '🤳 インカメラ'}
        </button>
        <p className="absolute bottom-3 left-0 right-0 text-center text-white/90 text-sm drop-shadow">
          ガイド枠に顔を合わせてください
        </p>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <button
        type="button"
        onClick={() => void handleCapture()}
        disabled={processing || !cameraReady}
        className="w-full rounded-lg bg-emerald-600 text-white py-5 text-xl font-bold disabled:opacity-50"
      >
        {processing ? '処理中…' : '撮影する'}
      </button>

      {retakeTarget && onCancelRetake && (
        <button
          type="button"
          onClick={onCancelRetake}
          className="w-full text-sm text-slate-500 underline"
        >
          キャンセル
        </button>
      )}

      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
}

function formatCameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  const msg = e instanceof Error ? e.message : '';

  if (name === 'NotFoundError' || msg.includes('Requested device not found')) {
    return [
      'カメラが見つかりません。',
      '・DevTools の「デバイスツールバー」（スマホ模擬）を OFF にする',
      '・PC に Web カメラがあるか確認する',
      '・他アプリがカメラを使っていないか確認する',
    ].join('\n');
  }
  if (name === 'NotAllowedError') {
    return 'カメラの使用が拒否されました。アドレスバー左の 🔒 からカメラを「許可」してください。';
  }
  if (name === 'NotReadableError') {
    return 'カメラにアクセスできません。他アプリを閉じてから再試行してください。';
  }
  return msg || 'カメラを起動できません。ブラウザの権限を確認してください。';
}
