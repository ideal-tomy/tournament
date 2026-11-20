import { useLayoutEffect, useRef } from 'react';
import { TOURNAMENT_EFFECTS } from '../../lib/tournamentEffects';
import { splitLoserWaitSource, venueCameraRounds, venueFocusRound } from './bracketCamera';
import type { StageData } from './layout';
import { losersColumns, type LoserColumn, type LoserSlotStatus } from './losersBoard';

function Slot({
  teamId,
  source,
  faces,
  label,
  slot,
}: {
  teamId: string | null;
  source: string;
  faces: string[];
  label: string;
  slot: number;
}) {
  if (!teamId) {
    const [line, wait] = splitLoserWaitSource(source);
    return (
      <p className="losers-wait" data-slot={slot}>
        <span>{line}</span>
        <span>{wait}</span>
      </p>
    );
  }
  return (
    <div className="losers-slot" data-slot={slot}>
      <span className="losers-faces">
        {faces.slice(0, 2).map((face, index) => (
          face ? <img key={`${face}-${index}`} src={face} alt="" /> : <span key={index} className="losers-face-empty" />
        ))}
      </span>
      <strong>{label || teamId}</strong>
    </div>
  );
}

function yOf(index: number, count: number) {
  return ((index + 0.5) / count) * 100;
}

function drawPath(fromIndex: number, fromCount: number, toIndex: number, toCount: number) {
  const y = yOf(fromIndex, fromCount);
  const yNext = yOf(toIndex, toCount);
  return Math.abs(y - yNext) < 0.01 ? `M 0 ${y} H 100` : `M 0 ${y} H 42 V ${yNext} H 100`;
}

function Links({ from, to, hotId, drawMatchId = null }: { from: LoserColumn; to: LoserColumn; hotId: number | null; drawMatchId?: number | null }) {
  const nextIndex = new Map(to.matches.map((match, index) => [match.id, index]));
  const groups = new Map<number, number[]>();
  from.matches.forEach((match, index) => {
    if (match.nextId == null || !nextIndex.has(match.nextId)) return;
    const list = groups.get(match.nextId) ?? [];
    list.push(index);
    groups.set(match.nextId, list);
  });
  const paths = [...groups].map(([nextId, indexes]) => {
    const target = nextIndex.get(nextId) ?? 0;
    const ys = indexes.map((index) => yOf(index, from.matches.length));
    const yNext = yOf(target, to.matches.length);
    const hot = hotId === nextId || indexes.some((index) => from.matches[index]?.id === hotId);
    if (ys.length === 1 && from.matches[indexes[0] ?? -1]?.id === drawMatchId) return null;
    if (ys.length === 1) {
      const y = ys[0];
      const d = Math.abs(y - yNext) < 0.01 ? `M 0 ${y} H 100` : `M 0 ${y} H 42 V ${yNext} H 100`;
      return { hot, d };
    }
    const top = Math.min(...ys, yNext);
    const bottom = Math.max(...ys, yNext);
    const arms = ys.map((y) => `M 0 ${y} H 42`).join(' ');
    return { hot, d: `${arms} M 42 ${top} V ${bottom} M 42 ${yNext} H 100` };
  });
  return (
    <div className="losers-link" aria-hidden="true">
      <div className="losers-link-pad" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {paths.flatMap((path) => (
          path ? [<path key={path.d} d={path.d} className={path.hot ? 'is-hot' : undefined} />] : []
        ))}
        {from.matches.flatMap((match, index) => {
          if (match.id !== drawMatchId || match.nextId == null || !nextIndex.has(match.nextId)) return [];
          const d = drawPath(index, from.matches.length, nextIndex.get(match.nextId) ?? 0, to.matches.length);
          return [<path key={`draw-${match.id}`} className="losers-draw-line" pathLength={1} strokeDasharray={1} strokeDashoffset={1} d={d} />];
        })}
      </svg>
    </div>
  );
}

function boxOf(root: DOMRect, node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return { x: rect.left - root.left, y: rect.top - root.top, w: rect.width, h: rect.height };
}

function formatTransform(tx: number, ty: number, scale: number) {
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`;
}

/** 計測のために transform を外すが、その瞬間は transition も止めて画面に出さない。 */
function computeFit(
  track: HTMLElement,
  viewW: number,
  viewH: number,
  nodes: HTMLElement[],
  pad = 16,
): string | null {
  if (!nodes.length) return null;
  const previousTransform = track.style.transform;
  const previousTransition = track.style.transition;
  track.style.transition = 'none';
  track.style.transform = 'none';
  void track.offsetWidth;
  try {
    const root = track.getBoundingClientRect();
    const boxes = nodes.map((node) => boxOf(root, node));
    const left = Math.min(...boxes.map((box) => box.x)) - pad;
    const top = Math.min(...boxes.map((box) => box.y)) - pad;
    const right = Math.max(...boxes.map((box) => box.x + box.w)) + pad;
    const bottom = Math.max(...boxes.map((box) => box.y + box.h)) + pad;
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const scale = Math.min(viewW / width, viewH / height);
    return formatTransform(viewW / 2 - (left + width / 2) * scale, viewH / 2 - (top + height / 2) * scale, scale);
  } finally {
    track.style.transform = previousTransform;
    track.style.transition = previousTransition;
  }
}

function applyTrackTransform(track: HTMLElement, next: string, animate: boolean, applied: { current: string }) {
  if (applied.current === next) return;
  if (!animate || !applied.current) {
    track.style.transition = 'none';
    track.style.transform = next;
    void track.offsetWidth;
    track.style.transition = '';
  } else {
    track.style.transition = '';
    track.style.transform = next;
  }
  applied.current = next;
}

/** ルーザーズだけ、回戦の列と接続線で出す。ウィナーズの樹とは別の画面。 */
export default function LosersColumnBoard({
  data,
  faceUrlByTeamId,
  labelByTeamId,
  liveMatchId = null,
  liveMatchIds = [],
  calledMatchId = null,
  calledMatchIds = [],
  highlightMatchId = null,
  frameMatchId = null,
  pulseMatchIds = [],
  focusRound: focusRoundOverride = null,
}: {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  liveMatchId?: number | null;
  liveMatchIds?: number[];
  calledMatchId?: number | null;
  calledMatchIds?: number[];
  highlightMatchId?: number | null;
  /** この試合と、次の枠までの線だけを画面いっぱいに出す */
  frameMatchId?: number | null;
  /** 進行中の試合、または勝利確定後の次の枠 */
  pulseMatchIds?: number[];
  /** 会場表のカメラが映す回戦。未指定なら進行状態から決める */
  focusRound?: number | null;
}) {
  const columns = losersColumns(data);
  const lives = [...new Set([liveMatchId, ...liveMatchIds].filter((id): id is number => id != null))];
  const calls = [...new Set([calledMatchId, ...calledMatchIds].filter((id): id is number => id != null))];
  const liveSet = new Set(lives);
  const callSet = new Set(calls);
  const focusId = frameMatchId ?? highlightMatchId ?? lives[0] ?? calls[0] ?? null;
  const pulseIds = new Set(pulseMatchIds);
  const focusRound = focusRoundOverride ?? venueFocusRound(data, 'losers', {
    liveMatchIds: lives,
    calledMatchIds: calls,
    highlightMatchId,
  });
  const cameraRoundList = venueCameraRounds(focusRound, columns[columns.length - 1]?.round ?? focusRound);
  const cameraRoundsKey = cameraRoundList.join(',');
  const frameNextId =
    frameMatchId == null
      ? null
      : columns.flatMap((column) => column.matches).find((match) => match.id === frameMatchId)?.nextId ?? null;
  const cameraKey = `${cameraRoundsKey}|${focusRound}|${focusId ?? ''}|${frameMatchId ?? ''}|${frameNextId ?? ''}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const appliedTransform = useRef('');
  const cameraKeyRef = useRef(cameraKey);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const rounds = cameraRoundsKey.split(',').map(Number).filter((round) => Number.isFinite(round));
    const targetChanged = cameraKeyRef.current !== cameraKey;
    cameraKeyRef.current = cameraKey;
    const place = (reason: 'target' | 'resize') => {
      const viewW = viewport.clientWidth;
      const viewH = viewport.clientHeight;
      if (!viewW || !viewH) return;
      let next: string | null = null;
      if (frameMatchId != null) {
        const source = track.querySelector<HTMLElement>(`[data-match-id="${frameMatchId}"]`);
        const round = source?.closest<HTMLElement>('.losers-round');
        const link = round?.querySelector<HTMLElement>('.losers-link');
        const target = frameNextId == null ? null : track.querySelector<HTMLElement>(`[data-match-id="${frameNextId}"]`);
        const cards = [source, target].filter((node): node is HTMLElement => node != null);
        const extras = [
          ...cards.flatMap((card) => {
            const vs = card.querySelector<HTMLElement>('.losers-vs');
            return vs ? [vs] : [];
          }),
          ...(link ? [link] : []),
        ];
        next = computeFit(track, viewW, viewH, [...cards, ...extras]);
      }
      if (!next) {
        const roundNodes = rounds
          .map((round) => track.querySelector<HTMLElement>(`.losers-round[data-round="${round}"]`))
          .filter((node): node is HTMLElement => node != null);
        next = roundNodes.length ? computeFit(track, viewW, viewH, roundNodes, 12) : null;
      }
      if (!next) {
        const naturalW = track.scrollWidth;
        const naturalH = track.scrollHeight;
        if (!naturalW || !naturalH) return;
        next = formatTransform(0, 0, Math.min(viewW / naturalW, viewH / naturalH));
      }
      const animate = reason === 'target' && targetChanged && appliedTransform.current !== '';
      track.style.transformOrigin = '0 0';
      applyTrackTransform(track, next, animate, appliedTransform);
    };
    place('target');
    const observer = new ResizeObserver(() => place('resize'));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cameraKey, cameraRoundsKey, frameMatchId, frameNextId]);
  return (
    <div ref={viewportRef} className="losers-viewport" aria-label="ルーザーズ">
      <div ref={trackRef} className={`losers-track${frameMatchId == null ? '' : ' is-framed'}`}>
        {columns.map((column, columnIndex) => (
          <div key={column.round} className="losers-round" data-round={column.round}>
            <section className="losers-col">
              <h3>{column.round}回戦</h3>
              <div className="losers-matches">
                {column.matches.map((match, index) => {
                  const state: LoserSlotStatus = liveSet.has(match.id)
                    ? 'live'
                    : callSet.has(match.id)
                      ? 'ready'
                      : match.status;
                  return (
                    <article
                      key={match.id}
                      className={`losers-match${state === 'live' ? ' is-live' : ''}${match.id === highlightMatchId ? ' is-current' : ''}${pulseIds.has(match.id) ? ' is-pulse' : ''}`}
                      data-match-id={match.id}
                      style={{ ['--n' as string]: column.matches.length, top: `${yOf(index, column.matches.length)}%` }}
                    >
                      <div className="losers-vs" aria-hidden="true">
                        <img src={TOURNAMENT_EFFECTS.effects.vsMark} alt="" />
                      </div>
                      <div className="losers-sides">
                        {match.slots.map((slot, slotIndex) => (
                          <Slot
                            key={slotIndex}
                            slot={slotIndex}
                            teamId={slot.teamId}
                            source={slot.source}
                            faces={slot.teamId ? faceUrlByTeamId[slot.teamId] ?? [] : []}
                            label={slot.teamId ? labelByTeamId[slot.teamId] ?? '' : ''}
                          />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            {columnIndex < columns.length - 1 && (
              <Links from={column} to={columns[columnIndex + 1]} hotId={frameMatchId == null ? focusId : null} drawMatchId={frameMatchId} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
