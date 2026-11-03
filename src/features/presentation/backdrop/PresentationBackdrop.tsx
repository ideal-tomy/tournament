import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import './presentationBackdrop.css';

export type BackdropVariant = 'drawTable' | 'pair' | 'match' | 'champion';
type Layer = 'base' | 'scrim' | 'split' | 'spot' | 'sparks' | 'confetti' | 'streaks' | 'ring' | 'debris' | 'flash';

const LAYERS: Record<BackdropVariant, Layer[]> = {
  drawTable: ['base'],
  pair: ['scrim'],
  match: ['base', 'split', 'spot', 'sparks', 'confetti', 'streaks', 'ring', 'debris', 'flash'],
  champion: ['base', 'spot', 'sparks', 'confetti', 'ring', 'flash'],
};

/** Decorative layers only. Motion is driven by appendPresentationBackdrop from the owning stage timeline. */
export default function PresentationBackdrop({ variant }: { variant: BackdropVariant }) {
  return <div className={`pbd pbd-${variant}`} aria-hidden="true">
    {LAYERS[variant].map(layer => <div key={layer} className={`pbd-layer pbd-${layer}`}><LayerContent layer={layer} variant={variant} /></div>)}
  </div>;
}

function LayerContent({ layer, variant }: { layer: Layer; variant: BackdropVariant }) {
  switch (layer) {
    case 'base': return <div className="pbd-base-img" style={{ backgroundImage: `url(${variant === 'drawTable' ? FX.backgrounds.drawTable : FX.backgrounds.tournament})` }} />;
    case 'scrim': return <div className="pbd-scrim-fill" />;
    case 'split': return <><i className="pbd-split-a" /><i className="pbd-split-b" /></>;
    case 'spot': return <div className="pbd-spot-fill" />;
    case 'sparks': return <><img className="pbd-sparks-a" src={FX.effects.goldenSparks} alt="" /><img className="pbd-sparks-b" src={FX.effects.goldenSparks} alt="" /></>;
    case 'confetti': return <img className="pbd-confetti-img" src={FX.effects.celebrationConfetti} alt="" />;
    case 'streaks': return <><img className="pbd-streak-a" src={FX.darts.motionStreak} alt="" /><img className="pbd-streak-b" src={FX.darts.motionStreak} alt="" /></>;
    case 'ring': return <img className="pbd-ring-img" src={FX.effects.blueRing} alt="" />;
    case 'debris': return <><img className="pbd-cloud-img" src={FX.effects.impactCloud} alt="" /><img className="pbd-debris-img" src={FX.effects.debris} alt="" /></>;
    case 'flash': return <img className="pbd-flash-img" src={FX.effects.impactFlash} alt="" />;
  }
}
