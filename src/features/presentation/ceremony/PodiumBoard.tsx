import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';

const INTRO_END = 5;
const FLOOR = 1040;
const COLUMN = 440;
const GAP = 12;
const NAMES = 84;
/** Introduced in this order: 3rd, then 2nd, then the champion's column rises last. */
const PLACES = [
  { rank: 3, label: '3位', center: 1440, height: 150, card: 180, at: 0.4 },
  { rank: 2, label: '2位', center: 480, height: 220, card: 200, at: 1.8 },
  { rank: 1, label: '優勝', center: 960, height: 300, card: 230, at: 3.2 },
] as const;

/** Venue podium after the champion: 3rd, 2nd and 1st are introduced in turn. A place without a team is left out. */
export default function PodiumBoard({ first, second, third, ...intro }: CeremonyIntroOptions & {
  first: CeremonyTeam; second?: CeremonyTeam; third?: CeremonyTeam;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const teams: Record<1 | 2 | 3, CeremonyTeam | undefined> = { 1: first, 2: second, 3: third };
  const shown = PLACES.filter(place => teams[place.rank]);
  useCeremonyIntro(stageRef, INTRO_END, (tl, cue) => {
    tl.set('.pd-block', { scaleY: 0, transformOrigin: '50% 100%' })
      .set('.pd-cast', { autoAlpha: 0, y: 60 })
      .fromTo('.pd-title', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0);
    for (const place of shown) {
      tl.to(`.pd-place-${place.rank} .pd-block`, { scaleY: 1, duration: 0.6, ease: 'power3.out' }, place.at)
        .to(`.pd-place-${place.rank} .pd-cast`, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' }, place.at + 0.35);
      cue(place.rank === 1 ? 'impact' : 'teamConfirm', place.at + 0.35);
    }
  }, intro);

  return <CeremonyFrame stageRef={stageRef} className="pd-board" label="表彰台">
    <div className="cer-img pd-bg" style={{ backgroundImage: `url(${FX.backgrounds.championCorona})` }} />
    <div className="cer-vignette" />
    <h2 className="cer-text cer-gold pd-title">PODIUM</h2>
    {shown.map(place => {
      const team = teams[place.rank]!, members = people(team);
      const width = Math.min(place.card, (COLUMN - GAP * (members.length - 1)) / members.length);
      const height = Math.round(width * 1.4);
      const blockTop = FLOOR - place.height, namesTop = blockTop - NAMES, cardTop = namesTop - 12 - height;
      const slots = cardSlots(members.length, width, GAP, place.center);
      return <section key={place.rank} className={`pd-place pd-place-${place.rank}`} aria-label={`${place.label} ${team.name}`}>
        <div className="pd-cast">
          {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card pd-card" style={{ left: slots[index], top: cardTop, width, height }}>
            {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
          </article>)}
          {members.map((person, index) => <p key={`name-${index}`} className="pd-name" style={{ left: slots[index] - GAP / 2, top: namesTop, width: width + GAP }}><RatedName text={person.name} /></p>)}
        </div>
        <div className="pd-block" style={{ left: place.center - COLUMN / 2, top: blockTop, width: COLUMN, height: place.height }}>
          <p className="pd-rank">{place.rank}</p>
          <p className="pd-label">{place.label}</p>
        </div>
      </section>;
    })}
  </CeremonyFrame>;
}
