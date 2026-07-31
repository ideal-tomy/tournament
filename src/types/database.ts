/**
 * Supabase 生成型の代替（ハイブリッドスキーマ）。
 * 本番接続後は `npx supabase gen types typescript --project-id <ID> > src/types/database.ts` で置換可。
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          venue: string | null;
          format: string;
          team_size: number;
          draw_mode: string;
          status: string;
          scoring_mode: string;
          show_scores: boolean;
          theme: Json;
          settings: Json;
          admin_token: string;
          starts_at: string | null;
          bracket_snapshot: Json | null;
          odd_strategy: string;
          bm_current_match_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['events']['Row']> & {
          title: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Row']>;
      };
      event_state: {
        Row: {
          event_id: string;
          scene: string;
          scene_payload: Json;
          scene_seq: number;
          scene_started_at: string | null;
          awaiting_operator: boolean;
          current_match_id: string | null;
          presentation_mode: string;
          audio_enabled: boolean;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['event_state']['Row']> & {
          event_id: string;
        };
        Update: Partial<Database['public']['Tables']['event_state']['Row']>;
      };
      participants: {
        Row: {
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
        };
        Insert: Partial<Database['public']['Tables']['participants']['Row']> & {
          event_id: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['participants']['Row']>;
      };
      matches: {
        Row: {
          id: string;
          event_id: string;
          bracket: string;
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
          layout: Json;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['matches']['Row']> & {
          event_id: string;
          bracket: string;
          round: number;
          match_no: number;
        };
        Update: Partial<Database['public']['Tables']['matches']['Row']>;
      };
    };
  };
}
