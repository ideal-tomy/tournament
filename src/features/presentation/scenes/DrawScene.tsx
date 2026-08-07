import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import type { EventStateRow, PresentationMode } from '../../../types';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { fetchDrawPresentation, type DrawPresentationData } from '../../draw/drawApi';
import { transitionScene } from '../../scene/sceneActions';
import { groupDrawParticipants, shouldShowBackOnlyEffect } from '../drawVisualState';
import { drawSeconds } from '../drawAnimationTiming';
import PairConfirmed from './PairConfirmed';

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

  return <DrawStage {...props} data={data} />;
}

function DrawStage({
  eventId,
  sceneSeq,
  presentationMode,
  audioEnabled,
  forceComplete,
  restoreCompleted,
  onSceneUpdated,
  data,
}: DrawSceneProps & { data: DrawPresentationData }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const teams = useMemo(
    () => groupDrawParticipants(data.participants, data.teamSize),
    [data],
  );

  useEffect(() => {
    finishedRef.current = false;
    let cancelled = false;

    async function finish() {
      if (finishedRef.current) return;
      finishedRef.current = true;
      try {
        const row = await transitionScene(eventId, 'bracket', { force: true });
        if (!cancelled) onSceneUpdated?.(row);
      } catch (reason) {
        console.warn('[DrawScene] transition to bracket failed', reason);
        finishedRef.current = false;
      }
    }

    if (forceComplete || restoreCompleted || data.participants.length === 0) {
      void finish();
      return () => {
        cancelled = true;
      };
    }

    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.draw-reveal-card');
      const pairStages = gsap.utils.toArray<HTMLElement>('.draw-pair-stage');
      const summary = root.querySelector<HTMLElement>('.draw-team-summary');
      const shortGrid = root.querySelector<HTMLElement>('.draw-short-grid');
      const intro = root.querySelector<HTMLElement>('.draw-intro');
      const tl = gsap.timeline({ onComplete: () => void finish() });

      gsap.set(cards, { autoAlpha: 0 });
      gsap.set(pairStages, { autoAlpha: 0, scale: 0.94 });
      gsap.set(summary, { autoAlpha: 0, scale: 0.92 });
      gsap.set(shortGrid, { autoAlpha: 0 });

      if (presentationMode === 'full') {
        tl.fromTo(
          intro,
          { autoAlpha: 0, scale: 0.85 },
          { autoAlpha: 1, scale: 1, duration: drawSeconds('introEnter') },
        )
          .to({}, { duration: drawSeconds('introHold') })
          .to(intro, { autoAlpha: 0, duration: drawSeconds('introExit') });

        let cardIndex = 0;
        teams.forEach((members, teamIndex) => {
          members.forEach(() => {
            const card = cards[cardIndex];
            cardIndex += 1;
            if (!card) return;

            const shell = card.querySelector<HTMLElement>('.draw-card-shell');
            const dart = card.querySelector<HTMLElement>('.draw-dart');
            const streak = card.querySelector<HTMLElement>('.draw-dart-streak');
            const impact = card.querySelectorAll<HTMLElement>('.draw-impact-layer');
            const impactMark = card.querySelector<HTMLElement>('.draw-impact-mark');
            const playerReveal = card.querySelectorAll<HTMLElement>('.draw-player-reveal');
            const backOnlyEffects = [...impact, impactMark].filter(
              (element): element is HTMLElement => element != null,
            );

            tl.set([dart, streak, ...backOnlyEffects], { autoAlpha: 0 })
              .set(playerReveal, { autoAlpha: 0 })
              .set(shell, { rotationY: 0 })
              .set(card, { autoAlpha: 1 })
              .fromTo(
                shell,
                { scale: 0.72 },
                { scale: 1, duration: drawSeconds('cardEnter'), ease: 'back.out(1.7)' },
              )
              .call(() => playAudio(FX.audio.dartFly, audioEnabled))
              .fromTo(
                [dart, streak],
                { autoAlpha: 0, x: '65vw', y: '-24vh', scale: 0.72 },
                {
                  autoAlpha: 1,
                  x: 0,
                  y: 0,
                  scale: 1,
                  duration: drawSeconds('dartFlight'),
                  ease: 'power4.in',
                },
              )
              .call(() => playAudio(FX.audio.impact, audioEnabled))
              .set(backOnlyEffects, {
                autoAlpha: shouldShowBackOnlyEffect('back', 'impact') ? 1 : 0,
              })
              .fromTo(
                impact,
                { scale: 0.25 },
                {
                  scale: 1.35,
                  duration: drawSeconds('impactBurst'),
                  ease: 'power3.out',
                },
              )
              .to({}, { duration: drawSeconds('impactHold') })
              .to([dart, streak, ...backOnlyEffects], {
                autoAlpha: 0,
                duration: drawSeconds('impactClear'),
              })
              .call(() => playAudio(FX.audio.cardFlip, audioEnabled))
              .to(shell, {
                rotationY: 180,
                duration: drawSeconds('cardFlip'),
                ease: 'power2.inOut',
              })
              .to(playerReveal, {
                autoAlpha: 1,
                duration: drawSeconds('playerReveal'),
                ease: 'power2.out',
              })
              .to(card, {
                autoAlpha: 0,
                scale: 0.96,
                duration: drawSeconds('memberExit'),
                ease: 'power2.inOut',
              });
          });

          const pairStage = pairStages[teamIndex];
          if (pairStage) {
            tl.call(() => playAudio(FX.audio.teamConfirm, audioEnabled))
              .fromTo(
                pairStage,
                { autoAlpha: 0, scale: 0.94, y: 24 },
                {
                  autoAlpha: 1,
                  scale: 1,
                  y: 0,
                  duration: drawSeconds('pairReveal'),
                  ease: 'back.out(1.35)',
                },
              )
              .to({}, { duration: drawSeconds('pairConfirmHold') })
              .to(pairStage, {
                autoAlpha: 0,
                scale: 0.96,
                y: -20,
                duration: drawSeconds('transitionToNext'),
                ease: 'power2.inOut',
              });
          }
        });

        tl.call(() => playAudio(FX.audio.teamConfirm, audioEnabled))
          .to(summary, {
            autoAlpha: 1,
            scale: 1,
            duration: drawSeconds('summaryEnter'),
            ease: 'back.out(1.4)',
          })
          .to({}, { duration: drawSeconds('summaryHold') });
      } else if (presentationMode === 'short') {
        tl.set(intro, { autoAlpha: 0 })
          .fromTo(
            shortGrid,
            { autoAlpha: 0, y: 50 },
            { autoAlpha: 1, y: 0, duration: drawSeconds('shortGridEnter') },
          )
          .to({}, { duration: drawSeconds('shortGridHold') })
          .to(shortGrid, { autoAlpha: 0, duration: drawSeconds('shortGridExit') })
          .call(() => playAudio(FX.audio.teamConfirm, audioEnabled))
          .to(summary, { autoAlpha: 1, scale: 1, duration: drawSeconds('summaryEnter') })
          .to({}, { duration: drawSeconds('summaryHold') });
      } else {
        tl.set([intro, cards, shortGrid], { autoAlpha: 0 })
          .set(summary, { autoAlpha: 1, scale: 1 })
          .call(() => playAudio(FX.audio.teamConfirm, audioEnabled))
          .to({}, { duration: drawSeconds('liteHold') });
      }
    }, root);

    return () => {
      cancelled = true;
      ctx.revert();
    };
  }, [
    eventId,
    sceneSeq,
    presentationMode,
    audioEnabled,
    forceComplete,
    restoreCompleted,
    data,
    onSceneUpdated,
  ]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-[60vh] overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${FX.backgrounds.cardTable})` }}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div className="draw-intro absolute inset-0 z-10 flex flex-col items-center justify-center">
        <p className="text-sm font-black tracking-[0.55em] text-cyan-300">TEAM DRAW</p>
        <h2 className="mt-4 text-5xl font-black text-white drop-shadow-[0_0_32px_rgba(34,211,238,0.8)]">
          チーム編成
        </h2>
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center">
        {data.participants.map((participant) => (
          <RevealCard key={participant.id} participant={participant} compact={presentationMode !== 'full'} />
        ))}
      </div>

      <div className="draw-short-grid invisible absolute inset-0 z-20 flex items-center justify-center px-8">
        <div className="grid w-full max-w-6xl grid-cols-4 gap-3 lg:grid-cols-6 xl:grid-cols-8">
          {data.participants.map((participant) => (
            <div key={participant.id} className="rounded-xl border border-cyan-300/40 bg-black/65 p-3 text-center">
              <ParticipantFace participant={participant} className="mx-auto aspect-square w-full max-w-24 rounded-lg" />
              <p className="mt-2 truncate text-sm font-bold text-white">{participant.displayName}</p>
            </div>
          ))}
        </div>
      </div>

      {teams.map((members, index) => (
        <PairConfirmed
          key={`pair-${members.map((member) => member.id).join('-')}`}
          teamNumber={index + 1}
          members={members}
        />
      ))}

      <div className="draw-team-summary invisible absolute inset-0 z-30 flex flex-col items-center justify-center px-8">
        <p className="mb-5 text-sm font-black tracking-[0.45em] text-amber-300">TEAMS CONFIRMED</p>
        <div className="grid w-full max-w-6xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {teams.map((members, index) => (
            <div
              key={members.map((member) => member.id).join('-')}
              className="relative overflow-hidden rounded-xl border border-amber-300/50 bg-black/70 p-4 shadow-[0_0_28px_rgba(251,191,36,0.22)]"
            >
              <img src={FX.frames.teamPlate} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-45" />
              <p className="relative text-xs font-black tracking-widest text-amber-200">TEAM {index + 1}</p>
              <div className="relative mt-3 flex items-center gap-3">
                {members.map((member) => (
                  <div key={member.id} className="min-w-0 flex-1 text-center">
                    <ParticipantFace participant={member} className="mx-auto h-16 w-16" />
                    <p className="mt-2 truncate text-sm font-bold text-white">{member.displayName}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevealCard({
  participant,
  compact,
}: {
  participant: DrawPresentationData['participants'][number];
  compact: boolean;
}) {
  return (
    <div className={`draw-reveal-card invisible absolute ${compact ? 'scale-75' : ''}`}>
      <div className="draw-card-shell relative h-[min(66vh,620px)] aspect-[2/3] [transform-style:preserve-3d]">
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <img src={FX.cards.back} alt="カード裏面" className="h-full w-full object-contain drop-shadow-[0_0_35px_rgba(34,211,238,0.55)]" />
          <img src={FX.cards.impactMark} alt="" className="draw-impact-mark invisible pointer-events-none absolute left-1/2 top-1/2 z-20 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-80" />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <img src={FX.cards.front} alt="" className="absolute inset-0 h-full w-full object-contain" />
          <div className="draw-player-reveal absolute inset-[14%_13%_22%] flex items-center justify-center">
            <ParticipantFace participant={participant} className="h-full w-full rounded-xl" />
          </div>
          <div className="draw-player-reveal absolute bottom-[8%] left-[14%] right-[14%]">
            <img src={FX.frames.nameplate} alt="" className="absolute inset-0 h-full w-full object-fill opacity-80" />
            <p className="relative truncate px-4 py-3 text-center text-xl font-black text-white drop-shadow-lg">
              {participant.displayName}
            </p>
          </div>
        </div>
      </div>

      <img src={FX.darts.motionStreak} alt="" className="draw-dart-streak invisible pointer-events-none absolute left-1/2 top-1/2 z-30 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 object-contain" />
      <img src={FX.darts.main} alt="" className="draw-dart invisible pointer-events-none absolute left-1/2 top-1/2 z-40 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain" />
      {[FX.effects.impactFlash, FX.effects.goldenSparks, FX.effects.blueRing, FX.effects.impactCloud, FX.effects.debris].map((src) => (
        <img key={src} src={src} alt="" className="draw-impact-layer invisible pointer-events-none absolute left-1/2 top-1/2 z-50 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-contain" />
      ))}
    </div>
  );
}

function ParticipantFace({ participant, className }: { participant: DrawRevealParticipant; className: string }) {
  if (!participant.faceUrl) {
    return <div className={`${className} flex items-center justify-center bg-slate-800 text-4xl text-slate-400`}>?</div>;
  }
  return <img src={participant.faceUrl} alt={participant.displayName} className={`${className} object-cover`} />;
}

function playAudio(src: string, enabled: boolean) {
  if (!enabled) return;
  const audio = new Audio(src);
  audio.volume = 0.72;
  void audio.play().catch(() => undefined);
}

type DrawRevealParticipant = DrawPresentationData['participants'][number];
