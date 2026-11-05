/** 会場の待機画面。店舗ごとに画像か、音声なしのループ動画へ差し替える。BGMは別。 */
export type VenueOpeningMedia =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; src: string; poster?: string };

export const venueOpeningMedia: VenueOpeningMedia = {
  kind: 'image',
  src: `/tournament-effects/opening/${encodeURIComponent('T-RIP 20周年記念ダーツトーナメント.png')}`,
  alt: 'T-RIP 20周年記念オーナーズダーツトーナメント',
};
