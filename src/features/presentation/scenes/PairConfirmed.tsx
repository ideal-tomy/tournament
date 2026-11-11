import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import type { DrawRevealParticipant } from '../../draw/presentationTypes';
import CeremonyFrame, { cardSlots } from '../ceremony/CeremonyFrame';
import RatedName from '../ceremony/RatedName';

interface PairConfirmedProps {
  teamNumber: number;
  members: DrawRevealParticipant[];
  teamLabel?: string | null;
}

const RING_CENTER_Y = 506;

/** Pair reveal over the gold rings. Motion is added by appendPairCelebration on the draw timeline. */
export default function PairConfirmed({ teamNumber, members, teamLabel }: PairConfirmedProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const isPair = members.length === 2;
  const width = members.length >= 3 ? 240 : 300;
  const height = width * 1.5;
  const slots = cardSlots(members.length, width, members.length >= 3 ? 24 : 36);

  return (
    <section className="draw-pair-stage invisible pointer-events-none absolute inset-0 z-40">
      <CeremonyFrame contained stageRef={stageRef} className="pc-board" label={`TEAM ${teamNumber} 確定`}>
        <div className="pc-rings">
          <div className="pc-drift">
            <div className="cer-img" style={{ backgroundImage: `url(${FX.backgrounds.pairRings})` }} />
            <div className="pc-spin" style={{ backgroundImage: `url(${FX.backgrounds.pairRings})` }} />
          </div>
        </div>
        <div className="cer-vignette" />
        <div className="pc-flare" />
        <p className="cer-text pc-team-no">TEAM {String(teamNumber).padStart(2, '0')}</p>
        <h2 className="cer-text cer-gold pc-title">{isPair ? 'PAIR CONFIRMED' : 'TEAM CONFIRMED'}</h2>
        {teamLabel && <p className="cer-text pc-venue-name team-name-blue">{teamLabel}</p>}
        {members.map((member, index) => (
          <article
            key={member.id}
            className="cer-card pc-card"
            style={{ left: slots[index], top: RING_CENTER_Y - height / 2, width, height }}
          >
            {member.faceUrl ? <img src={member.faceUrl} alt={member.displayName} /> : <div className="cer-empty">?</div>}
            <p className="cer-card-name"><RatedName text={member.displayName} /></p>
          </article>
        ))}
        <p className="cer-text pc-next">NEXT DRAW COMING UP</p>
      </CeremonyFrame>
    </section>
  );
}
