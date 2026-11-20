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

/** 寄った画面のまま線をつなぎ、回戦の枠へ戻す。アップは50%から0.5秒で消す。 */
const WINNER_ADVANCE_SEC = 6;

function parseViewBox(value: string) {
  const [x, y, w, h] = value.split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}

function focusViewBox(
  source: { x: number; y: number; w: number; h: number },
  target: { x: number; y: number; w: number; h: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const midY = (from.y + to.y) / 2;
  const xs = [source.x, source.x + source.w, target.x, target.x + target.w, from.x, to.x];
  const ys = [source.y, source.y + source.h, target.y, target.y + target.h, from.y, to.y, midY];
  const pad = 16;
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  const right = Math.max(...xs) + pad;
  const bottom = Math.max(...ys) + pad;
  return `${left} ${top} ${Math.max(1, right - left)} ${Math.max(1, bottom - top)}`;
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
    let observer: ResizeObserver | undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      timeline.current = tl;
      if (losers && data.advance) {
        const slot = root.current!.querySelector<HTMLElement>(
          `.losers-tight [data-match-id="${data.advance.targetMatchId}"] [data-slot="${data.advance.targetSlot}"]`,
        );
        tl.set('.advance-winner-out', { autoAlpha: 0 })
          .set('.losers-draw-line', { strokeDashoffset: 1 })
          .set('.advance-full', { autoAlpha: 0 })
          .set('.advance-stage', { autoAlpha: 1 });
        if (slot) tl.set(slot, { opacity: 0 });
        tl.call(() => setFrameLit(false), undefined, 0)
          .call(() => setFrameLit(true), undefined, 2);
        tl.to('.losers-draw-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
        if (slot) tl.to(slot, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 2);
        tl.to('.advance-stage', { autoAlpha: 0.5, duration: 1.5, ease: 'none' }, 3)
          .to('.advance-stage', { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, 4.5)
          .to('.advance-full', { autoAlpha: 1, duration: 3, ease: 'none' }, 3);
      } else if (data.advance) {
        const source = data.advance.layout.byId[data.advance.sourceMatchId];
        const target = data.advance.layout.byId[data.advance.targetMatchId];
        const tight = source && target
          ? parseViewBox(focusViewBox(source.box, target.box, data.advance.source, data.advance.target))
          : null;
        const roundView = root.current!.querySelector<SVGSVGElement>('.advance-full svg');
        const wide = roundView
          ? parseViewBox(roundView.getAttribute('viewBox') ?? frameViewBox(data.advance.layout.matches))
          : parseViewBox(frameViewBox(
            data.advance.layout.matches.filter((match) => {
              const focus = venueFocusRound(data.after, side === 'losers' ? 'losers' : 'winners', {
                highlightMatchId: data.advance!.sourceMatchId,
              });
              return match.round === focus || match.round === focus + 1;
            }),
          ));
        const stage = root.current!.querySelector<HTMLElement>('.advance-stage');
        const applyTight = () => {
          if (!tight || !stage) return;
          const viewW = stage.clientWidth;
          const viewH = stage.clientHeight;
          if (!viewW || !viewH) return;
          const fullFit = Math.min(viewW / wide.w, viewH / wide.h);
          const originX = (viewW - wide.w * fullFit) / 2;
          const originY = (viewH - wide.h * fullFit) / 2;
          const zoom = Math.min(viewW / (tight.w * fullFit), viewH / (tight.h * fullFit));
          const centerX = originX + (tight.x + tight.w / 2 - wide.x) * fullFit;
          const centerY = originY + (tight.y + tight.h / 2 - wide.y) * fullFit;
          stage.style.transformOrigin = '0 0';
          stage.style.transform = `translate(${viewW / 2 - centerX * zoom}px, ${viewH / 2 - centerY * zoom}px) scale(${zoom})`;
        };
        const slot = root.current!.querySelector<SVGGElement>(
          `.advance-board [data-match-id="${data.advance.targetMatchId}"] [data-slot="${data.advance.targetSlot}"]`,
        );
        tl.set('.advance-winner-out', { autoAlpha: 0 })
          .set('.advance-line', { strokeDashoffset: 1 })
          .set('.advance-full', { autoAlpha: 0 })
          .set('.advance-stage', { autoAlpha: 1 });
        if (slot) tl.set(slot, { opacity: 0 });
        applyTight();
        observer = new ResizeObserver(() => applyTight());
        if (stage) observer.observe(stage);
        tl.to('.advance-line', { strokeDashoffset: 0, autoRound: false, duration: 1.5, ease: 'none' }, 0.5);
        if (slot) tl.to(slot, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 2);
        tl.to('.advance-stage', { autoAlpha: 0.5, duration: 1.5, ease: 'none' }, 3)
          .to('.advance-stage', { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, 4.5)
          .to('.advance-full', { autoAlpha: 1, duration: 3, ease: 'none' }, 3);
      }
      tl.to({}, { duration: beat }, 0);
      tl.seek(Math.min(beat, controlledTime ?? state.elapsedSeconds), false);
      if (controlledTime == null && state.elapsedSeconds < beat) tl.play();
    }, root);
    return () => {
      observer?.disconnect();
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
              pulseMatchIds={pulseMatchIds}
            />
          </div>
          <div className="advance-full">
            <LosersColumnBoard
              data={data.after}
              faceUrlByTeamId={faceUrlByTeamId}
              labelByTeamId={labels}
              highlightMatchId={data.advance?.targetMatchId ?? data.advance?.sourceMatchId ?? presentation.match.id}
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
              mutedConnector={data.advance ? { fromMatchId: data.advance.sourceMatchId, toMatchId: data.advance.targetMatchId } : null}
            />
          </div>
          {data.advance && (
            <svg className="advance-overlay" viewBox={roundViewBox} preserveAspectRatio="xMidYMid meet" aria-label="勝者の勝ち上がり">
              <path className="advance-line" pathLength={1} strokeDasharray={1} d={data.advance.path} fill="none" stroke="#86efac" strokeWidth={3} />
            </svg>
          )}
        </div>
        <div className="advance-full">
          <BracketView
            data={data.after}
            boardSide={side}
            clipPrefix="full"
            faceUrlByTeamId={faceUrlByTeamId}
            labelByTeamId={labels}
            memberNamesByTeamId={names}
            focusRound={focusRound}
            pulseMatchIds={pulseMatchIds}
            currentMatchId={data.advance?.targetMatchId ?? null}
          />
        </div>
        </>
      )}
      <div className="advance-winner-out">{winnerOverlay}</div>
    </div>
  );
}
