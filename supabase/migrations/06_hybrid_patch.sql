-- =====================================================================
-- 06_hybrid_patch.sql
-- 01_schema 適用後に実行。進行真実源 bracket_snapshot を events に戻す。
-- =====================================================================

-- events: brackets-manager 互換
alter table public.events
  add column if not exists bracket_snapshot jsonb;

alter table public.events
  add column if not exists odd_strategy text not null default 'trio';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_odd_strategy_chk'
  ) then
    alter table public.events
      add constraint events_odd_strategy_chk
      check (odd_strategy in ('trio', 'bye'));
  end if;
end $$;

-- brackets-manager 内の試合 ID（int）。event_state.current_match_id は matches.uuid
alter table public.events
  add column if not exists bm_current_match_id integer;

comment on column public.events.bracket_snapshot is 'brackets-manager export。進行計算の真実源';
comment on column public.events.bm_current_match_id is 'brackets-manager の match.id（表示用 matches.id とは別）';

-- teams
alter table public.teams
  add column if not exists manager_participant_id integer;

comment on column public.teams.manager_participant_id is 'brackets-manager participant.id';

-- participants: 既存 Storage（participant-photos / participant-faces）互換
alter table public.participants
  add column if not exists photo_path text;

alter table public.participants
  add column if not exists face_crop_path text;

-- participant Storage バケット（旧運用継続）
insert into storage.buckets (id, name, public)
values
  ('participant-photos', 'participant-photos', true),
  ('participant-faces',  'participant-faces',  true)
on conflict (id) do nothing;
