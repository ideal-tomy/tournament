-- =====================================================================
-- 01_schema.sql  ダーツトーナメント演出システム v2 スキーマ
--
-- 安全性の保証:
--   - すべて create ... if not exists
--   - drop 文を 1 つも含まない
--   - 同名テーブルが既に存在する場合はスキップされる（上書きしない）
--
-- 実行前に 00_inspect_current_schema.sql の (9) を必ず確認すること。
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 共通: updated_at 自動更新
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================================================================
-- 1. 広告主
-- =====================================================================
create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  shop_name   text,
  contact     text,
  note        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 2. メディア資産（Supabase Storage / 外部 URL 両対応）
-- =====================================================================
create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  kind          text not null
                check (kind in ('video', 'image', 'audio')),
  -- 保管先。storage = Supabase Storage / external = YouTube 等の外部 URL
  source        text not null
                check (source in ('storage', 'external')),
  storage_path  text,
  external_url  text,
  mime_type     text,
  duration_sec  numeric(7,2),
  width         integer,
  height        integer,
  -- 透過 WebM（花びら等）の判別。合成方法が変わる
  has_alpha     boolean not null default false,
  -- Display 起動時のプリロード対象か
  preload       boolean not null default false,
  sponsor_id    uuid references public.sponsors(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint media_assets_source_chk check (
    (source = 'storage'  and storage_path is not null) or
    (source = 'external' and external_url is not null)
  )
);

create index if not exists idx_media_assets_sponsor on public.media_assets(sponsor_id);
create index if not exists idx_media_assets_preload on public.media_assets(preload) where preload;

drop trigger if exists trg_media_assets_updated on public.media_assets;
create trigger trg_media_assets_updated
  before update on public.media_assets
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 3. 大会
--    大会ごとに変わるものはすべてここに集約する（演出テンプレは 1 本）
-- =====================================================================
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),

  -- オープニングに差し込む文言（例: '20周年トーナメント'）
  title         text not null,
  subtitle      text,
  venue         text,

  format        text not null default 'double_elimination'
                check (format in ('double_elimination', 'single_elimination', 'round_robin')),
  -- 1 = シングルス / 2 = ダブルス / 3 = トリオス
  team_size     smallint not null default 2 check (team_size between 1 and 6),

  draw_mode     text not null default 'full_random'
                check (draw_mode in ('full_random', 'rating_balanced', 'manual')),

  -- 編集ロックの基準（要件定義 3.5）
  status        text not null default 'draft'
                check (status in ('draft', 'entry', 'drawn', 'running', 'finished', 'archived')),

  -- レグ得失点は常に格納可能。表示だけ切り替える
  scoring_mode  text not null default 'win_loss'
                check (scoring_mode in ('win_loss', 'legs')),
  show_scores   boolean not null default false,

  -- 配色の上書き。既定値はコード側の定数
  theme         jsonb not null default '{}'::jsonb,
  -- 演出の尺など。新項目の追加にマイグレーション不要
  settings      jsonb not null default '{}'::jsonb,

  -- Admin URL に含めるトークン（検証はアプリ層）
  admin_token   uuid not null default gen_random_uuid(),

  starts_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_events_status on public.events(status);

drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated
  before update on public.events
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 4. 参加者
-- =====================================================================
create table if not exists public.participants (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  entry_no        integer,
  display_name    text not null,
  name_kana       text,
  -- 進行中でも編集可（要件定義 3.5）
  rating          numeric(6,2),
  home_shop       text,
  photo_media_id  uuid references public.media_assets(id) on delete set null,
  photo_url       text,
  status          text not null default 'entered'
                  check (status in ('entered', 'withdrawn', 'reserve')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint participants_entry_no_uniq unique (event_id, entry_no)
);

create index if not exists idx_participants_event on public.participants(event_id);

drop trigger if exists trg_participants_updated on public.participants;
create trigger trg_participants_updated
  before update on public.participants
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 5. 抽選セッション（原則 1 の実体）
--    組み合わせは演出開始前にここで確定する。演出はこれを再生するだけ。
-- =====================================================================
create table if not exists public.draw_sessions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  mode          text not null
                check (mode in ('full_random', 'rating_balanced', 'manual')),
  -- 同じ抽選を再現するための乱数シード
  seed          text,
  -- 参加者 ID の配列。
  -- 【不変条件】先頭から events.team_size 人ずつ組にすると確定済みチームが再現される。
  --   full_random     : シャッフル結果をそのまま格納
  --   rating_balanced : 確定ペアが隣り合う順に並べ替えて格納
  reveal_order  jsonb not null default '[]'::jsonb,
  -- null の間は下書き。確定後に演出を開始してよい
  committed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_draw_sessions_event on public.draw_sessions(event_id);


-- =====================================================================
-- 6. チーム（N 人対応）
-- =====================================================================
create table if not exists public.teams (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  draw_session_id  uuid references public.draw_sessions(id) on delete set null,
  name             text,
  seed             integer,
  rating_total     numeric(7,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_teams_event on public.teams(event_id);
create index if not exists idx_teams_draw_session on public.teams(draw_session_id);

drop trigger if exists trg_teams_updated on public.teams;
create trigger trg_teams_updated
  before update on public.teams
  for each row execute function public.set_updated_at();


create table if not exists public.team_members (
  team_id         uuid not null references public.teams(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  position        smallint not null default 1,
  primary key (team_id, participant_id)
);

create index if not exists idx_team_members_participant on public.team_members(participant_id);


-- =====================================================================
-- 7. 試合
--    brackets-manager で計算していても、表示・座標・復帰のために DB に持つ
-- =====================================================================
create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,

  -- 演出テーマ切替のキー（要件定義 3.3）
  bracket             text not null
                      check (bracket in ('winners', 'losers', 'grand_final')),
  round               smallint not null,
  match_no            integer not null,
  -- 進行順。「次の試合」の決定に使う
  sequence            integer,

  team_a_id           uuid references public.teams(id) on delete set null,
  team_b_id           uuid references public.teams(id) on delete set null,
  winner_team_id      uuid references public.teams(id) on delete set null,
  loser_team_id       uuid references public.teams(id) on delete set null,

  -- 常に格納可能。表示は events.show_scores で切替
  score_a             smallint,
  score_b             smallint,

  status              text not null default 'pending'
                      check (status in ('pending', 'ready', 'in_progress', 'done', 'void')),

  -- 勝者・敗者の行き先。1 手戻す際に逆算せず参照できる
  next_win_match_id   uuid references public.matches(id) on delete set null,
  next_win_slot       smallint check (next_win_slot in (1, 2)),
  next_lose_match_id  uuid references public.matches(id) on delete set null,
  next_lose_slot      smallint check (next_lose_slot in (1, 2)),

  -- 座標駆動レイアウトの座標値
  layout              jsonb not null default '{}'::jsonb,

  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint matches_position_uniq unique (event_id, bracket, round, match_no)
);

create index if not exists idx_matches_event_sequence on public.matches(event_id, sequence);
create index if not exists idx_matches_event_bracket  on public.matches(event_id, bracket, round);
create index if not exists idx_matches_team_a on public.matches(team_a_id);
create index if not exists idx_matches_team_b on public.matches(team_b_id);

drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated
  before update on public.matches
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 8. シーン状態機械（最重要 / 1 イベント 1 行）
--    Display はこの行だけを購読する
-- =====================================================================
create table if not exists public.event_state (
  event_id          uuid primary key references public.events(id) on delete cascade,

  scene             text not null default 'idle'
                    check (scene in (
                      'idle', 'opening', 'draw', 'bracket',
                      'vs_card', 'match_live', 'result',
                      'interval', 'award', 'finished'
                    )),
  scene_payload     jsonb not null default '{}'::jsonb,

  -- 遷移のたびに +1。Display は自分の seq 以下の更新を破棄する。
  -- Realtime の順序逆転・重複配信に対する唯一の防御。省略しないこと。
  scene_seq         bigint not null default 0,
  scene_started_at  timestamptz,

  -- 手動クローズ待ち（更新.md 項目 1）
  awaiting_operator boolean not null default false,

  current_match_id  uuid references public.matches(id) on delete set null,

  presentation_mode text not null default 'full'
                    check (presentation_mode in ('full', 'short', 'lite')),
  audio_enabled     boolean not null default true,

  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_event_state_updated on public.event_state;
create trigger trg_event_state_updated
  before update on public.event_state
  for each row execute function public.set_updated_at();


-- events を作ったら event_state を必ず 1 行作る
-- SECURITY DEFINER: anon の RLS をトリガー内で踏まない（07_fix_grants_rls と同旨）
create or replace function public.ensure_event_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_state (event_id)
  values (new.id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_events_ensure_state on public.events;
create trigger trg_events_ensure_state
  after insert on public.events
  for each row execute function public.ensure_event_state();


-- =====================================================================
-- 9. 操作ログ（1 手戻す / 監査）
--    逆操作を計算せず、変更前スナップショットを復元する方式
-- =====================================================================
create table if not exists public.operation_log (
  id            bigserial primary key,
  event_id      uuid not null references public.events(id) on delete cascade,
  action        text not null,          -- confirm_result / scene_change / edit_rating 等
  target_table  text,
  target_id     uuid,
  before_data   jsonb,                  -- 変更前の行全体
  after_data    jsonb,                  -- 変更後の行全体
  undone_at     timestamptz,            -- null が有効な履歴
  created_at    timestamptz not null default now()
);

create index if not exists idx_operation_log_undo
  on public.operation_log(event_id, id desc)
  where undone_at is null;


-- =====================================================================
-- 10. プレイリスト（オープニング・広告・注意事項）
-- =====================================================================
create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  -- null = 全大会共通のテンプレート（注意事項など）
  event_id    uuid references public.events(id) on delete cascade,
  slot        text not null
              check (slot in ('opening', 'interval', 'standby', 'award')),
  name        text not null,
  is_loop     boolean not null default true,
  -- UI から削除・無効化できない（注意事項用）
  is_locked   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_playlists_event_slot on public.playlists(event_id, slot);


create table if not exists public.playlist_items (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid not null references public.playlists(id) on delete cascade,
  media_id      uuid not null references public.media_assets(id) on delete restrict,
  -- numeric。項目の間に挿入するとき前後の中間値を採用する（一意制約は付けない）
  order_no      numeric(12,4) not null default 0,
  -- media_assets.duration_sec の上書き（画像の表示秒数など）
  duration_sec  numeric(7,2),
  is_locked     boolean not null default false,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_playlist_items_order on public.playlist_items(playlist_id, order_no);
create index if not exists idx_playlist_items_media on public.playlist_items(media_id);


-- =====================================================================
-- 11. 広告表示ログ（スポンサー報告用）
-- =====================================================================
create table if not exists public.ad_impressions (
  id                bigserial primary key,
  event_id          uuid references public.events(id) on delete set null,
  playlist_item_id  uuid references public.playlist_items(id) on delete set null,
  media_id          uuid references public.media_assets(id) on delete set null,
  sponsor_id        uuid references public.sponsors(id) on delete set null,
  shown_at          timestamptz not null default now(),
  duration_ms       integer,
  is_completed      boolean not null default false
);

create index if not exists idx_ad_impressions_event   on public.ad_impressions(event_id, media_id);
create index if not exists idx_ad_impressions_sponsor on public.ad_impressions(sponsor_id, shown_at);


-- =====================================================================
-- 12. 大会テンプレート（プリセット）
-- =====================================================================
create table if not exists public.presentation_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  config      jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);


-- =====================================================================
-- 13. 便利ビュー
-- =====================================================================

-- 次に行う試合（両チーム確定済み・未実施のうち sequence が最小）
create or replace view public.v_next_match as
select distinct on (m.event_id)
  m.*
from public.matches m
where m.status in ('pending', 'ready')
  and m.team_a_id is not null
  and m.team_b_id is not null
order by m.event_id, m.sequence nulls last, m.round, m.match_no;


-- チームの表示用まとめ（メンバー名の連結）
create or replace view public.v_team_display as
select
  t.id            as team_id,
  t.event_id,
  coalesce(t.name, string_agg(p.display_name, ' & ' order by tm.position)) as display_name,
  t.seed,
  t.rating_total,
  count(tm.participant_id) as member_count
from public.teams t
left join public.team_members tm on tm.team_id = t.id
left join public.participants  p on p.id = tm.participant_id
group by t.id, t.event_id, t.name, t.seed, t.rating_total;
