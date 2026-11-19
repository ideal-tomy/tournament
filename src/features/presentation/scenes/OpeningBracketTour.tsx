import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { StageData } from '../../bracket/layout';
import BracketView from '../../bracket/BracketView';
import {
  openingTourDurationSec,
  openingCardFrames,
  openingOverviewFrame,
  openingTourPhase,
  openingTourStops,
  openingTourViewAt,
  type OpeningTourFrame,
} from '../openingTourTiming';

export interface TourTeam {
  id: string;
  name: string;
  faces: string[];
  members: string[];
}

export { openingTourDurationSec };

/** 同じトーナメント表のカメラで、初戦を左から右へ一巡して全体で止まる。 */
export default function OpeningBracketTour({
  data,
  teams: _teams,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId,
  startAt = 0,
}: {
  data: StageData;
  teams: TourTeam[];
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId: Record<string, string[]>;
  startAt?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const playing = useRef(false);
  const startRef = useRef(startAt);
  const dataRef = useRef(data);
  dataRef.current = data;
  const signature = openingTourStops(data)
    .map((stop) => stop.matchIds.join(','))
    .join('|');

  useLayoutEffect(() => {
    const root = rootRef.current;
    const svg = root?.querySelector('svg');
    if (!root || !svg) return;
    const stage = dataRef.current;
    const stops = openingTourStops(stage);
    const full = openingOverviewFrame(stage);
    const frames = openingCardFrames(stage);
    const state = cam.current;
    const write = (frame: OpeningTourFrame, elapsed: number) => {
      state.x = frame.x;
      state.y = frame.y;
      state.w = frame.w;
      state.h = frame.h;
      svg.setAttribute('viewBox', `${frame.x} ${frame.y} ${frame.w} ${frame.h}`);
      root.dataset.viewBox = `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;
      root.dataset.phase = openingTourPhase(elapsed, stops.length);
      root.dataset.stops = String(stops.length);
    };
    const total = openingTourDurationSec(stage);
    const apply = (elapsed: number) => write(openingTourViewAt(elapsed, full, frames), elapsed);
    const tl = gsap.timeline({ paused: true, onUpdate: () => apply(tl.time()) });
    tl.to({}, { duration: total });
    const begin = Math.min(total, Math.max(0, startRef.current));
    tl.seek(begin, false);
    apply(begin);
    playing.current = true;
    if (begin < total - 0.05) tl.play();
    return () => {
      playing.current = false;
      tl.kill();
    };
  }, [signature]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const svg = root?.querySelector('svg');
    if (!root || !svg || !playing.current) return;
    const state = cam.current;
    svg.setAttribute('viewBox', `${state.x} ${state.y} ${state.w} ${state.h}`);
  });

  return (
    <div ref={rootRef} className="obt-root" aria-label="開幕トーナメント案内">
      <div className="obt-map">
        <BracketView
          data={data}
          boardSide="winners"
          faceUrlByTeamId={faceUrlByTeamId}
          labelByTeamId={labelByTeamId}
          memberNamesByTeamId={memberNamesByTeamId}
        />
      </div>
    </div>
  );
}
