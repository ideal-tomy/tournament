import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { playPresentationAudio } from '../backdrop/playPresentationAudio';
import './vsBoard.css';

export interface VsSide {
  name: string;
  members: string[];
  faces: string[];
}

const INTRO_END = 2;
const LEFT_X = [120, 440];
const RIGHT_X = [1180, 1500];

/** Venue VS card. Pixel positions are a 1920×1080 stage, scaled to the monitor. */
export default function VsBoard({ left, right, roundLabel, settled = false, startAt = 0, audioEnabled = false }: {
  left: VsSide; right: VsSide; roundLabel?: string; settled?: boolean; startAt?: number; audioEnabled?: boolean;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const introRef = useRef({ startAt, settled, audioEnabled });
  introRef.current = { startAt, settled, audioEnabled };

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
    const { startAt, settled, audioEnabled } = introRef.current;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      let restoring = false;
      const cue = (name: 'dartFly' | 'impact' | 'cardFlip', at: number) => {
        tl.call(() => { if (!restoring) playPresentationAudio(name, audioEnabled); }, [], at);
      };
      tl.set('.vsb-card-left', { x: -520 })
        .set('.vsb-card-right', { x: 520 })
        .set('.vsb-name', { autoAlpha: 0 })
        .set('.vsb-logo', { autoAlpha: 0, scale: 0.35 })
        .set('.vsb-spot, .vsb-streak, .vsb-flash', { autoAlpha: 0 })
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
      cue('dartFly', 0.5);
      cue('impact', 1.2);
      cue('cardFlip', 1.28);
      const at = reduced || settled ? INTRO_END : Math.min(INTRO_END, Math.max(0, startAt));
      if (at > 0.02) {
        restoring = true;
        tl.seek(at, false);
        restoring = false;
      }
      if (!reduced && !settled && at < INTRO_END) tl.play();
    }, stage);
    return () => ctx.revert();
    // One intro per mount. A later poll creates new player objects and must not replay the collision.
  }, []);

  return <div ref={fitRef} className="vsb-fit">
    <div ref={stageRef} className="vsb-stage" aria-label={`${left.name} 対 ${right.name}`}>
     <div className="vsb-hole" aria-hidden="true">
      <img src={FX.backgrounds.vsBlackHole} alt="" />
     </div>
     <div className="vsb-shake">
      <div className="vsb-spot vsb-spot-l" />
      <div className="vsb-spot vsb-spot-r" />
      <div className="vsb-streak vsb-streak-l"><img src={FX.darts.motionStreak} alt="" /></div>
      <div className="vsb-streak vsb-streak-r"><img src={FX.darts.motionStreak} alt="" /></div>
      <div className="vsb-mask" />
      {roundLabel && <p className="vsb-round">{roundLabel}</p>}
      <p className="vsb-team vsb-team-l">{left.name}</p>
      <p className="vsb-team vsb-team-r">{right.name}</p>
      <Side side="left" team={left} xs={LEFT_X} />
      <Side side="right" team={right} xs={RIGHT_X} />
      <img className="vsb-logo" src={FX.effects.vsMark} alt="VS" />
      <img className="vsb-flash" src={FX.effects.impactFlash} alt="" />
      <div className="vsb-white" />
     </div>
    </div>
  </div>;
}

function Side({ side, team, xs }: { side: 'left' | 'right'; team: VsSide; xs: number[] }) {
  const people = team.members.slice(0, 2).map((name, index) => ({ name, face: team.faces[index] ?? '' }));
  const slots = people.length <= 1 ? [xs[1]] : xs.slice(0, people.length);
  return <>
    {people.map((person, index) => <article key={`${side}-${person.name}-${index}`} className={`vsb-card vsb-card-${side}`} style={{ left: slots[index] }}>
      {person.face ? <img src={person.face} alt={person.name} /> : <div className="vsb-empty">?</div>}
    </article>)}
    {people.map((person, index) => <p key={`${side}-name-${index}`} className="vsb-name" style={{ left: slots[index] }}>{person.name}</p>)}
  </>;
}
