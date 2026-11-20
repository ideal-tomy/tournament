import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import BracketView, { frameViewBox } from '../features/bracket/BracketView';
import LosersColumnBoard from '../features/bracket/LosersColumnBoard';
import { venueFocusRound } from '../features/bracket/bracketCamera';
import { toStageData } from '../features/bracket/stageData';
import { resolveResultAdvance } from '../features/bracket/resultAdvance';
import type { DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import { ratedName } from './presentationAdapter';

/** 表は1枚のまま線をつなぎ、線が届いた時点で写真を入れる。6秒で次へ進む。 */
const WINNER_ADVANCE_SEC = 6;

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
  const data = useMemo(() => {
    if (!state.bracket || !presentation) return null;
    const before = toStageData(presentation.beforeBracket);
    const after = toStageData(state.bracket);
    return {
      before,
      after,
      advance: resolveResultAdvance(before, after, presentation.match.id, presentation.winnerTeamId),
    };
  }, [state.bracket, presentation]);

  useLayoutEffect(() => {
    if (!root.current || !data) return;
    const side = data.advance?.boardSide ?? (presentation?.match.kind === 'loser' ? 'losers' : 'winners');
    const losers = side === 'losers';
    const beat = WINNER_ADVANCE_SEC;
    beatRef.current = beat;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      timeline.current = tl;
      if (losers && data.advance) {
        const slot = root.current!.querySelector<HTMLElement>(
          `.losers-tight [data-match-id="${data.advance.targetMatchId}"] [data-slot="${data.advance.targetSlot}"]`,
        );
        tl.set('.advance-winner-out', { autoAlpha: 0 })
          .set('.losers-draw-line', { strokeDashoffset: 1 })
          .set('.advance-stage', { autoAlpha: 1 });
        if (slot) tl.set(slot, { opacity: 0 });
        tl.call(() => setFrameLit(false), undefined, 0)
          .call(() => setFrameLit(true), undefined, 2);
        tl.to('.losers-draw-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
        if (slot) tl.set(slot, { opacity: 1 }, 2);
      } else if (data.advance) {
        const slot = root.current!.querySelector<SVGGElement>(
          `.advance-board [data-match-id="${data.advance.targetMatchId}"] [data-slot="${data.advance.targetSlot}"]`,
        );
        tl.set('.advance-winner-out', { autoAlpha: 0 })
          .set('.advance-line', { strokeDashoffset: 1 })
          .set('.advance-stage', { autoAlpha: 1, clearProps: 'transform' });
        if (slot) tl.set(slot, { opacity: 0 });
        tl.to('.advance-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
        if (slot) tl.set(slot, { opacity: 1 }, 2);
      }
      tl.to({}, { duration: beat }, 0);
      tl.seek(Math.min(beat, controlledTime ?? state.elapsedSeconds), false);
      if (controlledTime == null && state.elapsedSeconds < beat) tl.play();
    }, root);
    return () => {
      timeline.current = undefined;
      ctx.revert();
    };
  }, [data]);

  useLayoutEffect(() => {
    if (controlledTime != null) timeline.current?.pause().seek(Math.max(0, Math.min(beatRef.current, controlledTime)), false);
  }, [controlledTime]);

  if (!data || !presentation) return null;
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
  const view = data.advance?.layout;
  const boardSide =
    state.flow?.boardSide ??
    (presentation.match.kind === 'loser' ? 'losers' : presentation.match.kind === 'grand_final' ? 'grand_final' : 'winners');

  const side = data.advance?.boardSide ?? boardSide;
  const losers = side === 'losers';
  const focusRound = venueFocusRound(data.after, losers ? 'losers' : side === 'grand_final' ? 'grand_final' : 'winners', {
    highlightMatchId: data.advance?.sourceMatchId ?? presentation.match.id,
  });
  const roundMatches = view?.matches.filter((match) => match.round === focusRound || match.round === focusRound + 1) ?? [];
  const roundViewBox = roundMatches.length ? frameViewBox(roundMatches) : view ? frameViewBox(view.matches) : '0 0 1 1';
  const pulseMatchIds = frameLit && data.advance ? [data.advance.targetMatchId] : [];
  return (
    <div ref={root} className="audience-advance" data-advance-from={data.advance?.sourceMatchId} data-advance-to={data.advance?.targetMatchId}>
      {losers ? (
        <>
          <div className="advance-stage losers-tight">
            <LosersColumnBoard
              data={data.after}
              faceUrlByTeamId={faceUrlByTeamId}
              labelByTeamId={labels}
              frameMatchId={data.advance?.sourceMatchId ?? presentation.match.id}
              focusRound={focusRound}
              pulseMatchIds={pulseMatchIds}
            />
          </div>
        </>
      ) : (
        <>
        <div className="advance-stage">
          <div className="advance-board">
            <BracketView
              data={data.after}
              boardSide={side}
              clipPrefix="after"
              faceUrlByTeamId={faceUrlByTeamId}
              labelByTeamId={labels}
              memberNamesByTeamId={names}
              focusRound={focusRound}
              pulseMatchIds={pulseMatchIds}
              currentMatchId={data.advance?.targetMatchId ?? null}
              mutedConnector={data.advance ? { fromMatchId: data.advance.sourceMatchId, toMatchId: data.advance.targetMatchId } : null}
            />
          </div>
          {data.advance && (
            <svg className="advance-overlay" viewBox={roundViewBox} preserveAspectRatio="xMidYMid meet" aria-label="勝者の勝ち上がり">
              <path className="advance-line" pathLength={1} strokeDasharray={1} d={data.advance.path} fill="none" stroke="#86efac" strokeWidth={3} />
            </svg>
          )}
        </div>
        </>
      )}
      <div className="advance-winner-out">{winnerOverlay}</div>
    </div>
  );
}
