import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';

const DESCEND = 10;
const AFTER = 5;
const CLEAR = 3;
const INTRO_END = DESCEND + AFTER + CLEAR;

function tremor(t: number) {
  let amp = 1;
  if (t >= DESCEND && t < DESCEND + AFTER) {
    const p = (t - DESCEND) / AFTER;
    amp = 1.55 * (1 - p) + 0.4 * p;
  } else if (t >= DESCEND + AFTER) {
    amp = 0;
  }
  return {
    x: (Math.sin(t * 68) * 7 + Math.sin(t * 109) * 3) * amp,
    y: (Math.cos(t * 79) * 3.6 + Math.sin(t * 97) * 1.8) * amp,
    rotation: Math.sin(t * 88) * 0.18 * amp,
  };
}

function glowScale(t: number) {
  if (t < DESCEND) return 28 + Math.sin(t * 1.5) * 8;
  if (t < DESCEND + AFTER) return 52 + Math.sin(t * 2.4) * 8;
  const p = Math.min(1, (t - DESCEND - AFTER) / CLEAR);
  return (1 - p) * 36;
}
const PODIUM_CENTERS = [702, 1206];
const CARD = { width: 420, height: 600, top: 176 };
const NAME_WIDTH = 500;

function cardCenters(count: number) {
  if (count === 2) return PODIUM_CENTERS;
  return cardSlots(count, CARD.width, 40).map(left => left + CARD.width / 2);
}

/** Venue CHAMPION: a fine tremor while the champions descend, then aftershock, whiteout, and a slow clear. */
export default function ChampionBoard({ team, ...intro }: CeremonyIntroOptions & { team: CeremonyTeam }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const noise = useRef<SVGFETurbulenceElement>(null);
  const shift = useRef<SVGFEDisplacementMapElement>(null);
  useEffect(() => {
    const node = noise.current;
    if (!node || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const x = 0.006 + Math.sin(t * 1.45) * 0.0032;
      const y = 0.009 + Math.cos(t * 1.05) * 0.0038;
      node.setAttribute('baseFrequency', `${x.toFixed(4)} ${y.toFixed(4)}`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useCeremonyIntro(stageRef, INTRO_END, (tl, cue) => {
    const reveal = DESCEND + AFTER;
    tl.set('.cb-cast', { y: -1100, autoAlpha: 0.14 })
      .set('.cb-aura, .cb-flare, .cb-white, .cb-ball', { autoAlpha: 0 })
      .set('.cb-scene', { autoAlpha: 1 })
      .to('.cb-quake', {
        duration: INTRO_END,
        ease: 'none',
        onUpdate() {
          const t = this.progress() * INTRO_END;
          gsap.set('.cb-quake', tremor(t));
          shift.current?.setAttribute('scale', glowScale(t).toFixed(1));
        },
      }, 0)
      .to('.cb-cast', { y: 0, duration: DESCEND, ease: 'sine.inOut' }, 0)
      .to('.cb-cast', { autoAlpha: 0.62, duration: DESCEND, ease: 'power1.in' }, 0)
      .fromTo('.cb-aura', { autoAlpha: 0, scale: 0.82 }, { autoAlpha: 1, scale: 1.18, duration: 2.2, ease: 'power1.in' }, DESCEND)
      .to('.cb-flare', { autoAlpha: 1, duration: 1.6, ease: 'power1.in' }, DESCEND)
      .to('.cb-white', { autoAlpha: 1, duration: 2.2, ease: 'power1.in' }, DESCEND)
      .to('.cb-white', { autoAlpha: 0, duration: CLEAR, ease: 'sine.inOut' }, reveal)
      .to('.cb-aura, .cb-flare, .cb-haze', { autoAlpha: 0, duration: CLEAR, ease: 'sine.inOut' }, reveal)
      .to('.cb-ball', { autoAlpha: 1, duration: CLEAR, ease: 'sine.inOut' }, reveal)
      .to('.cb-cast', { autoAlpha: 1, duration: CLEAR, ease: 'sine.inOut' }, reveal);
    cue('impact', DESCEND);
    cue('teamConfirm', reveal);
  }, intro);

  const members = people(team);
  const centers = cardCenters(members.length);
  const background = { backgroundImage: `url(${FX.backgrounds.championCorona})` };
  return <CeremonyFrame stageRef={stageRef} className="cb-board" label={`${team.name} 優勝`}>
    <svg className="cb-filter" aria-hidden="true">
      <filter id="cb-writhe" x="-18%" y="-18%" width="136%" height="136%">
        <feTurbulence ref={noise} type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="6" result="noise" />
        <feDisplacementMap ref={shift} in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div className="cb-quake">
      <div className="cer-layer cb-scene">
        <div className="cb-drift">
          <div className="cb-plate" style={background} />
          <div className="cb-plate cb-haze" style={background} />
          <div className="cb-corona" style={background} />
        </div>
      </div>
      <div className="cer-vignette" />
      <div className="cb-cast">
        <h2 className="cer-text cer-gold cb-title">CHAMPION</h2>
        {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card cb-card" style={{ left: centers[index] - CARD.width / 2, top: CARD.top, width: CARD.width, height: CARD.height }}>
          {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
        </article>)}
        {members.map((person, index) => <p key={`name-${index}`} className="cb-name" style={{ left: centers[index] - NAME_WIDTH / 2, width: NAME_WIDTH }}><RatedName text={person.name} /></p>)}
        <p className="cer-text cb-team">{team.name}</p>
      </div>
      <div className="cb-ball" aria-hidden="true">
        <div className="cb-beams" />
        <div className="cb-beams cb-beams-wide" />
      </div>
      <div className="cb-aura" />
      <div className="cb-flare" />
      <div className="cer-white cb-white" />
    </div>
  </CeremonyFrame>;
}
