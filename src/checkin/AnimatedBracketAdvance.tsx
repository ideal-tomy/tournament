import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import BracketView, { frameViewBox } from '../features/bracket/BracketView';
import LosersColumnBoard from '../features/bracket/LosersColumnBoard';
import { computeLosersBoardLayout, resolveLosersAdvancePath } from '../features/bracket/losersBoard';
import { toStageData } from '../features/bracket/stageData';
import { maskUnrevealedAdvances, resolveResultAdvance } from '../features/bracket/resultAdvance';
import type { DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import { ratedName } from './presentationAdapter';
import { ADVANCE_CROSS_SPAN_SEC, ADVANCE_FADE_SEC, WINNER_ADVANCE_SEC, advanceCrossInAt } from '../features/presentation/advanceTiming';

/** 線が着いた時刻。ここから寄りへ、全体へ、同じ溶解で切り替える。 */
const LINE_END_SEC = 2;
/** 寄りが完全に出てから、全体へ溶かし始めるまでの静止。 */
const ARRIVE_HOLD_SEC = 1.1;

function crossLayers(tl: gsap.core.Timeline, outgoing: string, incoming: string, at: number) {
  tl.to(outgoing, { autoAlpha: 0, duration: ADVANCE_FADE_SEC, ease: 'none' }, at);
  tl.to(incoming, { autoAlpha: 1, duration: ADVANCE_FADE_SEC, ease: 'none' }, advanceCrossInAt(at));
}

export default function AnimatedBracketAdvance({
  state,
  winnerOverlay,
  controlledTime,
}: {
  state: DrawState;
  winnerOverlay: ReactNode;
  controlledTime?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline>();
  const beatRef = useRef(WINNER_ADVANCE_SEC);
  const [frameLit, setFrameLit] = useState((controlledTime ?? state.elapsedSeconds) >= 2);
  const presentation = state.flow?.resultPresentation;
  const isLosersMatch = presentation?.match.kind === 'loser';
  const data = useMemo(() => {
    if (!state.bracket || !presentation) return null;
    const before = toStageData(presentation.beforeBracket);
    const after = toStageData(state.bracket);
    return {
      before,
      after,
      advance: isLosersMatch
        ? null
        : resolveResultAdvance(before, after, presentation.match.id, presentation.winnerTeamId),
    };
  }, [state.bracket, presentation, isLosersMatch]);

  const losersAdvance = useMemo(() => {
    if (!data || !isLosersMatch || !presentation) return null;
    const layout = computeLosersBoardLayout(data.after);
    const path = resolveLosersAdvancePath(layout, presentation.match.id);
    if (!path) return null;
    const source = layout.byId[path.fromMatchId];
    return {
      layout,
      path,
      sourceRound: source?.round ?? presentation.match.round ?? 1,
      targetMatchId: path.toMatchId > 0 ? path.toMatchId : null,
    };
  }, [data, isLosersMatch, presentation]);

  const cameras = useMemo(() => {
    if (!data?.advance || isLosersMatch) return null;
    const view = data.advance.layout;
    const source = view.byId[data.advance.sourceMatchId];
    const dest = view.byId[data.advance.targetMatchId];
    if (!source || !dest) return null;
    return {
      rise: frameViewBox([source, dest]),
      arrived: frameViewBox([dest]),
      wide: frameViewBox(view.matches),
      focusRound: data.advance.sourceRound,
    };
  }, [data]);

  useLayoutEffect(() => {
    if (!root.current) return;
    if (isLosersMatch) {
      if (!losersAdvance) return;
      const beat = WINNER_ADVANCE_SEC;
      beatRef.current = beat;
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ paused: true });
        timeline.current = tl;
        tl.set('.advance-winner-out', { autoAlpha: 0 });
        tl.call(() => setFrameLit(false), undefined, 0)
          .call(() => setFrameLit(true), undefined, 2);
        tl.to({}, { duration: beat }, 0);
        tl.seek(Math.min(beat, controlledTime ?? state.elapsedSeconds), false);
        if (controlledTime == null && state.elapsedSeconds < beat) tl.play();
      }, root);
      return () => {
        timeline.current = undefined;
        ctx.revert();
      };
    }
    if (!data?.advance || !cameras) return;
    const beat = WINNER_ADVANCE_SEC;
    beatRef.current = beat;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      timeline.current = tl;
      const slots = root.current!.querySelectorAll<SVGGElement>(
        `[data-match-id="${data.advance!.targetMatchId}"] [data-slot="${data.advance!.targetSlot}"]`,
      );
      tl.set('.advance-winner-out', { autoAlpha: 0 })
        .set('.advance-rise .advance-line', { strokeDashoffset: 1 })
        .set('.advance-arrived .advance-line', { strokeDashoffset: 0 })
        .set('.advance-rise', { autoAlpha: 1 })
        .set('.advance-arrived', { autoAlpha: 0 })
        .set('.advance-full', { autoAlpha: 0 });
      if (slots.length) tl.set(slots, { opacity: 0 });
      tl.call(() => setFrameLit(false), undefined, 0)
        .call(() => setFrameLit(true), undefined, 2);
      tl.to('.advance-rise .advance-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
      if (slots.length) tl.set(slots, { opacity: 1 }, LINE_END_SEC);
      const arriveAt = LINE_END_SEC;
      crossLayers(tl, '.advance-rise', '.advance-arrived', arriveAt);
      const fadeAt = arriveAt + ADVANCE_CROSS_SPAN_SEC + ARRIVE_HOLD_SEC;
      crossLayers(tl, '.advance-arrived', '.advance-full', fadeAt);
      tl.to({}, { duration: beat }, 0);
      tl.seek(Math.min(beat, controlledTime ?? state.elapsedSeconds), false);
      if (controlledTime == null && state.elapsedSeconds < beat) tl.play();
    }, root);
    return () => {
      timeline.current = undefined;
      ctx.revert();
    };
  }, [data, cameras, losersAdvance, isLosersMatch, controlledTime, state.elapsedSeconds]);

  const shown = useMemo(() => {
    if (!data) return null;
    const revealed = new Set(state.flow?.revealedMatchIds ?? []);
    if (presentation) revealed.add(presentation.match.id);
    return maskUnrevealedAdvances(data.after, revealed);
  }, [data, presentation, state.flow?.revealedMatchIds]);

  useLayoutEffect(() => {
    if (controlledTime != null) timeline.current?.pause().seek(Math.max(0, Math.min(beatRef.current, controlledTime)), false);
  }, [controlledTime]);

  if (!presentation) return null;

  const faceUrlByTeamId = Object.fromEntries(
    state.teams.map((t) => [
      t.id,
      t.memberIds.map((id) => {
        const p = state.participants.find((person) => person.id === id);
        return p ? portraitUrlFor(p) : '';
      }),
    ]),
  );
  const labels = Object.fromEntries(state.teams.map((t) => [t.id, t.name]));
  const names = Object.fromEntries(
    state.teams.map((t) => [
      t.id,
      t.memberIds.map((id) => {
        const p = state.participants.find((person) => person.id === id);
        return p ? ratedName(p) : '';
      }),
    ]),
  );

  if (isLosersMatch) {
    if (!data || !losersAdvance) return <div className="audience-advance">{winnerOverlay}</div>;
    const pulseMatchIds = frameLit
      ? [presentation.match.id, losersAdvance.targetMatchId].filter((id): id is number => id != null)
      : [presentation.match.id];
    return (
      <div
        ref={root}
        className="audience-advance"
        data-advance-from={presentation.match.id}
        data-advance-to={losersAdvance.targetMatchId ?? -1}
      >
        <div className="advance-full" style={{ opacity: 1 }}>
          <div className="advance-board">
            <LosersColumnBoard
              data={shown ?? data.after}
              faceUrlByTeamId={faceUrlByTeamId}
              labelByTeamId={labels}
              focusRound={losersAdvance.sourceRound}
              frameMatchId={presentation.match.id}
              drawFromMatchId={frameLit ? presentation.match.id : null}
              pulseMatchIds={pulseMatchIds}
              highlightMatchId={presentation.match.id}
            />
          </div>
        </div>
        <div className="advance-winner-out">{winnerOverlay}</div>
      </div>
    );
  }

  if (!data?.advance || !cameras) return <div className="audience-advance">{winnerOverlay}</div>;
  const advance = data.advance;
  const pulseMatchIds = frameLit ? [advance.targetMatchId] : [];
  const board = {
    data: shown ?? data.after,
    boardSide: advance.boardSide,
    faceUrlByTeamId,
    labelByTeamId: labels,
    memberNamesByTeamId: names,
    focusRound: cameras.focusRound,
    fullBoard: true as const,
    attachGrandFinal: advance.attachGrandFinal,
    currentMatchId: advance.targetMatchId,
  };
  return (
    <div
      ref={root}
      className="audience-advance"
      data-advance-from={advance.sourceMatchId}
      data-advance-to={advance.targetMatchId}
    >
      <div className="advance-rise">
        <div className="advance-board">
          <BracketView
            {...board}
            clipPrefix="rise"
            viewBox={cameras.rise}
            pulseMatchIds={pulseMatchIds}
            mutedConnector={{ fromMatchId: advance.sourceMatchId, toMatchId: advance.targetMatchId }}
          />
        </div>
        <svg className="advance-overlay" viewBox={cameras.rise} preserveAspectRatio="xMidYMid meet" aria-label="勝者の勝ち上がり">
          <path className="advance-line" pathLength={1} strokeDasharray={1} d={advance.path} fill="none" stroke="#86efac" strokeWidth={3} />
        </svg>
      </div>
      <div className="advance-arrived">
        <div className="advance-board">
          <BracketView
            {...board}
            clipPrefix="arrived"
            viewBox={cameras.arrived}
            pulseMatchIds={pulseMatchIds}
            mutedConnector={{ fromMatchId: advance.sourceMatchId, toMatchId: advance.targetMatchId }}
          />
        </div>
        <svg className="advance-overlay" viewBox={cameras.arrived} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="advance-line" pathLength={1} strokeDasharray={1} d={advance.path} fill="none" stroke="#86efac" strokeWidth={3} />
        </svg>
      </div>
      <div className="advance-full">
        <div className="advance-board">
          <BracketView {...board} clipPrefix="wide" viewBox={cameras.wide} pulseMatchIds={pulseMatchIds} />
        </div>
      </div>
      <div className="advance-winner-out">{winnerOverlay}</div>
    </div>
  );
}
