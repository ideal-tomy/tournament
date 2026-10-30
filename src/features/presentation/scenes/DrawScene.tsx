import { useCallback, useEffect, useState } from 'react';
import type { EventStateRow, PresentationMode } from '../../../types';
import { fetchDrawPresentation, type DrawPresentationData } from '../../draw/drawApi';
import { transitionScene } from '../../scene/sceneActions';
import DrawStage from './DrawStage';

interface DrawSceneProps {
  eventId: string;
  sceneSeq: number;
  drawSessionId?: string;
  presentationMode: PresentationMode;
  audioEnabled: boolean;
  forceComplete?: boolean;
  restoreCompleted?: boolean;
  onSceneUpdated?: (row: EventStateRow) => void;
}

export default function DrawScene(props: DrawSceneProps) {
  const [data, setData] = useState<DrawPresentationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void fetchDrawPresentation(props.eventId, props.drawSessionId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '抽選データの取得に失敗しました');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.eventId, props.drawSessionId, props.sceneSeq]);

  const onComplete = useCallback(async () => {
    const row = await transitionScene(props.eventId, 'bracket', { force: true });
    props.onSceneUpdated?.(row);
  }, [props.eventId, props.onSceneUpdated]);

  if (error) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-slate-950 text-red-300">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-slate-950 text-cyan-200">
        抽選演出を準備中…
      </div>
    );
  }

  return <DrawStage {...props} data={data} onComplete={onComplete} />;
}
