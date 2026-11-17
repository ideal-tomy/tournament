import type { CSSProperties } from 'react';
import nameplate from '../../../../public/images/プレート01.png';

/** Pair-confirmed plate recipe at full size. Other scenes only shrink this box. */
export const PAIR_PLATE_WIDTH = 1180;
export const PAIR_PLATE_HEIGHT = 394;
const TEXT_TOP = 170;
const TEXT_SIDE = 180;
const TEXT_SIZE = 72;
const TEXT_HEIGHT = 72;

export function plateMetrics(width: number) {
  const w = Math.max(1, width);
  const scale = w / PAIR_PLATE_WIDTH;
  return {
    width: w,
    height: w * (PAIR_PLATE_HEIGHT / PAIR_PLATE_WIDTH),
    textTop: TEXT_TOP * scale,
    textSide: TEXT_SIDE * scale,
    fontSize: TEXT_SIZE * scale,
    textHeight: TEXT_HEIGHT * scale,
  };
}

/** Decorative venue plate. Text sits on the black band using the pair recipe ratios. */
export default function VenueTeamNameplate({
  name,
  width = PAIR_PLATE_WIDTH,
  className = '',
  style,
}: {
  name: string;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const m = plateMetrics(width);
  return (
    <div
      className={`cer-venue-plate${className ? ` ${className}` : ''}`}
      style={{ ...style, width: m.width, height: m.height }}
    >
      <img className="cer-venue-plate-img" src={nameplate} alt="" />
      <p
        className="cer-venue-plate-name"
        style={{
          top: m.textTop,
          left: m.textSide,
          right: m.textSide,
          height: m.textHeight,
          fontSize: m.fontSize,
        }}
      >
        {name}
      </p>
    </div>
  );
}
