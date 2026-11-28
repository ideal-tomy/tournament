import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import BracketView, { frameViewBox } from '../features/bracket/BracketView';
import LosersColumnBoard from '../features/bracket/LosersColumnBoard';
import { computeLosersBoardLayout, resolveLosersAdvancePath } from '../features/bracket/losersBoard';
import { toStageData } from '../features/bracket/stageData';
import { resolveResultAdvance } from '../features/bracket/resultAdvance';
import type { DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import { ratedName } from './presentationAdapter';

/** 寄り → 線 → 写真 → 寄りを長く消し、70%のあたりで全体が現れ始める。6秒で次へ進む。 */
const WINNER_ADVANCE_SEC = 6;
/** 寄りのフェード時間。このあいだ位置は動かさない。 */
const FADE_OUT_SEC = 2.2;
/** 寄りがこの不透明度まで落ちたとき、全体を出し始める。 */
const CROSS_AT = 0.7;

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
      close: frameViewBox([source, dest]),
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
      const slot = root.current!.querySelector<SVGGElement>(
        `.advance-stage [data-match-id="${data.advance!.targetMatchId}"] [data-slot="${data.advance!.targetSlot}"]`,
      );
      tl.set('.advance-winner-out', { autoAlpha: 0 })
        .set('.advance-line', { strokeDashoffset: 1 })
        .set('.advance-stage', { autoAlpha: 1 })
        .set('.advance-full', { autoAlpha: 0 });
      if (slot) tl.set(slot, { opacity: 0 });
      tl.call(() => setFrameLit(false), undefined, 0)
        .call(() => setFrameLit(true), undefined, 2);
      tl.to('.advance-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
      if (slot) tl.set(slot, { opacity: 1 }, 2);
      const fadeAt = 2.4;
      tl.to('.advance-stage', { autoAlpha: 0, duration: FADE_OUT_SEC, ease: 'none' }, fadeAt);
      tl.to('.advance-full', { autoAlpha: 1, duration: FADE_OUT_SEC, ease: 'none' }, fadeAt + FADE_OUT_SEC * (1 - CROSS_AT));
      tl.to({}, { duration: beat }, 0);
      tl.seek(Math.min(beat, controlledTime ?? state.elapsedSeconds), false);
      if (controlledTime == null && state.elapsedSeconds < beat) tl.play();
    }, root);
    return () => {
      timeline.current = undefined;
      ctx.revert();
    };
  }, [data, cameras, losersAdvance, isLosersMatch, controlledTime, state.elapsedSeconds]);

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
              data={data.after}
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
    data: data.after,
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
      <div className="advance-stage">
        <div className="advance-board">
          <BracketView
            {...board}
            clipPrefix="close"
            viewBox={cameras.close}
            pulseMatchIds={pulseMatchIds}
            mutedConnector={{ fromMatchId: advance.sourceMatchId, toMatchId: advance.targetMatchId }}
          />
        </div>
        <svg className="advance-overlay" viewBox={cameras.close} preserveAspectRatio="xMidYMid meet" aria-label="勝者の勝ち上がり">
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
