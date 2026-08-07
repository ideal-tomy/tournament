import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { bracketThemeCssVars, roundBannerText, themeForKey } from '../../../styles/bracketTheme';
import type { BracketThemeKey } from '../../../types';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { MATCH_PRESENTATION_TIMING } from '../matchPresentationTiming';

interface VsCardSceneProps {
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketKey: BracketThemeKey;
  round: number;
  matchNumber: number;
  awaitingOperator: boolean;
  restoreCompleted?: boolean;
}

export default function VsCardScene({
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketKey,
  round,
  matchNumber,
  awaitingOperator,
  restoreCompleted,
}: VsCardSceneProps) {
  const theme = themeForKey(bracketKey);
  const vars = bracketThemeCssVars(bracketKey);
  const rootRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (restoreCompleted) return;
    const ctx = gsap.context(() => {
      const intro = MATCH_PRESENTATION_TIMING.vsIntro / 1000;
      gsap
        .timeline()
        .fromTo(bannerRef.current, { autoAlpha: 0, y: -24 }, { autoAlpha: 1, y: 0, duration: 0.35 })
        .fromTo(leftRef.current, { autoAlpha: 0, x: '-18vw' }, { autoAlpha: 1, x: 0, duration: intro, ease: 'power3.out' }, 0.1)
        .fromTo(rightRef.current, { autoAlpha: 0, x: '18vw' }, { autoAlpha: 1, x: 0, duration: intro, ease: 'power3.out' }, 0.1)
        .fromTo(vsRef.current, { autoAlpha: 0, scale: 0.25, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.8)' }, 0.45);
    }, rootRef);
    return () => ctx.revert();
  }, [restoreCompleted]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[60vh] flex-col items-center justify-center gap-8 px-8"
      style={{
        ...vars,
        backgroundColor: theme.fill,
        backgroundImage: `linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.45)), url(${FX.backgrounds.tournament})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div ref={bannerRef} className="flex flex-col items-center gap-3">
        <p className="text-3xl font-black tracking-[0.28em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.35)]">
          NEXT MATCH
        </p>
        <div
          className="rounded px-6 py-2 text-sm font-black tracking-[0.3em]"
          style={{
            color: theme.labelColor,
            border:
              theme.frame === 'dashed'
                ? `2px dashed ${theme.accent}`
                : theme.frame === 'double'
                  ? `4px double ${theme.accent}`
                  : `2px solid ${theme.accent}`,
          }}
        >
          {roundBannerText(bracketKey, round)} · MATCH {matchNumber}
        </div>
      </div>

      <div className="flex w-full max-w-5xl items-center justify-center gap-6">
        <div ref={leftRef} className="flex flex-1"><TeamBlock label={teamALabel} faces={teamAFaces} accent={theme.accent} /></div>
        <img ref={vsRef} src={FX.effects.vsMark} alt="VS" className="h-36 w-36 object-contain drop-shadow-[0_0_28px_rgba(250,204,21,.8)]" />
        <div ref={rightRef} className="flex flex-1"><TeamBlock label={teamBLabel} faces={teamBFaces} accent={theme.accent} /></div>
      </div>

      {awaitingOperator && (
        <div className="absolute bottom-4 right-4 rounded bg-black/50 px-3 py-1 text-xs text-amber-200">
          操作待ち
        </div>
      )}
    </div>
  );
}

function TeamBlock({
  label,
  faces,
  accent,
}: {
  label: string;
  faces: string[];
  accent: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <div className="flex gap-2">
        {faces.length > 0 ? (
          faces.map((url) => (
            <div key={url} className="relative h-36 w-36 p-4">
              <img src={url} alt="" className="h-full w-full rounded-lg object-cover" style={{ boxShadow: `0 0 24px ${accent}66` }} />
              <img src={FX.frames.player} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
            </div>
          ))
        ) : (
          <div
            className="flex h-28 w-28 items-center justify-center rounded-lg bg-slate-800 text-slate-400"
            style={{ boxShadow: `0 0 24px ${accent}66` }}
          >
            ?
          </div>
        )}
      </div>
      <div className="relative min-w-64 px-8 py-3 text-center">
        <img src={FX.frames.teamPlate} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-80" />
        <p className="relative truncate text-xl font-bold text-white">{label}</p>
      </div>
    </div>
  );
}
