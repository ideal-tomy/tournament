import { useEffect, useState } from 'react';
import PlaylistPlayer from '../../player/PlaylistPlayer';

interface OpeningSceneProps {
  eventId: string;
  title: string;
  subtitle: string | null;
}

export default function OpeningScene({ eventId, title, subtitle }: OpeningSceneProps) {
  const [showPlaylist, setShowPlaylist] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowPlaylist(true), 2800);
    return () => window.clearTimeout(t);
  }, [title]);

  return (
    <div className="relative flex h-full min-h-[60vh] flex-col bg-slate-950 text-white">
      {!showPlaylist ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-sm tracking-[0.4em] text-cyan-300/80">TOURNAMENT</p>
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">{title}</h1>
          {subtitle && <p className="text-xl text-slate-300">{subtitle}</p>}
        </div>
      ) : (
        <PlaylistPlayer eventId={eventId} slot="opening" className="flex-1" />
      )}
    </div>
  );
}
