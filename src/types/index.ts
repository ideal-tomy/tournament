export type Scene =
  | 'idle'
  | 'opening'
  | 'draw'
  | 'bracket'
  | 'vs_card'
  | 'match_live'
  | 'result'
  | 'interval'
  | 'award'
  | 'finished';

export type EventStatus =
  | 'draft'
  | 'entry'
  | 'drawn'
  | 'running'
  | 'finished'
  | 'archived';

export type PresentationMode = 'full' | 'short' | 'lite';

export type BracketThemeKey = 'winners' | 'losers' | 'grand_final';

/** Display は主に event_state を購読。broadcast は互換・補助のみ */
export type RealtimeEvent =
  | { type: 'bracket:updated'; eventId: string }
  | { type: 'event:finished'; eventId: string };

/** 旧 EffectOrchestrator 用（v2 シーン駆動へ移行中の互換型） */
export type LegacyMatchConfirmed = {
  type: 'match:confirmed';
  eventId: string;
  matchId: number;
  winnerTeamId: string;
  loserTeamId: string;
  advanceEffect?: {
    nextMatchId: number;
    teamAId: string;
    teamBId: string;
    feederMatchIds: [number, number];
  };
};

export interface EventRow {
  id: string;
  title: string;
  subtitle: string | null;
  venue: string | null;
  format: string;
  team_size: number;
  draw_mode: string;
  status: EventStatus;
  scoring_mode: string;
  show_scores: boolean;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  admin_token: string;
  starts_at: string | null;
  bracket_snapshot: unknown | null;
  odd_strategy: 'trio' | 'bye';
  bm_current_match_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventStateRow {
  event_id: string;
  scene: Scene;
  scene_payload: Record<string, unknown>;
  scene_seq: number;
  scene_started_at: string | null;
  awaiting_operator: boolean;
  current_match_id: string | null;
  presentation_mode: PresentationMode;
  audio_enabled: boolean;
  updated_at: string;
}

export interface ParticipantRow {
  id: string;
  event_id: string;
  entry_no: number | null;
  display_name: string;
  name_kana: string | null;
  rating: number | null;
  home_shop: string | null;
  photo_media_id: string | null;
  photo_url: string | null;
  photo_path: string | null;
  face_crop_path: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchRow {
  id: string;
  event_id: string;
  bracket: BracketThemeKey;
  round: number;
  match_no: number;
  sequence: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  loser_team_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  next_win_match_id: string | null;
  next_win_slot: number | null;
  next_lose_match_id: string | null;
  next_lose_slot: number | null;
  layout: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
