import placeholder from '../assets/placeholder_face.svg';

export const sampleWinner = {
  name: 'BLUE ARROWS', members: ['青木 サンプル', '佐藤 サンプル'], faces: [placeholder, placeholder],
};
export const sampleOpponent = {
  name: 'GOLD STARS', members: ['高橋 サンプル', '田中 サンプル'], faces: [placeholder, placeholder],
};
export const longWinner = {
  name: 'サンプル・チャンピオンチーム', members: ['長い名前のサンプル選手 太郎', '長い名前のサンプル選手 花子'], faces: [placeholder, placeholder],
};
export const scenes = ['draw', 'result', 'bracket', 'vs', 'next', 'champion'] as const;
export type Scene = typeof scenes[number];
export type Selection = Scene | 'all';
export const labels: Record<Selection, string> = {
  draw: 'Draw', result: 'Result', bracket: 'Bracket advance', vs: 'VS', next: 'NEXT MATCH', champion: 'Champion', all: '全体を通し再生',
};
