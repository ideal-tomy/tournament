import type { BracketKind } from '../features/bracket/layout';

/** B案: e-sports 寄りシアン × マゼンタ（02_DESIGN §2） */
export interface BracketSectionTheme {
  stroke: string;
  glow: string;
  fill: string;
  label: string;
  labelColor: string;
}

export const bracketTheme = {
  wb: {
    stroke: '#22d3ee',
    glow: '#22d3ee',
    fill: '#0c1929',
    label: 'WINNERS',
    labelColor: '#67e8f9',
  },
  lb: {
    stroke: '#fb7185',
    glow: '#f43f5e',
    fill: '#1a0f12',
    label: 'LOSERS',
    labelColor: '#fda4af',
  },
  gf: {
    stroke: '#e879f9',
    glow: '#d946ef',
    fill: '#1a0f1f',
    label: 'GRAND FINAL',
    labelColor: '#f0abfc',
  },
  current: {
    stroke: '#fef08a',
    glow: '#facc15',
    pulseClass: 'bracket-match-current',
  },
  completed: {
    stroke: '#86efac',
    opacity: 0.95,
    connectorWidth: 3,
  },
  pending: {
    connectorOpacity: 0.25,
    connectorWidth: 1.5,
  },
  drop: {
    stroke: '#fb923c',
    glow: '#fb923c',
    opacity: 0.45,
    dash: '6 4',
  },
  background: '#030712',
  grid: '#1e293b',
} as const;

export function themeForBracket(kind: BracketKind): BracketSectionTheme {
  if (kind === 'winner') return bracketTheme.wb;
  if (kind === 'loser') return bracketTheme.lb;
  return bracketTheme.gf;
}
