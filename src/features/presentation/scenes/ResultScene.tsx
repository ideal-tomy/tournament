import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { bracketThemeCssVars, roundBannerText, themeForKey } from '../../../styles/bracketTheme';
import type { BracketThemeKey, EventStateRow, PresentationMode } from '../../../types';
import { transitionScene } from '../../scene/sceneActions';

interface ResultSceneProps {
  eventId: string;
  /** scene_seq — 試合ごとに演出をやり直すキー */
  sceneSeq: number;
  winnerLabel: string;
  loserLabel: string;
  winnerFaces: string[];
  loserFaces: string[];
  bracketKey: BracketThemeKey;
  round: number;
  presentationMode: PresentationMode;
  forceComplete?: boolean;
  restoreCompleted?: boolean;
  /** DB 更新後に Display のローカル state へ即反映 */
  onSceneUpdated?: (row: EventStateRow) => void;
}

export default function ResultScene({
  eventId,
  sceneSeq,
  winnerLabel,
  loserLabel,
  winnerFaces,
  loserFaces,
  bracketKey,
  round,
  presentationMode,
  forceComplete,
  restoreCompleted,
  onSceneUpdated,
}: ResultSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const loserRef = useRef<HTMLDivElement>(null);
  const petalRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const theme = themeForKey(bracketKey);
  const lite = presentationMode === 'lite';

  useEffect(() => {
    doneRef.current = false;
    let cancelled = false;
    const timers: number[] = [];

    async function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      try {
        const row = await transitionScene(eventId, 'bracket', { force: true });
        if (!cancelled) onSceneUpdated?.(row);
      } catch (e) {
        console.warn('[ResultScene] transition to bracket failed', e);
        // 失敗時はやり直せるように戻す
        doneRef.current = false;
      }
    }

    if (restoreCompleted || forceComplete) {
      if (winnerRef.current) {
        winnerRef.current.style.transform = 'scale(1.5)';
        winnerRef.current.style.opacity = '1';
      }
      if (loserRef.current) {
        loserRef.current.style.transform = 'scale(0.75)';
        loserRef.current.style.opacity = '0.35';
      }
      void finish();
      return () => {
        cancelled = true;
      };
    }

    if (lite) {
      const w = winnerRef.current;
      const l = loserRef.current;
      if (w) {
        w.style.transition = 'transform 0.7s ease, opacity 0.7s ease';
        requestAnimationFrame(() => {
          w.style.transform = 'scale(1.5)';
        });
      }
      timers.push(
        window.setTimeout(() => {
          if (l) {
            l.style.transition = 'transform 0.7s ease, opacity 0.7s ease';
            l.style.transform = 'scale(0.75)';
            l.style.opacity = '0.35';
          }
        }, 300),
      );
      timers.push(window.setTimeout(() => void finish(), 3500));
      return () => {
        cancelled = true;
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    const tl = gsap.timeline({
      onComplete: () => {
        void finish();
      },
    });

    tl.to(rootRef.current, { filter: 'brightness(0.35)', duration: 0.2 }, 0)
      .to(
        winnerRef.current,
        { scale: 1.5, filter: 'brightness(1.15)', duration: 0.7 },
        0.2,
      )
      .to(
        loserRef.current,
        { scale: 0.75, opacity: 0.35, duration: 0.7 },
        0.5,
      )
      .call(
        () => {
          const v = petalRef.current;
          if (v) {
            v.currentTime = 0;
            void v.play().catch(() => undefined);
          }
        },
        [],
        1.0,
      )
      .to({}, { duration: 2.5 });

    return () => {
      cancelled = true;
      // kill すると onComplete が飛ばないので、未完了なら遷移を保証
      const progressed = tl.progress() > 0 && !doneRef.current;
      tl.kill();
      if (progressed) {
        void finish();
      }
    };
  }, [
    eventId,
    sceneSeq,
    forceComplete,
    restoreCompleted,
    lite,
    onSceneUpdated,
  ]);

  const vars = bracketThemeCssVars(bracketKey);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[60vh] flex-col items-center justify-center gap-8 overflow-hidden px-8"
      style={{ ...vars, background: theme.fill }}
    >
      <div
        className="rounded px-6 py-2 text-sm font-black tracking-[0.3em]"
        style={{ color: theme.labelColor, border: `2px solid ${theme.accent}` }}
      >
        {roundBannerText(bracketKey, round)}
      </div>

      <div className="flex w-full max-w-5xl items-center justify-center gap-10">
        <div ref={winnerRef} className="flex flex-1 flex-col items-center gap-3 origin-center">
          <FaceRow faces={winnerFaces} />
          <p className="text-2xl font-black text-amber-200">WIN</p>
          <p className="text-xl font-bold text-white">{winnerLabel}</p>
        </div>
        <div ref={loserRef} className="flex flex-1 flex-col items-center gap-3 origin-center">
          <FaceRow faces={loserFaces} />
          <p className="text-xl font-bold text-white/80">{loserLabel}</p>
        </div>
      </div>

      {!lite && (
        <video
          ref={petalRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src="/images/test_mv.webm"
          muted
          playsInline
          style={{ mixBlendMode: 'screen' }}
        />
      )}
      {lite && (
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 50% 20%, rgba(251,191,36,0.35), transparent 55%)',
          }}
        />
      )}
    </div>
  );
}

function FaceRow({ faces }: { faces: string[] }) {
  return (
    <div className="flex gap-2">
      {faces.length > 0 ? (
        faces.map((url) => (
          <img key={url} src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
        ))
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
          ?
        </div>
      )}
    </div>
  );
}
