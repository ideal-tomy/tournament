export type PresentationAction = 'highlight' | 'click' | 'wait' | 'transition';

export interface PresentationStep {
  id: string;
  title: string;
  description: string;
  target: string;
  action: PresentationAction;
  duration: number;
  tooltip: string;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
}

export const PRESENTATION_STEPS: readonly PresentationStep[] = [
  {
    id: 'overview',
    title: 'このシステムでできること',
    description: '参加者登録からペア抽選、トーナメント進行、試合演出までを一つの流れで運営できます。',
    target: 'guide-overview',
    action: 'highlight',
    duration: 6000,
    tooltip: '大会運営の全体像を約90秒で紹介します',
  },
  {
    id: 'registration',
    title: '参加者登録',
    description: '大会前に参加者を登録します。名前と顔写真は抽選・対戦カード・勝者演出に利用されます。',
    target: 'participant-registration',
    action: 'click',
    duration: 6000,
    tooltip: 'まず参加者登録を開きます',
    tooltipPlacement: 'bottom',
  },
  {
    id: 'photo-and-name',
    title: '顔写真・名前登録',
    description: 'カメラで撮影し、参加者名とレーティングを登録します。この説明モードではサンプル表示だけで保存しません。',
    target: 'participant-form',
    action: 'highlight',
    duration: 6500,
    tooltip: '写真・名前・レーティングを登録',
    tooltipPlacement: 'right',
  },
  {
    id: 'draw-start',
    title: '大会開始 / ペア抽選',
    description: '全員が揃ったらレーティング差を抑えたチームを確認し、組み合わせ発表を開始します。',
    target: 'draw-start',
    action: 'click',
    duration: 6000,
    tooltip: '確定すると大型画面の演出が始まります',
    tooltipPlacement: 'top',
  },
  {
    id: 'dart-impact',
    title: 'ダーツ抽選演出',
    description: 'カード裏面へダーツが飛来し、着弾・光・火花のインパクトを約2秒見せてから反転します。',
    target: 'dart-card',
    action: 'wait',
    duration: 8000,
    tooltip: 'DART IMPACT',
  },
  {
    id: 'player-reveal',
    title: 'プレイヤー Reveal',
    description: 'カードが反転すると、抽選されたプレイヤーの顔写真と名前が表示されます。表面ではダーツや穴を残しません。',
    target: 'player-reveal',
    action: 'highlight',
    duration: 6500,
    tooltip: '顔写真と名前をはっきり表示',
  },
  {
    id: 'pair-confirmed',
    title: 'PAIR CONFIRMED',
    description: '2人が決定するとペア確定演出を表示し、観客と運営者が組み合わせを確認できます。',
    target: 'pair-confirmed',
    action: 'wait',
    duration: 7500,
    tooltip: 'この2人がTEAM 01です',
  },
  {
    id: 'bracket',
    title: 'トーナメント表へ反映',
    description: '確定したペアはトーナメント表へ反映され、次に行う試合を一目で確認できます。',
    target: 'bracket-first-match',
    action: 'highlight',
    duration: 6500,
    tooltip: '最初の対戦カード',
  },
  {
    id: 'next-match',
    title: 'NEXT MATCH',
    description: '次の試合では対戦する2チーム、Round、Match番号、顔写真を表示します。',
    target: 'next-match-card',
    action: 'transition',
    duration: 6500,
    tooltip: 'TEAM A  VS  TEAM B',
  },
  {
    id: 'start-match',
    title: '試合開始は手動',
    description: '対戦カードを確認するまで試合は始まりません。運営者が「試合開始」を押した時だけ進行します。',
    target: 'start-match',
    action: 'click',
    duration: 6500,
    tooltip: 'ここだけは必ず運営者が操作します',
    tooltipPlacement: 'top',
  },
  {
    id: 'winner-input',
    title: '試合終了・勝者確定',
    description: '試合終了後に勝者を選択して結果を確定します。通常運営ではここでブラケットへ保存されます。',
    target: 'winner-confirm',
    action: 'click',
    duration: 6500,
    tooltip: '説明中はDBへ書き込みません',
    tooltipPlacement: 'top',
  },
  {
    id: 'winner',
    title: 'WINNER演出',
    description: '勝者を明るく、敗者を暗く表示します。紙吹雪と背景の光は表示中も動き続けます。',
    target: 'winner-stage',
    action: 'wait',
    duration: 7500,
    tooltip: 'WINNER',
  },
  {
    id: 'winner-to-next',
    title: '次の対戦カードへ自動進行',
    description: 'WINNER演出が終わると、運営者の操作なしで次のNEXT MATCHまで自動で進みます。',
    target: 'automatic-transition',
    action: 'transition',
    duration: 6500,
    tooltip: 'WINNER → NEXT MATCH は自動',
  },
  {
    id: 'finish',
    title: '次試合開始待ち / 終了',
    description: 'NEXT MATCHで再び手動開始を待ちます。この流れを決勝まで繰り返します。',
    target: 'guide-flow-summary',
    action: 'highlight',
    duration: 8500,
    tooltip: '登録 → 抽選 → 対戦 → 勝者 → NEXT MATCH → 手動START',
  },
] as const;

export function clampPresentationStep(index: number): number {
  return Math.min(PRESENTATION_STEPS.length - 1, Math.max(0, Math.floor(index)));
}
