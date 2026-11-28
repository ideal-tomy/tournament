import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { cueCatchUpOffset, playPresentationAudio, syncedCueAt, type PresentationCue } from '../backdrop/playPresentationAudio';
import RatedName from '../ceremony/RatedName';
import './vsBoard.css';

export interface VsSide {
  name: string;
  members: string[];
  faces: string[];
}

export type VsCallout = 'semifinal' | 'losers-semifinal' | 'final' | 'final-again';

const INTRO_END = 2;
const LEFT_X = [120, 440];
const RIGHT_X = [1180, 1500];

const CALLOUT_MAIN: Record<VsCallout, string> = {
  semifinal: 'セミファイナル',
  'losers-semifinal': 'セミファイナル',
  final: 'ファイナル',
  'final-again': 'ファイナル',
};

/** Venue VS card. Pixel positions are a 1920×1080 stage, scaled to the monitor. */
export default function VsBoard({
  left,
  right,
  roundLabel,
  callout = null,
  settled = false,
  startAt = 0,
  audioEnabled = false,
  contained = false,
}: {
  left: VsSide;
  right: VsSide;
  roundLabel?: string;
  callout?: VsCallout | null;
  settled?: boolean;
  startAt?: number;
  audioEnabled?: boolean;
  contained?: boolean;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const introRef = useRef({ startAt, settled, audioEnabled, callout });
  introRef.current = { startAt, settled, audioEnabled, callout };

  useLayoutEffect(() => {
    const fit = fitRef.current;
    const stage = stageRef.current;
    if (!fit || !stage) return;
    const apply = () => {
      const scale = Math.min(fit.clientWidth / 1920, fit.clientHeight / 1080);
      stage.style.transform = `translate(-50%, -50%) scale(${scale || 1})`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(fit);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { startAt, settled, audioEnabled, callout } = introRef.current;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const again = callout === 'final-again';
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      let restoring = false;
      const cue = (name: PresentationCue, at: number) => {
        tl.call(() => { if (!restoring) playPresentationAudio(name, audioEnabled); }, [], syncedCueAt(at, name));
      };
      tl.set('.vsb-card-left', { x: -520 })
        .set('.vsb-card-right', { x: 520 })
        .set('.vsb-name', { autoAlpha: 0 })
        .set('.vsb-logo', { autoAlpha: 0, scale: 0.35 })
        .set('.vsb-spot, .vsb-streak, .vsb-flash, .vsb-callout-block, .vsb-callout-main, .vsb-callout-again, .vsb-callout-side', { autoAlpha: 0 })
        .fromTo('.vsb-spot-l', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0)
        .fromTo('.vsb-spot-r', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.08)
        .fromTo('.vsb-streak-l', { autoAlpha: 0, x: -240 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power4.in' }, 0.5)
        .fromTo('.vsb-streak-r', { autoAlpha: 0, x: 240 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power4.in' }, 0.5)
        .to('.vsb-streak', { autoAlpha: 0, duration: 0.25 }, 1.15)
        .to('.vsb-card-left', { x: 0, duration: 0.62, stagger: 0.08, ease: 'back.out(1.4)' }, 0.5)
        .to('.vsb-card-right', { x: 0, duration: 0.62, stagger: 0.08, ease: 'back.out(1.4)' }, 0.5)
        .fromTo('.vsb-white', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05, yoyo: true, repeat: 1 }, 1.2)
        .fromTo('.vsb-flash', { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1.15, duration: 0.12, ease: 'expo.out' }, 1.2)
        .to('.vsb-flash', { autoAlpha: 0, scale: 1.6, duration: 0.45 }, 1.32)
        .fromTo('.vsb-shake', { x: 0 }, { x: 14, duration: 0.04, yoyo: true, repeat: 7, ease: 'none' }, 1.22)
        .fromTo('.vsb-logo', { autoAlpha: 0, scale: 0.35 }, { autoAlpha: 1, scale: 1, duration: 0.28, ease: 'back.out(2.2)' }, 1.25)
        .to('.vsb-name', { autoAlpha: 1, duration: 0.35, stagger: 0.04 }, 1.35)
        .call(() => stage.classList.add('vsb-hold'), [], INTRO_END)
        .to({}, { duration: INTRO_END }, 0);
      if (callout) {
        tl.to('.vsb-callout-block', { autoAlpha: 1, duration: 0.2 }, 0.12);
        if (callout === 'losers-semifinal') {
          tl.fromTo('.vsb-callout-side', { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.12);
        }
        if (again) {
          if (reduced) {
            tl.set('.vsb-callout-main, .vsb-callout-again', { autoAlpha: 1, x: 0, scale: 1 }, 0.15);
          } else {
            tl.fromTo('.vsb-callout-main', { autoAlpha: 0, scale: 1.28 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out' }, 0.15);
            cue('finalBattle', 0.32);
            tl.fromTo(
              '.vsb-callout-again',
              { autoAlpha: 0, x: 360, scale: 1.2 },
              { autoAlpha: 1, x: 0, scale: 1, duration: 0.38, ease: 'power4.out' },
              0.72,
            );
            cue('finalBattleAgain', 1.15);
            tl.fromTo('.vsb-flash', { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 0.85, scale: 1.05, duration: 0.1, ease: 'expo.out' }, 0.88)
              .to('.vsb-flash', { autoAlpha: 0, scale: 1.45, duration: 0.35 }, 0.98);
          }
        } else {
          tl.fromTo('.vsb-callout-main', { autoAlpha: 0, scale: 1.28 }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'expo.out' }, 0.15);
          cue(callout === 'final' ? 'finalBattle' : 'semifinal', 0.35);
        }
      }
      cue('fight', 1.2);
      cue('pairImpact', 1.2);
      const at = reduced || settled ? INTRO_END : audioEnabled ? 0 : Math.min(INTRO_END, Math.max(0, startAt));
      if (at > 0.02) {
        restoring = true;
        tl.seek(at, false);
        restoring = false;
        const offset = !settled && !reduced && audioEnabled ? cueCatchUpOffset(1.2, at, 'pairImpact') : null;
        if (offset != null) playPresentationAudio('pairImpact', true, offset);
      }
      if (!reduced && !settled && at < INTRO_END) tl.play();
    }, stage);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={fitRef} className={`vsb-fit${contained ? ' is-contained' : ''}`}>
      <div ref={stageRef} className="vsb-stage" aria-label={`${left.name} 対 ${right.name}`}>
        <div className="vsb-hole" aria-hidden="true">
          <img src={FX.backgrounds.vsBlackHole} alt="" />
        </div>
        <div className={`vsb-shake${callout ? ' has-callout' : ''}${callout === 'final-again' ? ' has-again' : ''}`}>
          <div className="vsb-spot vsb-spot-l" />
          <div className="vsb-spot vsb-spot-r" />
          <div className="vsb-streak vsb-streak-l"><img src={FX.darts.motionStreak} alt="" /></div>
          <div className="vsb-streak vsb-streak-r"><img src={FX.darts.motionStreak} alt="" /></div>
          <div className="vsb-mask" />
          {callout && (
            <div className={`vsb-callout-block${callout === 'final-again' ? ' is-again' : ''}`}>
              {callout === 'losers-semifinal' && <p className="vsb-callout-side">ルーザーズ</p>}
              <p className="vsb-callout-main">{CALLOUT_MAIN[callout]}</p>
              {callout === 'final-again' && <p className="vsb-callout-again">アゲイン</p>}
            </div>
          )}
          {roundLabel && <p className="vsb-round">{roundLabel}</p>}
          <FitLine text={left.name} className="vsb-team vsb-team-l" maxSize={52} />
          <FitLine text={right.name} className="vsb-team vsb-team-r" maxSize={52} />
          <Side side="left" team={left} xs={LEFT_X} />
          <Side side="right" team={right} xs={RIGHT_X} />
          <img className="vsb-logo" src={FX.effects.vsMark} alt="VS" />
          <img className="vsb-flash" src={FX.effects.impactFlash} alt="" />
          <div className="vsb-white" />
        </div>
      </div>
    </div>
  );
}

function FitLine({ text, className, maxSize }: { text: string; className: string; maxSize: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = maxSize;
    el.style.fontSize = `${size}px`;
    const room = el.clientWidth;
    if (room <= 0) return;
    while (el.scrollWidth > room + 1 && size > 18) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [text, maxSize]);
  return <p ref={ref} className={className}>{text}</p>;
}

function Side({ side, team, xs }: { side: 'left' | 'right'; team: VsSide; xs: number[] }) {
  const people = team.members.slice(0, 2).map((name, index) => ({ name, face: team.faces[index] ?? '' }));
  const slots = people.length <= 1 ? [xs[1]] : xs.slice(0, people.length);
  return (
    <>
      {people.map((person, index) => (
        <article key={`${side}-${person.name}-${index}`} className={`vsb-card vsb-card-${side}`} style={{ left: slots[index] }}>
          {person.face ? <img src={person.face} alt={person.name} /> : <div className="vsb-empty">?</div>}
          <p className="vsb-name"><RatedName text={person.name} /></p>
        </article>
      ))}
    </>
  );
}
