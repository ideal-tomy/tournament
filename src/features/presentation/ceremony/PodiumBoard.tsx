import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';
import VenueTeamNameplate from './VenueTeamNameplate';

const FLOOR = 1040;
const COLUMN = 440;
const GAP = 18;
/** Introduced in this order: 3rd, then 2nd, then the champion. */
const PLACES = [
  { rank: 3, label: '3位', center: 1440, height: 150, card: 132 },
  { rank: 2, label: '2位', center: 480, height: 220, card: 150 },
  { rank: 1, label: '優勝', center: 960, height: 360, card: 340 },
] as const;
const PLATE_RATIO = 394 / 1180;

function plateSize(rank: number, teamWidth: number) {
  const width = Math.min(rank === 1 ? 440 : 240, teamWidth);
  return { width, height: width * PLATE_RATIO };
}

function restingCard(place: (typeof PLACES)[number], teamWidth: number, memberCount: number) {
  const width = Math.min(place.card, (teamWidth - 8 * Math.max(0, memberCount - 1)) / Math.max(1, memberCount));
  const height = Math.round(width * 1.35);
  const plate = plateSize(place.rank, teamWidth);
  const blockTop = FLOOR - place.height;
  const teamTop = blockTop - plate.height - 12;
  const cardTop = Math.max(36, teamTop - 12 - height);
  return { width, height, cardTop, teamTop, plate };
}
const APPEAR = 0.28;
const HOLD_OTHER = 2;
const HOLD_CHAMPION = 3.2;
const MOVE = 1.05;

function listed(value?: CeremonyTeam | CeremonyTeam[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function holdFor(rank: number) {
  return rank === 1 ? HOLD_CHAMPION : HOLD_OTHER;
}

/** Scale the resting cards until they fill the stage, then hold that size. */
function closeUp(place: (typeof PLACES)[number], group: CeremonyTeam[]) {
  const teamWidth = (COLUMN - GAP * (group.length - 1)) / group.length;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  group.forEach((team, teamIndex) => {
    const members = people(team);
    const center = place.center - COLUMN / 2 + teamWidth / 2 + teamIndex * (teamWidth + GAP);
    const card = restingCard(place, teamWidth, members.length);
    for (const slot of cardSlots(members.length, card.width, 8, center)) {
      left = Math.min(left, slot);
      right = Math.max(right, slot + card.width);
      top = Math.min(top, card.cardTop);
      bottom = Math.max(bottom, card.teamTop + card.plate.height);
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
  let cursor = 0.4;
  const timings = shown.map((place) => {
    const appearAt = cursor;
    const hit = appearAt + APPEAR;
    const hold = holdFor(place.rank);
    const settleAt = hit + hold;
    cursor = settleAt + MOVE + 0.4;
    return { place, appearAt, hit, hold, settleAt };
  });
  const introEnd = cursor;
  useCeremonyIntro(stageRef, introEnd, (tl, cue) => {
    tl.set('.pd-block', { scaleY: 0, transformOrigin: '50% 100%' })
      .set('.pd-flight', { autoAlpha: 0 });
    timings.forEach(({ place, appearAt, hit, settleAt }) => {
      const flight = `.pd-flight-${place.rank}`;
      const zoom = closeUp(place, teams[place.rank]);
      const restScale = place.rank === 1 ? 1.08 : 1;
      tl.set(flight, { x: zoom.x, y: zoom.y, scale: zoom.scale, autoAlpha: 0, zIndex: 4, transformOrigin: zoom.origin }, 0)
        .to(flight, { autoAlpha: 1, duration: APPEAR, ease: 'power2.out' }, appearAt)
        .fromTo('.pd-flash', { autoAlpha: 0 }, { autoAlpha: 0.82, duration: 0.05, yoyo: true, repeat: 1 }, hit)
        .to(flight, { x: 0, y: 0, scale: restScale, zIndex: place.rank === 1 ? 3 : 1, duration: MOVE, ease: 'power2.inOut' }, settleAt)
        .to(`.pd-place-${place.rank} .pd-block`, { scaleY: 1, duration: 0.55, ease: 'power3.out' }, settleAt);
      cue('pairImpact', hit);
    });
  }, intro);

  return <CeremonyFrame stageRef={stageRef} className="pd-board" label="表彰台">
    <div className="cer-img pd-bg" style={{ backgroundImage: `url(${FX.backgrounds.championCorona})` }} />
    <div className="cer-vignette" />
    <div className="pd-flash" />
    {shown.map(place => {
      const group = teams[place.rank];
      const teamWidth = (COLUMN - GAP * (group.length - 1)) / group.length;
      const blockTop = FLOOR - place.height;
      return <section key={place.rank} className={`pd-place pd-place-${place.rank}`} aria-label={`${place.label} ${group.map(team => team.name).join('、')}`}>
        <div className={`pd-flight pd-flight-${place.rank}`}>
          {group.map((team, teamIndex) => {
            const members = people(team);
            const center = place.center - COLUMN / 2 + teamWidth / 2 + teamIndex * (teamWidth + GAP);
            const card = restingCard(place, teamWidth, members.length);
            const slots = cardSlots(members.length, card.width, 8, center);
            return <div key={`${team.name}-${teamIndex}`}>
              {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card pd-card" style={{ left: slots[index], top: card.cardTop, width: card.width, height: card.height }}>
                {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
                <p className="cer-card-name"><RatedName text={person.name} /></p>
              </article>)}
              <VenueTeamNameplate
                name={team.name}
                width={card.plate.width}
                className={`pd-venue-plate${place.rank === 1 ? ' pd-venue-plate-champ' : ''}`}
                style={{ left: center - card.plate.width / 2, top: card.teamTop }}
              />
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
