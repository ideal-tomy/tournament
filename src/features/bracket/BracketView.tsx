import {
  computeBracketLayout,
  isConnectorHighlighted,
  resolveTeamId,
  type BracketKind,
  type StageData,
} from './layout';
import { bracketTheme, themeForBracket } from '../../styles/bracketTheme';
import placeholderFace from '../../assets/placeholder_face.svg';

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
          <line
            key={`${c.kind}-${c.fromMatchId}-${c.toMatchId}`}
            x1={c.from.x}
            y1={c.from.y}
            x2={c.to.x}
            y2={c.to.y}
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

/** 縦長スロット: 顔写真 + 縦書き名前（2人組は列を分割） */
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
}) {
  const pad = compact ? 2 : 3;

  if (isEmpty) {
    const faceSize = Math.min(w - pad * 2, 28);
    return (
      <g>
        <image
          href={placeholderFace}
          x={x + w / 2 - faceSize / 2}
          y={y + pad + 4}
          width={faceSize}
          height={faceSize}
          opacity={0.35}
        />
        <VerticalText
          x={x + w / 2}
          y={y + pad + faceSize + 14}
          text="BYE"
          fontSize={compact ? 8 : 9}
          fill="#64748b"
          maxHeight={h - faceSize - pad * 2 - 10}
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

  const count = Math.max(names.length, faces.length, 1);
  const colW = (w - pad * 2) / count;
  const fontSize = compact ? 7 : 9;
  const faceSize = Math.min(colW - 4, compact ? 22 : 28);

  return (
    <g>
      <title>{label}</title>
      {Array.from({ length: count }, (_, i) => {
        const colX = x + pad + i * colW + colW / 2;
        const faceUrl = faces[i] ?? placeholderFace;
        const name = names[i] ?? '';
        const faceY = y + pad + 2;
        const nameY = faceY + faceSize + (compact ? 6 : 8);
        const nameMaxH = y + h - pad - nameY;

        return (
          <g key={`${colX}-${i}`}>
            <rect
              x={colX - faceSize / 2 - 1}
              y={faceY - 1}
              width={faceSize + 2}
              height={faceSize + 2}
              fill="none"
              stroke={accent}
              strokeOpacity={0.55}
              rx={2}
            />
            <image
              href={faceUrl}
              x={colX - faceSize / 2}
              y={faceY}
              width={faceSize}
              height={faceSize}
              preserveAspectRatio="xMidYMid slice"
            />
            {name && (
              <VerticalText
                x={colX}
                y={nameY}
                text={name}
                fontSize={fontSize}
                fill="#f1f5f9"
                maxHeight={nameMaxH}
                stroke="#0f172a"
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}
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
  const chars = [...text].slice(0, maxChars);
  const truncated = text.length > maxChars;

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
