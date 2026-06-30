import {
  buildOrthogonalConnectorPath,
  computeBracketLayout,
  isConnectorHighlighted,
  resolveTeamId,
  type BracketKind,
  type StageData,
} from './layout';
import { bracketTheme, themeForBracket } from '../../styles/bracketTheme';
import placeholderFace from '../../assets/placeholder_face.svg';
import { toVerticalDisplayChars } from './verticalText';

interface BracketViewProps {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId?: Record<string, string[]>;
  currentMatchId?: number | null;
  compact?: boolean;
}

export default function BracketView({
  data,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId = {},
  currentMatchId = null,
  compact = false,
}: BracketViewProps) {
  const L = computeBracketLayout(data);

  const wbMatches = L.matches.filter((m) => m.bracket === 'winner');
  const lbMatches = L.matches.filter((m) => m.bracket === 'loser');
  const gfMatches = L.matches.filter((m) => m.bracket === 'grand_final');

  const bottomY = (ms: typeof L.matches) =>
    ms.length ? Math.max(...ms.map((m) => m.box.y + m.box.h)) : 0;
  const topY = (ms: typeof L.matches) =>
    ms.length ? Math.min(...ms.map((m) => m.box.y)) : 0;

  const sectionLabels = [
    wbMatches.length > 0 && {
      kind: 'winner' as BracketKind,
      x: wbMatches[0].box.x,
      y: bottomY(wbMatches) + 20,
      anchor: 'start' as const,
    },
    lbMatches.length > 0 && {
      kind: 'loser' as BracketKind,
      x: lbMatches[0].box.x,
      y: bottomY(lbMatches) + 20,
      anchor: 'start' as const,
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
      viewBox={`0 0 ${L.width} ${L.height}`}
      className={compact ? 'w-full h-auto max-h-48' : 'w-full h-full'}
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
            fontSize={14}
            fontWeight="800"
            letterSpacing="0.12em"
          >
            {t.label}
          </text>
        );
      })}

      {L.connectors.map((c) => {
        const lit = isConnectorHighlighted(c, data);
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

      {L.matches.map((m) => {
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
              const teamId = resolveTeamId(s.teamRef, data.participant);
              const faces = teamId ? faceUrlByTeamId[teamId] ?? [] : [];
              const label = teamId ? labelByTeamId[teamId] ?? '' : '';
              const memberNames = teamId
                ? memberNamesByTeamId[teamId] ?? parseMemberNames(label)
                : [];
              const isBye = teamId == null && s.teamRef == null;
              const slotWon =
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
                    x={s.rect.x}
                    y={s.rect.y}
                    w={s.rect.w}
                    h={s.rect.h}
                    faces={faces}
                    memberNames={memberNames}
                    label={label}
                    isEmpty={isBye || (!teamId && s.teamRef == null)}
                    accent={theme.stroke}
                    compact={compact}
                    facesOnly={!m.isLeafRound}
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
  accent,
  compact,
  facesOnly = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  faces: string[];
  memberNames: string[];
  label: string;
  isEmpty: boolean;
  accent: string;
  compact: boolean;
  facesOnly?: boolean;
}) {
  const pad = compact || facesOnly ? 2 : 3;
  const cx = x + w / 2;
  const fontSize = compact ? 7 : 8;
  const faceSize = Math.min(
    w - pad * 2,
    facesOnly ? (compact ? 12 : 14) : compact ? 16 : 20,
  );
  const faceGap = facesOnly ? 1 : 2;

  if (isEmpty) {
    if (facesOnly) return null;
    return (
      <g>
        <image
          href={placeholderFace}
          x={cx - faceSize / 2}
          y={y + pad + 4}
          width={faceSize}
          height={faceSize}
          opacity={0.35}
        />
        <VerticalText
          x={cx}
          y={y + pad + faceSize + 12}
          text="BYE"
          fontSize={fontSize}
          fill="#64748b"
          maxHeight={h - faceSize - pad * 2 - 14}
        />
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
  const count = Math.max(faceUrls.length, names.length);
  const displayFaces = Array.from(
    { length: count },
    (_, i) => faceUrls[i] ?? placeholderFace,
  );
  const nameColumn = names.join('・');

  let faceBottom = y + pad + (facesOnly ? 1 : 2);
  const faceNodes = displayFaces.map((faceUrl, i) => {
    const faceY = faceBottom + i * (faceSize + faceGap);
    return (
      <g key={`face-${i}-${faceUrl}`}>
        <rect
          x={cx - faceSize / 2 - 1}
          y={faceY - 1}
          width={faceSize + 2}
          height={faceSize + 2}
          fill="none"
          stroke={accent}
          strokeOpacity={facesOnly ? 0.75 : 0.55}
          rx={2}
        />
        <image
          href={faceUrl}
          x={cx - faceSize / 2}
          y={faceY}
          width={faceSize}
          height={faceSize}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  });
  faceBottom += count * faceSize + Math.max(0, count - 1) * faceGap;

  if (facesOnly) {
    return (
      <g>
        <title>{label}</title>
        {faceNodes}
      </g>
    );
  }

  const nameY = faceBottom + (compact ? 4 : 6);
  const nameMaxH = y + h - pad - nameY;

  return (
    <g>
      <title>{label}</title>
      {faceNodes}
      {nameColumn && (
        <VerticalText
          x={cx}
          y={nameY}
          text={nameColumn}
          fontSize={fontSize}
          fill="#f1f5f9"
          maxHeight={nameMaxH}
          stroke="#0f172a"
          strokeWidth={2}
        />
      )}
    </g>
  );
}

/** SVG 縦書き（1 文字ずつ下方向） */
function VerticalText({
  x,
  y,
  text,
  fontSize,
  fill,
  maxHeight,
  stroke,
  strokeWidth,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  maxHeight: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  const lineHeight = fontSize * 1.12;
  const maxChars = Math.max(1, Math.floor(maxHeight / lineHeight));
  const allChars = toVerticalDisplayChars(text);
  const chars = allChars.slice(0, maxChars);
  const truncated = allChars.length > maxChars;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={fill}
      fontSize={fontSize}
      fontWeight="600"
      stroke={stroke}
      strokeWidth={strokeWidth}
      paintOrder={stroke ? 'stroke' : undefined}
    >
      {chars.map((ch, i) => (
        <tspan key={`${ch}-${i}`} x={x} dy={i === 0 ? 0 : lineHeight}>
          {ch}
        </tspan>
      ))}
      {truncated && (
        <tspan x={x} dy={lineHeight}>
          …
        </tspan>
      )}
    </text>
  );
}

function parseMemberNames(label: string): string[] {
  if (!label) return [];
  if (label.includes(' & ')) return label.split(' & ').map((s) => s.trim());
  if (label.includes('・')) return label.split('・').map((s) => s.trim());
  if (label.includes('、')) return label.split('、').map((s) => s.trim());
  return [label];
}
