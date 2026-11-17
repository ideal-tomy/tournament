import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame, { cardSlots, people, type CeremonyTeam } from './CeremonyFrame';
import { useCeremonyIntro, type CeremonyIntroOptions } from './useCeremonyIntro';
import RatedName from './RatedName';
import VenueTeamNameplate, { PAIR_PLATE_WIDTH } from './VenueTeamNameplate';

const INTRO_END = 3;
const STAGE = 1920;
const BEAM_X = 962;

function clusterCenters(counts: number[], card: number, innerGap: number, teamGap: number) {
  const widths = counts.map((count) => count * card + Math.max(0, count - 1) * innerGap);
  const total = widths.reduce((sum, width) => sum + width, 0) + teamGap * Math.max(0, widths.length - 1);
  let x = (STAGE - total) / 2;
  return widths.map((width) => {
    const center = x + width / 2;
    x += width + teamGap;
    return center;
  });
}

function DropMark({ text }: { text: string }) {
  const arrow = text.endsWith('→') ? '→' : '';
  const label = arrow ? text.slice(0, -1) : text;
  return (
    <p className="wb-drop-mark">
      <span>{label}</span>
      {arrow ? <span className="wb-drop-arrow" aria-hidden="true">→</span> : null}
    </p>
  );
}

/** Venue WINNER: one winning team in the light. The loser stays small at the lower right. */
export default function WinnerBoard({
  team,
  groups,
  opponent,
  dropLabel = '敗退→',
  contained = false,
  title = 'WINNER',
  label,
  ...intro
}: CeremonyIntroOptions & {
  team?: CeremonyTeam;
  groups?: CeremonyTeam[];
  opponent?: CeremonyTeam;
  dropLabel?: string;
  contained?: boolean;
  title?: string;
  label?: string;
}) {
  const clusters = groups?.length ? groups : team ? [team] : [];
  const grouped = clusters.length > 1;
  const caption = label ?? `${clusters[0]?.name ?? ''} の勝利`;
  const stageRef = useRef<HTMLDivElement>(null);
  useCeremonyIntro(
    stageRef,
    INTRO_END,
    (tl, cue) => {
      tl.set('.wb-card', { autoAlpha: 0, y: 120, scale: 0.9 })
        .set('.wb-title', { autoAlpha: 0, scale: 1.6 })
        .set('.wb-venue-plate, .wb-group-plate, .cer-card-name', { autoAlpha: 0, y: 20 })
        .set('.wb-drop', { autoAlpha: 0, y: 16 })
        .fromTo('.wb-scene', { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 1.4, ease: 'power2.out' }, 0)
        .to('.wb-card', { autoAlpha: 1, y: 0, scale: 1, duration: 0.75, stagger: 0.1, ease: 'back.out(1.4)' }, 0.35)
        .fromTo('.cer-white', { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.05, yoyo: true, repeat: 1 }, 1.05)
        .to('.wb-title', { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'expo.out' }, 1.05)
        .to('.wb-venue-plate, .wb-group-plate', { autoAlpha: 1, y: 0, duration: 0.45 }, 1.4)
        .to('.cer-card-name', { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05 }, 1.5)
        .to('.wb-drop', { autoAlpha: 1, y: 0, duration: 0.4 }, 1.6);
      cue('pairImpact', 1.05);
    },
    intro,
  );

  const card = grouped ? 220 : clusters[0] && people(clusters[0]).length >= 3 ? 260 : 320;
  const innerGap = grouped ? 20 : card === 260 ? 28 : 84;
  const centers = grouped ? clusterCenters(clusters.map((item) => people(item).length), card, innerGap, 160) : [BEAM_X];
  const loserPeople = opponent ? people(opponent).slice(0, 2) : [];

  return (
    <CeremonyFrame stageRef={stageRef} contained={contained} className="wb-board" label={caption}>
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
        const groupWidth = card * members.length + innerGap * Math.max(0, members.length - 1) + 24;
        return (
          <div key={`${item.name}-${group}`}>
            {members.map((person, index) => (
              <article key={`${person.name}-${index}`} className="cer-card wb-card" style={{ left: slots[index], top: 276, width: card, height }}>
                {person.face ? <img src={person.face} alt={person.name} /> : <div className="cer-empty">?</div>}
                <p className="cer-card-name"><RatedName text={person.name} /></p>
              </article>
            ))}
            {grouped && (
              <VenueTeamNameplate
                name={item.name}
                width={Math.min(PAIR_PLATE_WIDTH, groupWidth)}
                className="wb-group-plate"
                style={{ left: (slots[0] ?? 0) - 12, top: 276 + height + 18 }}
              />
            )}
          </div>
        );
      })}
      {!grouped && clusters[0] && (
        <VenueTeamNameplate name={clusters[0].name} width={PAIR_PLATE_WIDTH} className="wb-venue-plate" />
      )}
      {opponent && (
        <aside className="wb-drop">
          <DropMark text={dropLabel} />
          <div className="wb-drop-faces">
            {loserPeople.map((person, index) =>
              person.face ? <img key={`${person.name}-${index}`} src={person.face} alt={person.name} /> : <div key={`${person.name}-${index}`} className="cer-empty">?</div>,
            )}
          </div>
          <p className="wb-drop-name">{opponent.name}</p>
        </aside>
      )}
      <div className="cer-white" />
    </CeremonyFrame>
  );
}
