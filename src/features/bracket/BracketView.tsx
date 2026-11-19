import {
  buildOrthogonalConnectorPath,
  activeLeafRound,
  computeBracketLayout,
  isConnectorHighlighted,
  resolveTeamId,
  slotPresence,
  visibleMatchIdsWhenOmitCompleted,
  type BracketBoardSide,
  type BracketKind,
  type StageData,
} from './layout';
import { bracketTheme, themeForBracket } from '../../styles/bracketTheme';
import placeholderFace from '../../assets/placeholder_face.svg';

export function frameViewBox(matches: { box: { x: number; y: number; w: number; h: number } }[]): string {
  if (!matches.length) return '0 0 1 1';
  const left = Math.min(...matches.map((m) => m.box.x)) - 28;
  const top = Math.min(...matches.map((m) => m.box.y)) - 40;
  const right = Math.max(...matches.map((m) => m.box.x + m.box.w)) + 28;
  const bottom = Math.max(...matches.map((m) => m.box.y + m.box.h)) + 24;
  return `${left} ${top} ${Math.max(1, right - left)} ${Math.max(1, bottom - top)}`;
}

interface BracketViewProps {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId?: Record<string, string[]>;
  currentMatchId?: number | null;
  compact?: boolean;
  /** 棒上昇演出中は勝ち上がり線のハイライトを抑止 */
  suppressConnectorHighlight?: boolean;
  /** Presentation only: keep frozen/updated layers in the same coordinate space. */
  layoutData?: StageData;
  /** 終わった試合を消して、残りの表全体を画面に収める */
  omitCompleted?: boolean;
  /** 勝ち上がり演出のあいだだけ残す試合 */
  retainMatchIds?: number[];
  /** 章に合わせて片方だけ大きく出す */
  boardSide?: BracketBoardSide;
  clipPrefix?: string;
  /** 終わった下の回戦は残したまま、いまの段を初戦と同じ大きさで中央に出す */
  activeRound?: boolean;
  /** 演出側がカメラの枠を渡す */
  viewBox?: string;
  svgClassName?: string;
  /** この勝ち上がり線は、演出の光が描くので表側では点灯しない */
  mutedConnector?: { fromMatchId: number; toMatchId: number } | null;
}

export default function BracketView({
  data,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId = {},
  currentMatchId = null,
  compact = false,
  suppressConnectorHighlight = false,
  layoutData,
  omitCompleted = false,
  retainMatchIds = [],
  boardSide = 'all',
  clipPrefix = 'slot',
  activeRound = false,
  viewBox: viewBoxOverride,
  svgClassName,
  mutedConnector = null,
}: BracketViewProps) {
  const retain = new Set(retainMatchIds);
  const layoutSource = layoutData ?? data;
  const leafRound = activeRound && boardSide === 'winners' ? activeLeafRound(data, 'winner') : 1;
  const focus =
    leafRound > 1
      ? { leafRound }
      : omitCompleted
        ? { visibleMatchIds: visibleMatchIdsWhenOmitCompleted(data, boardSide, retainMatchIds) }
        : undefined;
  const L = computeBracketLayout(layoutSource, undefined, boardSide, focus);
  const shown = L.matches.filter((m) => {
    if (!omitCompleted) return true;
    const bm = data.match.find((row) => row.id === m.matchId);
    if (bm == null || bm.status < 4) return true;
    return retain.has(m.matchId);
  });
  const framed = shown.length ? shown : L.matches;
  const viewBox = viewBoxOverride ?? (leafRound > 1 ? `0 0 ${L.width} ${L.height}` : frameViewBox(framed));

  const wbMatches = shown.filter((m) => m.bracket === 'winner');
  const lbMatches = shown.filter((m) => m.bracket === 'loser');
  const gfMatches = shown.filter((m) => m.bracket === 'grand_final');

  const bottomY = (ms: typeof L.matches) =>
    ms.length ? Math.max(...ms.map((m) => m.box.y + m.box.h)) : 0;
  const topY = (ms: typeof L.matches) =>
    ms.length ? Math.min(...ms.map((m) => m.box.y)) : 0;
  const midX = (ms: typeof L.matches) => {
    const left = Math.min(...ms.map((m) => m.box.x));
    const right = Math.max(...ms.map((m) => m.box.x + m.box.w));
    return (left + right) / 2;
  };

  const sectionLabels = [
    wbMatches.length > 0 && {
      kind: 'winner' as BracketKind,
      x: midX(wbMatches),
      y: bottomY(wbMatches) + 22,
      anchor: 'middle' as const,
    },
    lbMatches.length > 0 && {
      kind: 'loser' as BracketKind,
      x: midX(lbMatches),
      y: bottomY(lbMatches) + 22,
      anchor: 'middle' as const,
    },
    gfMatches.length > 0 && {
      kind: 'grand_final' as BracketKind,
      x: gfMatches[0].box.x + gfMatches[0].box.w / 2,
      y: topY(gfMatches) - 12,
      anchor: 'middle' as const,
    },
  ].filter(Boolean) as {
    kind: BracketKind;
    x: number;
    y: number;
    anchor: 'start' | 'middle';
  }[];

  return (
    <svg
      viewBox={viewBox}
      className={`${compact ? 'w-full h-auto max-h-48' : 'w-full h-full'}${svgClassName ? ` ${svgClassName}` : ''}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="トーナメント表"
    >
      <defs>
        <filter id="bracket-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bracket-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {sectionLabels.map((s) => {
        const t = themeForBracket(s.kind);
        return (
          <text
            key={s.kind}
            x={s.x}
            y={s.y}
            textAnchor={s.anchor}
            fill={t.labelColor}
            fontSize={18}
            fontWeight="900"
            letterSpacing="0.08em"
          >
            {t.label}
          </text>
        );
      })}

      {L.connectors.map((c) => {
        const visibleIds = new Set(shown.map((m) => m.matchId));
        if (!visibleIds.has(c.fromMatchId) || !visibleIds.has(c.toMatchId)) return null;
        const muted = mutedConnector?.fromMatchId === c.fromMatchId && mutedConnector.toMatchId === c.toMatchId;
        const lit = !muted && !suppressConnectorHighlight && isConnectorHighlighted(c, data);
        const isDrop = c.kind === 'drop';
        const stroke = isDrop
          ? bracketTheme.drop.stroke
          : lit
            ? bracketTheme.completed.stroke
            : bracketTheme.wb.stroke;
        const opacity = isDrop
          ? bracketTheme.drop.opacity
          : lit
            ? bracketTheme.completed.opacity
            : bracketTheme.pending.connectorOpacity;
        const width = lit
          ? bracketTheme.completed.connectorWidth
          : bracketTheme.pending.connectorWidth;

        return (
          <path
            key={`${c.kind}-${c.fromMatchId}-${c.toMatchId}`}
            d={buildOrthogonalConnectorPath(c.from, c.to)}
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={width}
            strokeDasharray={isDrop ? bracketTheme.drop.dash : undefined}
            filter={lit ? 'url(#bracket-glow)' : undefined}
          />
        );
      })}

      {shown.map((m) => {
        const theme = themeForBracket(m.bracket);
        const isCurrent = currentMatchId != null && m.matchId === currentMatchId;
        const bm = data.match.find((x) => x.id === m.matchId);
        const isDone = bm != null && bm.status >= 4;

        return (
          <g
            key={m.matchId}
            data-match-id={m.matchId}
            data-bracket={m.bracket}
            data-center-x={m.center.x}
            data-center-y={m.center.y}
            className={isCurrent ? bracketTheme.current.pulseClass : undefined}
            opacity={omitCompleted ? undefined : isDone ? 0.45 : undefined}
          >
            <rect
              x={m.box.x}
              y={m.box.y}
              width={m.box.w}
              height={m.box.h}
              fill={theme.fill}
              fillOpacity={isDone ? 0.9 : 0.75}
              stroke={isCurrent ? bracketTheme.current.stroke : theme.stroke}
              strokeWidth={isCurrent ? 2.5 : 1.5}
              rx={3}
              filter={isCurrent ? 'url(#bracket-glow-strong)' : undefined}
            />
            <line
              x1={m.box.x + m.box.w / 2}
              y1={m.box.y + 2}
              x2={m.box.x + m.box.w / 2}
              y2={m.box.y + m.box.h - 2}
              stroke={theme.stroke}
              strokeOpacity={0.35}
              strokeWidth={1}
              visibility={m.isLeafRound ? undefined : 'hidden'}
            />
            {m.slots.map((s) => {
              const teamRef=layoutData?(s.slot===0?bm?.opponent1?.id:bm?.opponent2?.id)??null:s.teamRef;
              const teamId = resolveTeamId(teamRef, data.participant);
              const faces = teamId ? faceUrlByTeamId[teamId] ?? [] : [];
              const label = teamId ? labelByTeamId[teamId] ?? '' : '';
              const memberNames = teamId
                ? memberNamesByTeamId[teamId] ?? parseMemberNames(label)
                : [];
              const presence = bm ? slotPresence(bm, s.slot) : teamId ? 'team' : 'empty';
              const showWait = presence === 'waiting' && m.bracket === 'loser';
              const otherWaiting = presence === 'team' && m.bracket === 'loser' && bm != null && slotPresence(bm, s.slot === 0 ? 1 : 0) === 'waiting';
              const draw = otherWaiting
                ? {
                    x: m.box.x + (s.slot === 0 ? 2 : m.box.w * 0.34),
                    y: s.rect.y,
                    w: m.box.w * 0.64,
                    h: s.rect.h,
                  }
                : s.rect;
              const played = bm?.opponent1?.id != null && bm?.opponent2?.id != null;
              const slotWon =
                played &&
                bm &&
                ((s.slot === 0 && bm.opponent1?.result === 'win') ||
                  (s.slot === 1 && bm.opponent2?.result === 'win'));
              const slotLost =
                bm &&
                ((s.slot === 0 && bm.opponent1?.result === 'loss') ||
                  (s.slot === 1 && bm.opponent2?.result === 'loss'));

              return (
                <g
                  key={s.slot}
                  data-slot={s.slot}
                  data-team-id={teamId??''}
                  data-center-x={s.center.x}
                  data-center-y={s.center.y}
                  opacity={slotLost ? 0.4 : 1}
                >
                  {slotWon && (
                    <rect
                      x={s.rect.x + 1}
                      y={s.rect.y + 1}
                      width={s.rect.w - 2}
                      height={s.rect.h - 2}
                      fill={theme.stroke}
                      fillOpacity={0.15}
                      rx={2}
                    />
                  )}
                  <VerticalSlotContent
                    x={draw.x}
                    y={draw.y}
                    w={draw.w}
                    h={draw.h}
                    faces={faces}
                    memberNames={memberNames}
                    label={label}
                    isEmpty={presence !== 'team'}
                    waiting={showWait}
                    accent={theme.stroke}
                    compact={compact}
                    clipId={`${clipPrefix}-${m.matchId}-${s.slot}`}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** 1 チーム分の縦長柱: 最下段=顔+名前 / 上段=顔のみ */
function VerticalSlotContent({
  x,
  y,
  w,
  h,
  faces,
  memberNames,
  label,
  isEmpty,
  waiting = false,
  compact,
  clipId,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  faces: string[];
  memberNames: string[];
  label: string;
  isEmpty: boolean;
  waiting?: boolean;
  accent?: string;
  compact: boolean;
  clipId: string;
}) {
  const pad = 1;
  const cx = x + w / 2;
  const faceGap = 1;

  if (waiting) {
    const size = Math.max(8, Math.min(13, w / 4));
    return (
      <text x={cx} y={y + h / 2} textAnchor="middle" fill="#fde68a" fontSize={size} fontWeight="700">
        <tspan x={cx} dy={-size * 0.7}>対戦相手</tspan>
        <tspan x={cx} dy={size * 1.3}>待ち</tspan>
      </text>
    );
  }

  if (isEmpty) {
    const byeSize = Math.min(w - pad * 2, compact ? 16 : 20);
    return (
      <g>
        <clipPath id={clipId}><rect x={x} y={y} width={w} height={h} /></clipPath>
        <g clipPath={`url(#${clipId})`}>
        <image
          href={placeholderFace}
          x={cx - byeSize / 2}
          y={y + pad + 2}
          width={byeSize}
          height={byeSize}
          opacity={0.35}
        />
        </g>
      </g>
    );
  }

  const names =
    memberNames.length > 0
      ? memberNames
      : parseMemberNames(label).length > 0
        ? parseMemberNames(label)
        : [label || '?'];

  const faceUrls =
    faces.length > 0 ? faces : names.map(() => placeholderFace);
  const count = Math.min(2, Math.max(faceUrls.length, names.length, 1));
  const displayFaces = Array.from(
    { length: count },
    (_, i) => faceUrls[i] ?? placeholderFace,
  );
  const teamLabel = label || names.join('・');
  const glyphs = Math.max(1, Array.from(teamLabel).length);
  const nameSize = teamLabel ? Math.max(1, Math.min(h * 0.28, (w - 2) / glyphs)) : 0;
  const nameBand = nameSize * 1.35;
  const faceW = Math.max(1, w - pad * 2);
  const faceH = Math.max(1, Math.floor((h - pad * 2 - nameBand - faceGap * Math.max(0, count - 1)) / count));
  const faceTop = y + pad;
  const faceNodes = displayFaces.map((faceUrl, i) => (
    <image
      key={`face-${i}-${faceUrl}`}
      href={faceUrl}
      x={x + pad}
      y={faceTop + i * (faceH + faceGap)}
      width={faceW}
      height={faceH}
      preserveAspectRatio="xMidYMid slice"
    />
  ));

  return (
    <g>
      <clipPath id={clipId}><rect x={x} y={y} width={w} height={h} /></clipPath>
      <g clipPath={`url(#${clipId})`}>
      <title>{teamLabel}</title>
      {faceNodes}
      {teamLabel && (
        <text
          x={cx}
          y={y + h - pad}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize={nameSize}
          fontWeight="700"
          stroke="#0f172a"
          strokeWidth={Math.max(0.4, nameSize * 0.12)}
          paintOrder="stroke"
        >
          {teamLabel}
        </text>
      )}
      </g>
    </g>
  );
}

function parseMemberNames(label: string): string[] {
  if (!label) return [];
  if (label.includes(' & ')) return label.split(' & ').map((s) => s.trim());
  if (label.includes('・')) return label.split('・').map((s) => s.trim());
  if (label.includes('、')) return label.split('、').map((s) => s.trim());
  return [label];
}
