import type { BracketKind } from '../features/bracket/layout';
import type { BracketThemeKey } from '../types';

/** B案 + v2 W/L/GF テーマ（要件 3.3） */
export interface BracketSectionTheme {
  stroke: string;
  glow: string;
  fill: string;
  label: string;
  labelColor: string;
  frame: 'solid' | 'dashed' | 'double';
  accent: string;
}

export const BRACKET_THEME_BY_KEY: Record<BracketThemeKey, BracketSectionTheme> = {
  winners: {
    accent: '#22d3ee',
    stroke: '#22d3ee',
    glow: '#22d3ee',
    fill: '#0c1929',
    label: 'WINNERS',
    labelColor: '#67e8f9',
    frame: 'solid',
  },
  losers: {
    accent: '#f472b6',
    stroke: '#fb7185',
    glow: '#f43f5e',
    fill: '#1a0f12',
    label: 'LOSERS',
    labelColor: '#fda4af',
    frame: 'dashed',
  },
  grand_final: {
    accent: '#fbbf24',
    stroke: '#fbbf24',
    glow: '#f59e0b',
    fill: '#1a1408',
    label: 'GRAND FINAL',
    labelColor: '#fde68a',
    frame: 'double',
  },
};

export const bracketTheme = {
  wb: BRACKET_THEME_BY_KEY.winners,
  lb: BRACKET_THEME_BY_KEY.losers,
  gf: BRACKET_THEME_BY_KEY.grand_final,
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
  if (kind === 'winner') return BRACKET_THEME_BY_KEY.winners;
  if (kind === 'loser') return BRACKET_THEME_BY_KEY.losers;
  return BRACKET_THEME_BY_KEY.grand_final;
}

export function themeForKey(key: BracketThemeKey): BracketSectionTheme {
  return BRACKET_THEME_BY_KEY[key];
}

export function kindToThemeKey(kind: BracketKind): BracketThemeKey {
  if (kind === 'winner') return 'winners';
  if (kind === 'loser') return 'losers';
  return 'grand_final';
}

/** CSS 変数として DOM に流し込む */
export function bracketThemeCssVars(
  key: BracketThemeKey,
  override?: Partial<Record<string, string>>,
): Record<string, string> {
  const t = themeForKey(key);
  return {
    '--bracket-accent': override?.accent ?? t.accent,
    '--bracket-stroke': override?.stroke ?? t.stroke,
    '--bracket-label': override?.labelColor ?? t.labelColor,
    '--bracket-fill': override?.fill ?? t.fill,
  };
}

export function roundBannerText(key: BracketThemeKey, round: number): string {
  if (key === 'grand_final') return 'GRAND FINAL';
  const base = key === 'winners' ? 'WINNERS' : 'LOSERS';
  return `${base} ROUND ${round}`;
}
