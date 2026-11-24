import { useLayoutEffect, useMemo, useRef } from 'react';
import { TOURNAMENT_EFFECTS } from '../../lib/tournamentEffects';
import { venueFocusRound } from './bracketCamera';
import type { StageData } from './layout';
import {
  computeLosersBoardLayout,
  type LoserSlotStatus,
  type LosersPlacedMatch,
} from './losersBoard';

function Slot({
  teamId,
  faces,
  label,
  slot,
  lost,
}: {
  teamId: string | null;
  faces: string[];
  label: string;
  slot: number;
  lost: boolean;
}) {
  if (!teamId) {
    return (
      <div className="losers-slot is-open" data-slot={slot}>
        <span className="losers-faces">
          <span className="losers-face-empty" />
          <span className="losers-face-empty" />
        </span>
      </div>
    );
  }
  return (
    <div className={`losers-slot${lost ? ' is-lost' : ''}`} data-slot={slot} data-team-id={teamId}>
      <span className="losers-faces">
        {faces.slice(0, 2).map((face, index) => (
          face ? <img key={`${face}-${index}`} src={face} alt="" /> : <span key={index} className="losers-face-empty" />
        ))}
      </span>
      {label ? <span className="losers-team-name">{label}</span> : null}
    </div>
  );
}

function formatTransform(tx: number, ty: number, scale: number) {
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`;
}

function clampPan(desired: number, view: number, scaled: number) {
  if (scaled <= view) return (view - scaled) / 2;
  return Math.min(0, Math.max(view - scaled, desired));
}

/**
 * 幅に合わせて倍率を決め、進行中の段が上側に来るよう縦に送る。
 * 見出しは 14px 未満にしない。
 */
function computeCamera(
  naturalW: number,
  naturalH: number,
  viewW: number,
  viewH: number,
  focusY: number | null,
): string | null {
  if (!naturalW || !naturalH || !viewW || !viewH) return null;
  const fit = Math.min(viewW / naturalW, viewH / naturalH);
  const scale = Math.min(1, Math.round(fit * 10000) / 10000);
  const tx = clampPan((viewW - naturalW * scale) / 2, viewW, naturalW * scale);
  const desiredTy = focusY == null
    ? (viewH - naturalH * scale) / 2
    : viewH * 0.08 - focusY * scale;
  const ty = clampPan(desiredTy, viewH, naturalH * scale);
  return formatTransform(tx, ty, scale);
}

function matchStatus(
  match: LosersPlacedMatch,
  liveSet: Set<number>,
  callSet: Set<number>,
): LoserSlotStatus {
  if (liveSet.has(match.id)) return 'live';
  if (callSet.has(match.id)) return 'ready';
  return match.status;
}

function slotLost(data: StageData, matchId: number, slot: number): boolean {
  const match = data.match.find((row) => row.id === matchId);
  if (!match) return false;
  const opp = slot === 0 ? match.opponent1 : match.opponent2;
  return opp?.result === 'loss';
}

/** ルーザーズだけ、上から下へ回戦を積む。ウィナーズの樹とは別の画面。 */
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
  drawFromMatchId = null,
}: {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  liveMatchId?: number | null;
  liveMatchIds?: number[];
  calledMatchId?: number | null;
  calledMatchIds?: number[];
  highlightMatchId?: number | null;
  /** この試合と行き先を明るくする */
  frameMatchId?: number | null;
  /** 進行中の試合、または勝利確定後の次の枠 */
  pulseMatchIds?: number[];
  /** 会場表のカメラが映す回戦。未指定なら進行状態から決める */
  focusRound?: number | null;
  /** 勝ち上がり演出で伸ばす線の元試合 */
  drawFromMatchId?: number | null;
}) {
  const layout = useMemo(() => computeLosersBoardLayout(data), [data]);
  const lives = [...new Set([liveMatchId, ...liveMatchIds].filter((id): id is number => id != null))];
  const calls = [...new Set([calledMatchId, ...calledMatchIds].filter((id): id is number => id != null))];
  const liveSet = new Set(lives);
  const callSet = new Set(calls);
  const pulseIds = new Set(pulseMatchIds);
  const focusRound = focusRoundOverride ?? venueFocusRound(data, 'losers', {
    liveMatchIds: lives,
    calledMatchIds: calls,
    highlightMatchId,
  });
  const focusRow = layout.rounds.find((round) => round.round === focusRound) ?? layout.rounds[0] ?? null;
  const drawLink = drawFromMatchId == null
    ? null
    : layout.connectors.find((connector) => connector.fromMatchId === drawFromMatchId) ?? null;
  const cameraKey = `${layout.width}x${layout.height}|${focusRound}|${frameMatchId ?? ''}|${drawFromMatchId ?? ''}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const appliedTransform = useRef('');

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const place = () => {
      const viewW = viewport.clientWidth;
      const viewH = viewport.clientHeight;
      const next = computeCamera(
        layout.width,
        layout.height,
        viewW,
        viewH,
        focusRow?.y ?? null,
      );
      if (!next || appliedTransform.current === next) return;
      track.style.transformOrigin = '0 0';
      track.style.transition = 'none';
      track.style.transform = next;
      appliedTransform.current = next;
    };
    place();
    const observer = new ResizeObserver(() => place());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cameraKey, focusRow, layout.height, layout.width]);

  if (layout.rounds.length === 0) {
    return (
      <div className="losers-viewport" aria-label="ルーザーズ">
        <p className="losers-empty">ルーザーズの試合はまだありません</p>
      </div>
    );
  }

  return (
    <div ref={viewportRef} className="losers-viewport" aria-label="ルーザーズ">
      <div
        ref={trackRef}
        className={`losers-track${frameMatchId == null ? '' : ' is-framed'}`}
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          className="losers-lines"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          {layout.connectors.map((connector) => {
            const hot = connector.fromMatchId === drawFromMatchId
              || connector.fromMatchId === frameMatchId
              || connector.toMatchId === frameMatchId
              || connector.toMatchId === highlightMatchId;
            const drawing = drawLink && connector.fromMatchId === drawFromMatchId;
            return (
              <path
                key={`${connector.fromMatchId}-${connector.toMatchId}`}
                d={connector.path}
                className={drawing ? 'losers-draw-line is-hot' : hot ? 'is-hot' : undefined}
              />
            );
          })}
        </svg>

        {layout.rounds.map((row) => (
          <div key={row.round} className="losers-round-row" data-round={row.round} style={{ top: row.y }}>
            <h3 className="losers-round-label">
              <span className="losers-round-num">{row.round}回戦</span>
            </h3>
            {row.matches.map((match) => {
              const state = matchStatus(match, liveSet, callSet);
              const framed = match.id === frameMatchId || match.id === drawFromMatchId;
              return (
                <article
                  key={match.id}
                  className={`losers-match${state === 'live' ? ' is-live' : ''}${match.id === highlightMatchId ? ' is-current' : ''}${pulseIds.has(match.id) ? ' is-pulse' : ''}${framed ? ' is-framed-match' : ''}${state === 'done' ? ' is-done' : ''}`}
                  data-match-id={match.id}
                  style={{ left: match.x, top: 36, width: match.w, height: match.h }}
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
                        faces={slot.teamId ? faceUrlByTeamId[slot.teamId] ?? [] : []}
                        label={slot.teamId ? labelByTeamId[slot.teamId] ?? '' : ''}
                        lost={slotLost(data, match.id, slotIndex)}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ))}

        {layout.grandFinal && (
          <div
            className="losers-gf"
            data-match-id={-1}
            style={{
              left: layout.grandFinal.x,
              top: layout.grandFinal.y,
              width: layout.grandFinal.w,
              height: layout.grandFinal.h,
            }}
          >
            グランドファイナルへ
          </div>
        )}
      </div>
    </div>
  );
}
