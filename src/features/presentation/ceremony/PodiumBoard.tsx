import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';

const FLOOR = 1040;
const COLUMN = 440;
const GAP = 18;
/** Introduced in this order: 3rd, then 2nd, then the champion. */
const PLACES = [
  { rank: 3, label: '3位', center: 1440, height: 150, card: 150 },
  { rank: 2, label: '2位', center: 480, height: 220, card: 168 },
  { rank: 1, label: '優勝', center: 960, height: 300, card: 190 },
] as const;
const APPEAR = 0.28;
const HOLD = 2;
const MOVE = 1.05;
const STEP = APPEAR + HOLD + MOVE + 0.4;

function listed(value?: CeremonyTeam | CeremonyTeam[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Scale the resting cards until they fill the stage, then hold that size. */
function closeUp(place: (typeof PLACES)[number], group: CeremonyTeam[]) {
  const teamWidth = (COLUMN - GAP * (group.length - 1)) / group.length;
  const blockTop = FLOOR - place.height;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  group.forEach((team, teamIndex) => {
    const members = people(team);
    const center = place.center - COLUMN / 2 + teamWidth / 2 + teamIndex * (teamWidth + GAP);
    const width = Math.min(place.card, (teamWidth - 8 * Math.max(0, members.length - 1)) / Math.max(1, members.length));
    const height = Math.round(width * 1.35);
    const cardTop = blockTop - 46 - height;
    for (const slot of cardSlots(members.length, width, 8, center)) {
      left = Math.min(left, slot);
      right = Math.max(right, slot + width);
      top = Math.min(top, cardTop);
      bottom = Math.max(bottom, cardTop + height + 44);
    }
  });
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const originX = (left + right) / 2;
  const originY = (top + bottom) / 2;
  return {
    x: 960 - originX,
    y: 500 - originY,
    scale: Math.min(1680 / width, 860 / height),
    origin: `${originX}px ${originY}px`,
  };
}

/** 3rd, 2nd, then the champion: each arrives large in the center, hits, then settles onto its block. */
export default function PodiumBoard({ first, second, third, ...intro }: CeremonyIntroOptions & {
  first: CeremonyTeam; second?: CeremonyTeam | CeremonyTeam[]; third?: CeremonyTeam | CeremonyTeam[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const teams: Record<1 | 2 | 3, CeremonyTeam[]> = { 1: [first], 2: listed(second), 3: listed(third) };
  const shown = PLACES.filter(place => teams[place.rank].length);
  const introEnd = 0.4 + Math.max(0, shown.length - 1) * STEP + APPEAR + HOLD + MOVE;
  useCeremonyIntro(stageRef, introEnd, (tl, cue) => {
    tl.set('.pd-block', { scaleY: 0, transformOrigin: '50% 100%' })
      .set('.pd-flight', { autoAlpha: 0 })
      .fromTo('.pd-title', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0);
    shown.forEach((place, index) => {
      const hit = 0.4 + index * STEP + APPEAR;
      const flight = `.pd-flight-${place.rank}`;
      const zoom = closeUp(place, teams[place.rank]);
      tl.set(flight, { x: zoom.x, y: zoom.y, scale: zoom.scale, autoAlpha: 0, zIndex: 4, transformOrigin: zoom.origin }, 0)
        .to(flight, { autoAlpha: 1, duration: APPEAR, ease: 'power2.out' }, hit - APPEAR)
        .fromTo('.pd-flash', { autoAlpha: 0 }, { autoAlpha: 0.82, duration: 0.05, yoyo: true, repeat: 1 }, hit)
        .to(flight, { x: 0, y: 0, scale: 1, zIndex: 1, duration: MOVE, ease: 'power2.inOut' }, hit + HOLD)
        .to(`.pd-place-${place.rank} .pd-block`, { scaleY: 1, duration: 0.55, ease: 'power3.out' }, hit + HOLD);
      cue('pairImpact', hit);
    });
  }, intro);

  return <CeremonyFrame stageRef={stageRef} className="pd-board" label="表彰台">
    <div className="cer-img pd-bg" style={{ backgroundImage: `url(${FX.backgrounds.championCorona})` }} />
    <div className="cer-vignette" />
    <div className="pd-flash" />
    <h2 className="cer-text cer-gold pd-title">PODIUM</h2>
    {shown.map(place => {
      const group = teams[place.rank];
      const teamWidth = (COLUMN - GAP * (group.length - 1)) / group.length;
      const blockTop = FLOOR - place.height;
      return <section key={place.rank} className={`pd-place pd-place-${place.rank}`} aria-label={`${place.label} ${group.map(team => team.name).join('、')}`}>
        <div className={`pd-flight pd-flight-${place.rank}`}>
          {group.map((team, teamIndex) => {
            const members = people(team);
            const center = place.center - COLUMN / 2 + teamWidth / 2 + teamIndex * (teamWidth + GAP);
            const width = Math.min(place.card, (teamWidth - 8 * Math.max(0, members.length - 1)) / members.length);
            const height = Math.round(width * 1.35);
            const cardTop = blockTop - 46 - height;
            const slots = cardSlots(members.length, width, 8, center);
            return <div key={`${team.name}-${teamIndex}`}>
              {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card pd-card" style={{ left: slots[index], top: cardTop, width, height }}>
                {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
                <p className="cer-card-name"><RatedName text={person.name} /></p>
              </article>)}
              <p className="pd-team cer-gold" style={{ left: center - teamWidth / 2, top: cardTop + height + 8, width: teamWidth }}>{team.name}</p>
            </div>;
          })}
        </div>
        <div className="pd-block" style={{ left: place.center - COLUMN / 2, top: blockTop, width: COLUMN, height: place.height }}>
          <p className="pd-rank">{place.rank}</p>
          <p className="pd-label">{place.label}</p>
        </div>
      </section>;
    })}
  </CeremonyFrame>;
}
