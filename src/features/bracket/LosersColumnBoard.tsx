import { useLayoutEffect, useRef } from 'react';
import { TOURNAMENT_EFFECTS } from '../../lib/tournamentEffects';
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
  if (!teamId) return <p className="losers-wait" data-slot={slot}>待機【{source}】</p>;
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

/** ルーザーズだけ、回戦の列と接続線で出す。ウィナーズの樹とは別の画面。 */
export default function LosersColumnBoard({
  data,
  faceUrlByTeamId,
  labelByTeamId,
  liveMatchId = null,
  calledMatchId = null,
  highlightMatchId = null,
  frameMatchId = null,
  pulseMatchIds = [],
}: {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  liveMatchId?: number | null;
  calledMatchId?: number | null;
  highlightMatchId?: number | null;
  /** この試合と、次の枠までの線だけを画面いっぱいに出す */
  frameMatchId?: number | null;
  /** 終わった試合と、その次の試合。枠をゆっくり点滅させる */
  pulseMatchIds?: number[];
}) {
  const columns = losersColumns(data);
  const focusId = frameMatchId ?? highlightMatchId ?? liveMatchId ?? calledMatchId;
  const pulseIds = new Set(pulseMatchIds);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const place = () => {
      const viewW = viewport.clientWidth;
      const viewH = viewport.clientHeight;
      const naturalW = track.scrollWidth;
      const naturalH = track.scrollHeight;
      if (!viewW || !viewH || !naturalW || !naturalH) return;
      if (frameMatchId != null) {
        const source = track.querySelector<HTMLElement>(`[data-match-id="${frameMatchId}"]`);
        const round = source?.closest<HTMLElement>('.losers-round');
        const link = round?.querySelector<HTMLElement>('.losers-link');
        const nextId = columns.flatMap((column) => column.matches).find((match) => match.id === frameMatchId)?.nextId;
        const target = nextId == null ? null : track.querySelector<HTMLElement>(`[data-match-id="${nextId}"]`);
        const cards = [source, target].filter((node): node is HTMLElement => node != null);
        track.style.transform = 'none';
        const root = track.getBoundingClientRect();
        const boxOf = (node: HTMLElement) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.left - root.left, y: rect.top - root.top, w: rect.width, h: rect.height };
        };
        const boxes = [
          ...cards.map(boxOf),
          ...cards.flatMap((card) => {
            const vs = card.querySelector<HTMLElement>('.losers-vs');
            return vs ? [boxOf(vs)] : [];
          }),
        ];
        const linkBox = link ? boxOf(link) : null;
        if (boxes.length) {
          const left = Math.min(...boxes.map((box) => box.x), linkBox?.x ?? Infinity) - 16;
          const top = Math.min(...boxes.map((box) => box.y)) - 16;
          const right = Math.max(...boxes.map((box) => box.x + box.w), linkBox ? linkBox.x + linkBox.w : -Infinity) + 16;
          const bottom = Math.max(...boxes.map((box) => box.y + box.h)) + 16;
          const width = Math.max(1, right - left);
          const height = Math.max(1, bottom - top);
          const scale = Math.min(viewW / width, viewH / height);
          track.style.transformOrigin = '0 0';
          track.style.transform = `translate(${viewW / 2 - (left + width / 2) * scale}px, ${viewH / 2 - (top + height / 2) * scale}px) scale(${scale})`;
          return;
        }
      }
      if (focusId == null) {
        const scale = Math.min(viewW / naturalW, viewH / naturalH);
        track.style.transform = `translateX(0px) scale(${scale})`;
        return;
      }
      const scale = Math.min(1, viewH / naturalH);
      const column = track.querySelector<HTMLElement>(`[data-match-id="${focusId}"]`)?.closest<HTMLElement>('.losers-round');
      const scaledW = naturalW * scale;
      let x = 0;
      if (column && scaledW > viewW) {
        const center = (column.offsetLeft + column.offsetWidth / 2) * scale;
        x = Math.max(0, Math.min(center - viewW / 2, scaledW - viewW));
      }
      track.style.transform = `translateX(${-x}px) scale(${scale})`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [columns, focusId, frameMatchId]);
  return (
    <div ref={viewportRef} className="losers-viewport" aria-label="ルーザーズ">
      <div ref={trackRef} className={`losers-track${frameMatchId == null ? '' : ' is-framed'}`}>
        {columns.map((column, columnIndex) => (
          <div key={column.round} className="losers-round">
            <section className="losers-col">
              <h3>{column.round}回戦</h3>
              <div className="losers-matches">
                {column.matches.map((match, index) => {
                  const state: LoserSlotStatus = match.id === liveMatchId ? 'live' : match.id === calledMatchId ? 'ready' : match.status;
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
