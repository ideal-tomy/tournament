import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';

const INTRO_END = 3;
const STAGE = 1920;
const BEAM_X = 962;

function clusterCenters(counts: number[], card: number, innerGap: number, teamGap: number) {
  const widths = counts.map(count => count * card + Math.max(0, count - 1) * innerGap);
  const total = widths.reduce((sum, width) => sum + width, 0) + teamGap * Math.max(0, widths.length - 1);
  let x = (STAGE - total) / 2;
  return widths.map(width => {
    const center = x + width / 2;
    x += width + teamGap;
    return center;
  });
}

/** Venue WINNER: the winners rise into the light shaft; the opponent fades out at the edge. */
export default function WinnerBoard({ team, groups, opponent, contained = false, title = 'WINNER', label, ...intro }: CeremonyIntroOptions & {
  team?: CeremonyTeam; groups?: CeremonyTeam[]; opponent?: CeremonyTeam; contained?: boolean; title?: string; label?: string;
}) {
  const clusters = groups?.length ? groups : team ? [team] : [];
  const grouped = clusters.length > 1;
  const caption = label ?? `${clusters[0]?.name ?? ''} の勝利`;
  const stageRef = useRef<HTMLDivElement>(null);
  useCeremonyIntro(stageRef, INTRO_END, (tl, cue) => {
    tl.set('.wb-card', { autoAlpha: 0, y: 120, scale: 0.9 })
      .set('.wb-title', { autoAlpha: 0, scale: 1.6 })
      .set('.wb-team, .wb-group-name, .cer-card-name', { autoAlpha: 0, y: 20 })
      .fromTo('.wb-scene', { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, 0)
      .fromTo('.wb-loser', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.1)
      .to('.wb-card', { autoAlpha: 1, y: 0, scale: 1, duration: 0.75, stagger: 0.1, ease: 'back.out(1.4)' }, 0.35)
      .fromTo('.cer-white', { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.05, yoyo: true, repeat: 1 }, 1.05)
      .to('.wb-title', { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'expo.out' }, 1.05)
      .to('.wb-team, .wb-group-name', { autoAlpha: 1, y: 0, duration: 0.45 }, 1.4)
      .to('.cer-card-name', { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05 }, 1.5)
      .to('.wb-loser', { autoAlpha: 0, duration: 0.8 }, 2.2);
    cue('pairImpact', 1.05);
  }, intro);

  const card = grouped ? 220 : clusters[0] && people(clusters[0]).length >= 3 ? 260 : 320;
  const innerGap = grouped ? 20 : card === 260 ? 28 : 84;
  const centers = grouped ? clusterCenters(clusters.map(item => people(item).length), card, innerGap, 160) : [BEAM_X];
  return <CeremonyFrame stageRef={stageRef} contained={contained} className="wb-board" label={caption}>
    <div className="cer-layer wb-scene">
      <div className="wb-drift">
        <div className="cer-img" style={{ backgroundImage: `url(${FX.backgrounds.winnerShaft})` }} />
        <div className="wb-glow" />
        <div className="wb-dust" />
      </div>
    </div>
    <div className="cer-vignette" />
    <h2 className="cer-text cer-gold wb-title">{title}</h2>
    {clusters.map((item, group) => {
      const members = people(item);
      const slots = cardSlots(members.length, card, innerGap, centers[group] ?? BEAM_X);
      const height = card * 1.5;
      return <div key={`${item.name}-${group}`}>
        {members.map((person, index) => <article key={`${person.name}-${index}`} className="cer-card wb-card" style={{ left: slots[index], top: 276, width: card, height }}>
          {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
          <p className="cer-card-name"><RatedName text={person.name} /></p>
        </article>)}
        {grouped && <p className="wb-group-name cer-gold" style={{ left: (slots[0] ?? 0) - 12, width: card * members.length + innerGap * Math.max(0, members.length - 1) + 24, top: 276 + height + 18 }}>{item.name}</p>}
      </div>;
    })}
    {!grouped && clusters[0] && <p className="cer-text wb-team cer-gold">{clusters[0].name}</p>}
    {opponent && <p className="wb-loser">vs {opponent.name}</p>}
    <div className="cer-white" />
  </CeremonyFrame>;
}
