-- =====================================================================
-- 02_rls_realtime.sql  RLS ポリシー / Realtime / Storage
--
-- 【方針】
-- Admin のアクセス制御は「URL + イベント ID 共有」方式（要件定義 4.3）。
-- したがって RLS は認証ベースの制御を行わず、以下 2 点だけを担う。
--   1. 終了済みイベント配下のデータを更新・削除から守る
--   2. ログ系テーブルの改ざんを防ぐ（insert のみ許可）
--
-- これは悪意ある第三者を防ぐものではなく、当日の誤操作から守るためのもの。
-- セキュリティ境界が URL の秘匿に依存していることは明示的に受け入れている。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 補助関数: そのイベントが編集可能か
-- ---------------------------------------------------------------------
create or replace function public.event_is_editable(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.status not in ('finished', 'archived')
     from public.events e where e.id = p_event_id),
    false
  );
$$;


-- ---------------------------------------------------------------------
-- RLS 有効化
-- ---------------------------------------------------------------------
alter table public.events               enable row level security;
alter table public.event_state          enable row level security;
alter table public.participants         enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.draw_sessions        enable row level security;
alter table public.matches              enable row level security;
alter table public.operation_log        enable row level security;
alter table public.media_assets         enable row level security;
alter table public.sponsors             enable row level security;
alter table public.playlists            enable row level security;
alter table public.playlist_items       enable row level security;
alter table public.ad_impressions       enable row level security;
alter table public.presentation_presets enable row level security;


-- ---------------------------------------------------------------------
-- (A) 全面開放グループ
--     イベントに紐づかない、または常に編集可能なマスタ系
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'media_assets', 'sponsors', 'playlists', 'playlist_items', 'presentation_presets'
  ]
  loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- (B) events 本体
--     status を戻せなくなると復旧不能になるため、events 行自体は常に更新可
-- ---------------------------------------------------------------------
drop policy if exists events_all on public.events;
create policy events_all on public.events
  for all to anon, authenticated
  using (true) with check (true);


-- ---------------------------------------------------------------------
-- (C) イベント配下のデータ
--     select / insert は常に可、update / delete は編集可能なイベントのみ
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  fk text;
begin
  foreach t in array array[
    'event_state', 'participants', 'teams', 'draw_sessions', 'matches'
  ]
  loop
    fk := 'event_id';

    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    execute format(
      'create policy %I_select on public.%I for select to anon, authenticated using (true)', t, t);

    execute format(
      'create policy %I_insert on public.%I for insert to anon, authenticated with check (true)', t, t);

    execute format(
      'create policy %I_update on public.%I for update to anon, authenticated
         using (public.event_is_editable(%I)) with check (true)', t, t, fk);

    execute format(
      'create policy %I_delete on public.%I for delete to anon, authenticated
         using (public.event_is_editable(%I))', t, t, fk);
  end loop;
end $$;


-- team_members は event_id を持たないため、親チーム経由で判定する
drop policy if exists team_members_select on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;

create policy team_members_select on public.team_members
  for select to anon, authenticated using (true);

create policy team_members_insert on public.team_members
  for insert to anon, authenticated with check (true);

create policy team_members_update on public.team_members
  for update to anon, authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_members.team_id and public.event_is_editable(t.event_id)
  ))
  with check (true);

create policy team_members_delete on public.team_members
  for delete to anon, authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = team_members.team_id and public.event_is_editable(t.event_id)
  ));


-- ---------------------------------------------------------------------
-- (D) ログ系: select / insert のみ。update / delete のポリシーは作らない
--     （ポリシーが無い操作は RLS 下で拒否される）
--     ※ operation_log.undone_at の更新だけは 1 手戻すに必要なため個別に許可
-- ---------------------------------------------------------------------
drop policy if exists operation_log_select on public.operation_log;
drop policy if exists operation_log_insert on public.operation_log;
drop policy if exists operation_log_undo   on public.operation_log;

create policy operation_log_select on public.operation_log
  for select to anon, authenticated using (true);

create policy operation_log_insert on public.operation_log
  for insert to anon, authenticated with check (true);

-- 1 手戻す用。undone_at を立てる目的のみを想定
create policy operation_log_undo on public.operation_log
  for update to anon, authenticated
  using (public.event_is_editable(event_id))
  with check (true);


drop policy if exists ad_impressions_select on public.ad_impressions;
drop policy if exists ad_impressions_insert on public.ad_impressions;
drop policy if exists ad_impressions_update on public.ad_impressions;

create policy ad_impressions_select on public.ad_impressions
  for select to anon, authenticated using (true);

create policy ad_impressions_insert on public.ad_impressions
  for insert to anon, authenticated with check (true);

-- 再生完了時に duration_ms / is_completed を書き戻すため update のみ許可（delete は不可）
create policy ad_impressions_update on public.ad_impressions
  for update to anon, authenticated
  using (true) with check (true);


-- =====================================================================
-- Realtime 配信対象
-- 購読テーブルが増えるほど再描画が増え、演出が引っかかる。最小限にすること。
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['event_state', 'matches', 'teams', 'team_members', 'participants']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- =====================================================================
-- Storage バケット
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('tournament-media', 'tournament-media', true)
on conflict (id) do nothing;

drop policy if exists tournament_media_read  on storage.objects;
drop policy if exists tournament_media_write on storage.objects;

create policy tournament_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'tournament-media');

create policy tournament_media_write on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'tournament-media')
  with check (bucket_id = 'tournament-media');
