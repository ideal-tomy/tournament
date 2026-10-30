import { useState } from 'react';
import type { Participant } from './api';

// This exact record was created by the first public Chromium camera test.
// Keep the stored data intact, and do not mistake its green test pattern for a real photo.
const AUTOMATED_CAMERA_TEST_ID = 'checkin-981ee495-ed79-44fd-a00c-6a8792e17102';

export default function ParticipantPhoto({ participant, refreshKey, onRetry }: { participant: Participant; refreshKey: string; onRetry(): void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <div className="participant-photo">
    <img src={`${participant.portraitUrl}?refresh=${encodeURIComponent(`${refreshKey}-${participant.version}`)}${participant.portraitSource === 'automated-test' ? '&includeTestData=1' : ''}`} alt={`${participant.name}の顔写真`} hidden={status === 'error'} onLoad={event => setStatus(event.currentTarget.naturalWidth > 0 ? 'ready' : 'error')} onError={() => setStatus('error')} />
    {status === 'loading' && <p className="photo-status" role="status">写真を読み込んでいます…</p>}
    {status === 'error' && <div className="photo-error" role="alert"><p>写真を取得できませんでした。</p><p>接続とログイン状態を確認し、再読み込みしてください。</p><button onClick={onRetry}>写真を再読み込み</button></div>}
    {participant.id === AUTOMATED_CAMERA_TEST_ID && <p className="photo-test-note">自動試験用の画像です。緑色は模擬カメラの撮影内容で、実際の顔写真ではありません。</p>}
  </div>;
}
