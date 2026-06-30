export type RealtimeEvent =
  | { type: 'bracket:updated'; eventId: string }
  | {
      type: 'match:confirmed';
      eventId: string;
      matchId: number;
      winnerTeamId: string;
      loserTeamId: string;
      /** 同エリア2試合が揃い次の対戦が確定したときのみ付与 */
      advanceEffect?: {
        nextMatchId: number;
        teamAId: string;
        teamBId: string;
        feederMatchIds: [number, number];
      };
    }
  | { type: 'effect:skip'; eventId: string }
  | { type: 'event:finished'; eventId: string };

export interface EventRow {
  id: string;
  name: string;
  held_on: string;
  status: 'setup' | 'running' | 'finished';
  bracket_snapshot: unknown | null;
  current_match_id: number | null;
  odd_strategy: 'trio' | 'bye';
  created_at: string;
}

export interface ParticipantRow {
  id: string;
  event_id: string;
  name: string;
  rating: number | null;
  photo_path: string | null;
  face_crop_path: string | null;
  created_at: string;
}
