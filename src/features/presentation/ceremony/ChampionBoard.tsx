import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';

const INTRO_END = 2.4;
const PODIUM_CENTERS = [702, 1206];
const CARD = { width: 300, height: 450, top: 300 };

function cardCenters(count: number) {
  if (count === 2) return PODIUM_CENTERS;
  return cardSlots(count, CARD.width, 40).map(left => left + CARD.width / 2);
}

/** Venue CHAMPION: the champions rise onto the podiums under the gold corona and hold. */
export default function ChampionBoard({ team, ...intro }: CeremonyIntroOptions & { team: CeremonyTeam }) {
  const stageRef = useRef<HTMLDivElement>(null);
  useCeremonyIntro(stageRef, INTRO_END, (tl, cue) => {
    tl.set('.cb-card', { autoAlpha: 0, y: 160 })
      .set('.cb-title', { autoAlpha: 0, scale: 1.5 })
      .set('.cb-name, .cb-team', { autoAlpha: 0, y: 16 })
      .fromTo('.cb-scene', { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 1.8, ease: 'power2.out' }, 0)
      .fromTo('.cb-flare', { autoAlpha: 0, scaleX: 0.3 }, { autoAlpha: 1, scaleX: 1, duration: 0.5, ease: 'expo.out' }, 0.5)
      .to('.cb-flare', { autoAlpha: 0, duration: 1.2 }, 1)
      .to('.cb-card', { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.3)
      .fromTo('.cer-white', { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.05, yoyo: true, repeat: 1 }, 0.95)
      .to('.cb-title', { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out' }, 0.95)
      .to('.cb-name', { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06 }, 1.35)
      .to('.cb-team', { autoAlpha: 1, y: 0, duration: 0.45 }, 1.5);
    cue('teamConfirm', 0.05);
    cue('impact', 0.95);
  }, intro);

  const members = people(team);
  const centers = cardCenters(members.length);
  const background = { backgroundImage: `url(${FX.backgrounds.championCorona})` };
  return <CeremonyFrame stageRef={stageRef} className="cb-board" label={`${team.name} 優勝`}>
    <div className="cer-layer cb-scene">
      <div className="cb-drift">
        <div className="cer-img" style={background} />
        <div className="cb-corona" style={background} />
        <div className="cb-corona cb-shimmer" style={background} />
      </div>
    </div>
    <div className="cer-vignette" />
    <div className="cb-flare" />
    <h2 className="cer-text cer-gold cb-title">CHAMPION</h2>
    {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card cb-card" style={{ left: centers[index] - CARD.width / 2, top: CARD.top, width: CARD.width, height: CARD.height }}>
      {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
    </article>)}
    {members.map((person, index) => <p key={`name-${index}`} className="cb-name" style={{ left: centers[index] - 210 }}>{person.name}</p>)}
    <p className="cer-text cb-team">{team.name}</p>
    <div className="cer-white" />
  </CeremonyFrame>;
}
