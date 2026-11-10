import { useRef } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import CeremonyFrame from './CeremonyFrame';

/** Venue screen after the tournament is closed. The waiting track keeps looping here. */
export default function ThanksBoard() {
  const stageRef = useRef<HTMLDivElement>(null);
  return <CeremonyFrame stageRef={stageRef} className="th-board" label="本日は、ご参加ありがとうございました">
    <div className="cer-img th-bg" style={{ backgroundImage: `url(${FX.backgrounds.winnerShaft})` }} />
    <div className="cer-vignette" />
    <h2 className="cer-text cer-gold th-title">本日は、<br />ご参加ありがとうございました</h2>
  </CeremonyFrame>;
}
