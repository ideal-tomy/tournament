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
  currentMatchId?: number | null;
  compact?: boolean;
}

export default function BracketView({
  data,
  faceUrlByTeamId,
  labelByTeamId,
  currentMatchId = null,
  compact = false,
}: BracketViewProps) {
  const L = computeBracketLayout(data);

  const wbMatches = L.matches.filter((m) => m.bracket === 'winner');
  const lbMatches = L.matches.filter((m) => m.bracket === 'loser');
  const gfMatches = L.matches.filter((m) => m.bracket === 'grand_final');

  const sectionLabels = [
    wbMatches.length > 0 && {
      kind: 'winner' as BracketKind,
      x: wbMatches[0].box.x,
      y: wbMatches[0].box.y - 28,
    },
    lbMatches.length > 0 && {
      kind: 'loser' as BracketKind,
      x: lbMatches[0].box.x,
      y: lbMatches[0].box.y - 28,
    },
    gfMatches.length > 0 && {
      kind: 'grand_final' as BracketKind,
      x: gfMatches[0].box.x,
      y: gfMatches[0].box.y - 28,
    },
  ].filter(Boolean) as { kind: BracketKind; x: number; y: number }[];

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
              fillOpacity={isDone ? 0.85 : 0.65}
              stroke={isCurrent ? bracketTheme.current.stroke : theme.stroke}
              strokeWidth={isCurrent ? 3 : 2}
              rx={6}
              filter={isCurrent ? 'url(#bracket-glow-strong)' : undefined}
            />
            {m.slots.map((s) => {
              const teamId = resolveTeamId(s.teamRef, data.participant);
              const faces = teamId ? faceUrlByTeamId[teamId] ?? [] : [];
              const label = teamId ? labelByTeamId[teamId] ?? '' : '';
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
                  opacity={slotLost ? 0.45 : 1}
                >
                  <rect
                    x={s.rect.x}
                    y={s.rect.y}
                    width={s.rect.w}
                    height={s.rect.h}
                    fill={slotWon ? theme.stroke : 'none'}
                    fillOpacity={slotWon ? 0.12 : 0}
                    stroke={theme.stroke}
                    strokeOpacity={0.35}
                  />
                  <SlotContent
                    x={s.rect.x}
                    y={s.rect.y}
                    w={s.rect.w}
                    h={s.rect.h}
                    faces={faces}
                    label={label}
                    isEmpty={isBye || (!teamId && s.teamRef == null)}
                    accent={theme.stroke}
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

function SlotContent({
  x,
  y,
  w,
  h,
  faces,
  label,
  isEmpty,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  faces: string[];
  label: string;
  isEmpty: boolean;
  accent: string;
}) {
  const pad = 4;
  const faceCount = Math.max(faces.length, isEmpty ? 1 : 0);
  const gap = faces.length >= 3 ? 2 : 4;
  const faceSize = Math.min(
    faces.length >= 3 ? 28 : 36,
    h - pad * 2 - 14,
    (w - pad * 2 - gap * (faceCount - 1)) / Math.max(faceCount, 1),
  );

  if (isEmpty) {
    return (
      <g>
        <image
          href={placeholderFace}
          x={x + w / 2 - faceSize / 2}
          y={y + pad}
          width={faceSize}
          height={faceSize}
        />
        <text
          x={x + w / 2}
          y={y + pad + faceSize / 2 + 4}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={14}
          fontWeight="bold"
        >
          ?
        </text>
        <text x={x + pad} y={y + h - 4} fill="#64748b" fontSize={10} fontWeight="600">
          BYE
        </text>
      </g>
    );
  }

  const facesTotalW = faces.length * faceSize + (faces.length - 1) * gap;
  let fx = x + (w - facesTotalW) / 2;

  const { line1, line2 } = splitLabel(label, w - pad * 2);

  return (
    <g>
      {faces.length > 0
        ? faces.map((url) => {
            const cx = fx;
            fx += faceSize + gap;
            return (
              <g key={url}>
                <rect
                  x={cx - 1}
                  y={y + pad - 1}
                  width={faceSize + 2}
                  height={faceSize + 2}
                  fill="none"
                  stroke={accent}
                  strokeOpacity={0.5}
                  rx={4}
                />
                <image
                  href={url}
                  x={cx}
                  y={y + pad}
                  width={faceSize}
                  height={faceSize}
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
            );
          })
        : (
          <image
            href={placeholderFace}
            x={x + pad}
            y={y + pad}
            width={faceSize}
            height={faceSize}
          />
        )}
      <text
        x={x + w / 2}
        y={y + h - (line2 ? 16 : 6)}
        textAnchor="middle"
        fill="#f1f5f9"
        fontSize={10}
        fontWeight="600"
        stroke="#0f172a"
        strokeWidth={2}
        paintOrder="stroke"
      >
        <title>{label}</title>
        {line1}
      </text>
      {line2 && (
        <text
          x={x + w / 2}
          y={y + h - 4}
          textAnchor="middle"
          fill="#f1f5f9"
          fontSize={10}
          fontWeight="600"
          stroke="#0f172a"
          strokeWidth={2}
          paintOrder="stroke"
        >
          {line2}
        </text>
      )}
    </g>
  );
}

function splitLabel(label: string, maxWidth: number): { line1: string; line2: string | null } {
  const maxChars = Math.max(8, Math.floor(maxWidth / 6));
  if (label.length <= maxChars) return { line1: label, line2: null };

  const sep = label.includes(' & ') ? ' & ' : label.includes('、') ? '、' : ' ';
  const parts = label.split(sep);
  if (parts.length >= 2) {
    const half = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, half).join(sep);
    const line2 = parts.slice(half).join(sep);
    if (line1.length <= maxChars + 4 && line2.length <= maxChars + 4) {
      return { line1, line2 };
    }
  }

  const line1 = truncate(label, maxChars);
  return { line1, line2: null };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
