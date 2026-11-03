import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import type { PresentationMode } from '../../../types';
import type { DrawPresentationData } from '../../draw/presentationTypes';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { groupDrawParticipants, shouldShowBackOnlyEffect } from '../drawVisualState';
import type { RehearsalTimingPreset } from '../../../lib/rehearsalTiming';
import { drawSeconds, type DrawAnimationTimingKey } from '../drawAnimationTiming';
import PairConfirmed from './PairConfirmed';
import PresentationBackdrop from '../backdrop/PresentationBackdrop';
import { appendPairCelebration, startBackdropLoops } from '../backdrop/appendPresentationBackdrop';
import { playPresentationAudio, type PresentationCue } from '../backdrop/playPresentationAudio';
export interface DrawStageProps { timingPreset?:RehearsalTimingPreset; eventId:string; sceneSeq:number; presentationMode:PresentationMode; audioEnabled:boolean; forceComplete?:boolean; restoreCompleted?:boolean; data:DrawPresentationData; startAtSeconds?:number; onComplete?():Promise<void>|void }

export default function DrawStage({
  eventId,
  sceneSeq,
  presentationMode,
  audioEnabled,
  forceComplete,
  restoreCompleted,
  onComplete,
  startAtSeconds = 0,
  timingPreset = 'show',
  data,
}: DrawStageProps) {
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
        if (!cancelled) await onComplete?.();
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
      const seconds=(key:DrawAnimationTimingKey)=>drawSeconds(key,timingPreset);
      const tl = gsap.timeline({ onComplete: () => void finish() });
      // seek() with events replays every passed callback at once; keep restores silent.
      let restoring = false;
      const cue = (name: PresentationCue) => () => { if (!restoring) playPresentationAudio(name, audioEnabled); };

      gsap.set(cards, { autoAlpha: 0 });
      gsap.set(pairStages, { autoAlpha: 0, scale: 1 });
      gsap.set(summary, { autoAlpha: 0, scale: 0.92 });
      gsap.set(shortGrid, { autoAlpha: 0 });

      if (presentationMode === 'full') {
        tl.fromTo(
          intro,
          { autoAlpha: 0, scale: 0.85 },
          { autoAlpha: 1, scale: 1, duration: seconds('introEnter') },
        )
          .to({}, { duration: seconds('introHold') })
          .to(intro, { autoAlpha: 0, duration: seconds('introExit') });

        let cardIndex = 0;
        teams.forEach((members, teamIndex) => {
          members.forEach(() => {
            const card = cards[cardIndex];
            cardIndex += 1;
            if (!card) return;

            const shell = card.querySelector<HTMLElement>('.draw-card-shell');
            const dart = card.querySelector<HTMLElement>('.draw-dart');
            const streak = card.querySelector<HTMLElement>('.draw-dart-streak');
            const flash = card.querySelector<HTMLElement>('.draw-impact-flash');
            const ring = card.querySelector<HTMLElement>('.draw-impact-ring');
            const impactMark = card.querySelector<HTMLElement>('.draw-impact-mark');
            const playerReveal = card.querySelectorAll<HTMLElement>('.draw-player-reveal');

            // Each beat ends on a still: land → dart sticks → card turns with the dart → face holds.
            const start = tl.duration();
            const fly = start + seconds('cardEnter') + seconds('cardSettle');
            const hit = fly + seconds('dartFlight');
            const flip = hit + seconds('impactBurst') + seconds('impactHold');
            const leave = flip + seconds('cardFlip') + seconds('playerReveal') + seconds('revealHold');
            tl.set([dart, streak, flash, ring, impactMark], { autoAlpha: 0 }, start)
              .set(playerReveal, { autoAlpha: 0 }, start)
              .set(shell, { rotationY: 0, x: 0 }, start)
              .set(card, { autoAlpha: 1, scale: 1 }, start)
              .fromTo(
                shell,
                { autoAlpha: 0, y: -160, scale: 1.2 },
                { autoAlpha: 1, y: 0, scale: 1, duration: seconds('cardEnter'), ease: 'power3.out', immediateRender: false },
                start,
              )
              .call(cue('dartFly'), [], fly)
              .fromTo(
                [dart, streak],
                { autoAlpha: 0, x: '65vw', y: '-24vh', scale: 0.72 },
                { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: seconds('dartFlight'), ease: 'power4.in', immediateRender: false },
                fly,
              )
              .call(cue('impact'), [], hit)
              .set(streak, { autoAlpha: 0 }, hit + 0.04)
              .set(impactMark, { autoAlpha: shouldShowBackOnlyEffect('back', 'impact') ? 1 : 0 }, hit)
              .fromTo(shell, { x: 0 }, { x: 12, duration: 0.04, yoyo: true, repeat: 5, ease: 'none', immediateRender: false }, hit)
              .fromTo(flash, { autoAlpha: 1, scale: 0.3 }, { autoAlpha: 0, scale: 1.5, duration: seconds('impactBurst'), ease: 'expo.out', immediateRender: false }, hit)
              .fromTo(ring, { autoAlpha: 0.9, scale: 0.3 }, { autoAlpha: 0, scale: 1.9, duration: seconds('impactBurst') + 0.3, ease: 'expo.out', immediateRender: false }, hit)
              .call(cue('cardFlip'), [], flip)
              .to(shell, { rotationY: 180, duration: seconds('cardFlip'), ease: 'power2.inOut' }, flip)
              .to(playerReveal, { autoAlpha: 1, duration: seconds('playerReveal'), ease: 'power2.out' }, flip + seconds('cardFlip'))
              .to(card, { autoAlpha: 0, scale: 0.96, duration: seconds('memberExit'), ease: 'power2.inOut' }, leave);
          });

          const pairStage = pairStages[teamIndex];
          if (pairStage) {
            const pairAt = tl.duration();
            const hold = seconds('pairReveal') + seconds('pairConfirmHold');
            tl.call(cue('teamConfirm'), [], pairAt)
              .fromTo(pairStage, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'power2.out', immediateRender: false }, pairAt)
              .to(pairStage, { autoAlpha: 0, scale: 1.04, duration: seconds('transitionToNext'), ease: 'power2.inOut' }, pairAt + hold);
            appendPairCelebration(tl, root, pairStage, { at: pairAt, hold, exit: seconds('transitionToNext') });
          }
        });

        tl.call(cue('teamConfirm'))
          .to(summary, {
            autoAlpha: 1,
            scale: 1,
            duration: seconds('summaryEnter'),
            ease: 'back.out(1.4)',
          })
          .to({}, { duration: seconds('summaryHold') });
      } else if (presentationMode === 'short') {
        tl.set(intro, { autoAlpha: 0 })
          .fromTo(
            shortGrid,
            { autoAlpha: 0, y: 50 },
            { autoAlpha: 1, y: 0, duration: seconds('shortGridEnter') },
          )
          .to({}, { duration: seconds('shortGridHold') })
          .to(shortGrid, { autoAlpha: 0, duration: seconds('shortGridExit') })
          .call(cue('teamConfirm'))
          .to(summary, { autoAlpha: 1, scale: 1, duration: seconds('summaryEnter') })
          .to({}, { duration: seconds('summaryHold') });
      } else {
        tl.set([intro, cards, shortGrid], { autoAlpha: 0 })
          .set(summary, { autoAlpha: 1, scale: 1 })
          .call(cue('teamConfirm'))
          .to({}, { duration: seconds('liteHold') });
      }
      startBackdropLoops(root, presentationMode);
      if (startAtSeconds > 0) {
        restoring = true;
        tl.seek(Math.min(startAtSeconds, tl.duration()), false);
        restoring = false;
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
    timingPreset,
    audioEnabled,
    forceComplete,
    restoreCompleted,
    data,
    onComplete,
    startAtSeconds,
  ]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-[60vh] overflow-hidden"
    >
      <PresentationBackdrop variant="drawTable" />
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

      <PresentationBackdrop variant="pair" />
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
          <img src={FX.cards.back} alt="カード裏面" className="h-full w-full object-contain drop-shadow-[0_0_35px_rgba(251,191,36,0.45)]" />
          <img src={FX.cards.impactMark} alt="" className="draw-impact-mark invisible pointer-events-none absolute left-1/2 top-1/2 z-20 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-80" />
          <img src={FX.darts.main} alt="" className="draw-dart invisible pointer-events-none absolute left-1/2 top-1/2 z-30 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain" />
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
      <img src={FX.effects.impactFlash} alt="" className="draw-impact-flash invisible pointer-events-none absolute left-1/2 top-1/2 z-50 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-screen" />
      <img src={FX.effects.blueRing} alt="" className="draw-impact-ring invisible pointer-events-none absolute left-1/2 top-1/2 z-50 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-screen [filter:hue-rotate(185deg)_saturate(1.3)]" />

    </div>
  );
}

function ParticipantFace({ participant, className }: { participant: DrawRevealParticipant; className: string }) {
  if (!participant.faceUrl) {
    return <div className={`${className} flex items-center justify-center bg-slate-800 text-4xl text-slate-400`}>?</div>;
  }
  return <img src={participant.faceUrl} alt={participant.displayName} className={`${className} object-cover`} />;
}

type DrawRevealParticipant = DrawPresentationData['participants'][number];
