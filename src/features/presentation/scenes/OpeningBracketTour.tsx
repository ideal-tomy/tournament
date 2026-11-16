import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { StageData } from '../../bracket/layout';
import { computeBracketLayout } from '../../bracket/layout';
import BracketView from '../../bracket/BracketView';
import {
  BRACKET_TOUR_HOLD_SEC,
  BRACKET_TOUR_OVERVIEW_SEC,
  BRACKET_TOUR_ZOOM_SEC,
  openingTourCaption,
  openingTourCaptionIndex,
  openingTourDurationSec,
  openingTourFrame,
  openingTourPhase,
  openingTourStops,
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
  teams,
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
  const captionRef = useRef<HTMLParagraphElement>(null);
  const cam = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const playing = useRef(false);
  const startRef = useRef(startAt);
  const dataRef = useRef(data);
  const labelsRef = useRef(labelByTeamId);
  dataRef.current = data;
  labelsRef.current = {
    ...Object.fromEntries(teams.map((team) => [team.id, team.name])),
    ...labelByTeamId,
  };
  const signature = openingTourStops(data)
    .map((stop) => stop.matchIds.join(','))
    .join('|');

  useLayoutEffect(() => {
    const root = rootRef.current;
    const svg = root?.querySelector('svg');
    if (!root || !svg) return;
    const stage = dataRef.current;
    const labels = labelsRef.current;
    const stops = openingTourStops(stage).map((stop) => ({
      ...stop,
      caption: openingTourCaption(stage, stop.matchIds, labels),
    }));
    const layout = computeBracketLayout(stage, undefined, 'winners');
    const full = { x: 0, y: 0, w: layout.width, h: layout.height };
    const state = cam.current;
    state.x = full.x;
    state.y = full.y;
    state.w = full.w;
    state.h = full.h;
    const apply = (elapsed: number) => {
      svg.setAttribute('viewBox', `${state.x} ${state.y} ${state.w} ${state.h}`);
      root.dataset.viewBox = `${state.x} ${state.y} ${state.w} ${state.h}`;
      const index = openingTourCaptionIndex(elapsed, stops.length);
      root.dataset.stop = index == null ? '' : String(index);
      root.dataset.phase = openingTourPhase(elapsed, stops.length);
      root.dataset.stops = String(stops.length);
      if (captionRef.current) captionRef.current.textContent = index == null ? '' : stops[index]?.caption ?? '';
    };
    const tl = gsap.timeline({ paused: true, onUpdate: () => apply(tl.time()) });
    tl.to({}, { duration: BRACKET_TOUR_OVERVIEW_SEC });
    for (const stop of stops) {
      const frame = openingTourFrame(stage, stop.matchIds);
      tl.to(state, {
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        duration: BRACKET_TOUR_ZOOM_SEC,
        ease: 'power2.inOut',
      });
      tl.to({}, { duration: BRACKET_TOUR_HOLD_SEC });
      tl.to(state, {
        x: full.x,
        y: full.y,
        w: full.w,
        h: full.h,
        duration: BRACKET_TOUR_ZOOM_SEC,
        ease: 'power2.inOut',
      });
    }
    const total = openingTourDurationSec(stage);
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
      <p ref={captionRef} className="obt-caption" aria-live="polite" />
    </div>
  );
}
