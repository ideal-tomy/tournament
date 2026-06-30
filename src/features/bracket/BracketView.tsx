import {
  computeBracketLayout,
  resolveTeamId,
  type BracketKind,
  type StageData,
} from './layout';

const BRACKET_STROKE: Record<BracketKind, string> = {
  winner: '#38bdf8',
  loser: '#fb923c',
  grand_final: '#f472b6',
};

interface BracketViewProps {
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
}

export default function BracketView({
  data,
  faceUrlByTeamId,
  labelByTeamId,
}: BracketViewProps) {
  const L = computeBracketLayout(data);

  return (
    <svg
      viewBox={`0 0 ${L.width} ${L.height}`}
      className="w-full h-auto text-slate-300"
      role="img"
      aria-label="トーナメント表"
    >
      {L.connectors.map((c) => (
        <line
          key={`${c.fromMatchId}-${c.toMatchId}`}
          x1={c.from.x}
          y1={c.from.y}
          x2={c.to.x}
          y2={c.to.y}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={2}
        />
      ))}

      {L.matches.map((m) => {
        const stroke = BRACKET_STROKE[m.bracket];
        return (
          <g
            key={m.matchId}
            data-match-id={m.matchId}
            data-bracket={m.bracket}
            data-center-x={m.center.x}
            data-center-y={m.center.y}
          >
            <rect
              x={m.box.x}
              y={m.box.y}
              width={m.box.w}
              height={m.box.h}
              fill="#0f172a"
              fillOpacity={0.6}
              stroke={stroke}
              strokeWidth={2}
              rx={4}
            />
            {m.slots.map((s) => {
              const teamId = resolveTeamId(s.teamRef, data.participant);
              const faces = teamId ? faceUrlByTeamId[teamId] ?? [] : [];
              const label = teamId ? labelByTeamId[teamId] ?? '' : '';
              const isBye = teamId == null && s.teamRef == null;

              return (
                <g
                  key={s.slot}
                  data-slot={s.slot}
                  data-center-x={s.center.x}
                  data-center-y={s.center.y}
                >
                  <rect
                    x={s.rect.x}
                    y={s.rect.y}
                    width={s.rect.w}
                    height={s.rect.h}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={0.4}
                  />
                  <SlotContent
                    x={s.rect.x}
                    y={s.rect.y}
                    w={s.rect.w}
                    h={s.rect.h}
                    faces={faces}
                    label={label}
                    isEmpty={isBye || (!teamId && s.teamRef == null)}
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
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  faces: string[];
  label: string;
  isEmpty: boolean;
}) {
  const pad = 4;
  const faceSize = Math.min(36, h - pad * 2, (w - pad * 2) / Math.max(faces.length, 1));

  if (isEmpty) {
    return (
      <g>
        <rect
          x={x + w / 2 - faceSize / 2}
          y={y + pad}
          width={faceSize}
          height={faceSize}
          fill="#334155"
          rx={4}
        />
        <text
          x={x + w / 2}
          y={y + pad + faceSize / 2 + 5}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={16}
          fontWeight="bold"
        >
          ?
        </text>
        <text
          x={x + pad}
          y={y + h - pad}
          fill="#64748b"
          fontSize={11}
        >
          BYE
        </text>
      </g>
    );
  }

  const facesTotalW = faces.length * faceSize + (faces.length - 1) * 4;
  let fx = x + (w - facesTotalW) / 2;

  return (
    <g>
      {faces.map((url) => {
        const cx = fx;
        fx += faceSize + 4;
        return (
          <image
            key={url}
            href={url}
            x={cx}
            y={y + pad}
            width={faceSize}
            height={faceSize}
            preserveAspectRatio="xMidYMid slice"
          />
        );
      })}
      {faces.length === 0 && (
        <rect
          x={x + pad}
          y={y + pad}
          width={faceSize}
          height={faceSize}
          fill="#334155"
          rx={4}
        />
      )}
      <text
        x={x + pad}
        y={y + h - pad}
        fill="#e2e8f0"
        fontSize={11}
        fontWeight="500"
      >
        {truncate(label, 22)}
      </text>
    </g>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
