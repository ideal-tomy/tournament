import { useEffect, useState } from 'react';
import { subscribePresentationBed, unlockPresentationBed, type BedTrack } from './presentationBed';

export default function PresentationBedUnlock({ track }: { track?: BedTrack }) {
  const [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => subscribePresentationBed(setNeedsGesture), []);
  if (!needsGesture) return null;
  return (
    <button type="button" className="bed-unlock" onClick={() => unlockPresentationBed()}>
      {track === 'ending' ? 'タップすると、音楽が流れます' : 'タップすると、ペア発表まで音楽が流れます'}
    </button>
  );
}
