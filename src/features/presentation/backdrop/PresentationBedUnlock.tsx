import { useEffect, useState } from 'react';
import { subscribePresentationBed, unlockPresentationBed } from './presentationBed';

export default function PresentationBedUnlock() {
  const [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => subscribePresentationBed(setNeedsGesture), []);
  if (!needsGesture) return null;
  return (
    <button type="button" className="bed-unlock" onClick={() => unlockPresentationBed()}>
      タップすると、音楽が流れます
    </button>
  );
}
