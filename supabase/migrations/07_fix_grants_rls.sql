-- =====================================================================
-- 07_fix_grants_rls.sql
-- Admin/Demo が anon キーで events を作成できない問題の修正。
--
-- 症状:
--   - new row violates row-level security policy for table "events"
--   - REST 401 Unauthorized
--
-- 原因候補:
--   1. 新テーブルへの GRANT 不足
--   2. events INSERT トリガーが event_state へ書く際に RLS で失敗
--   3. 02_rls 未適用 / ポリシー欠落
--
-- いつでも再実行してよい（冪potent）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 権限（Supabase 標準: anon / authenticated に CRUD）
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select, update on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to anon, authenticated, service_role;

-- ビュー
do $$
begin
  if to_regclass('public.v_next_match') is not null then
    grant select on public.v_next_match to anon, authenticated, service_role;
  end if;
  if to_regclass('public.v_team_display') is not null then
    grant select on public.v_team_display to anon, authenticated, service_role;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2. events 作成時の event_state 自動生成を SECURITY DEFINER に
--    （anon の RLS をトリガー内で踏まない）
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 3. RLS を有効化し、MVP 方針どおり anon に広く許可
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

-- events: 常に全操作可（終了後の status 戻しも可能にする）
drop policy if exists events_all on public.events;
create policy events_all on public.events
  for all to anon, authenticated, service_role
  using (true) with check (true);

-- event_state: シーン駆動の中心。select/insert/update を常に許可
drop policy if exists event_state_select on public.event_state;
drop policy if exists event_state_insert on public.event_state;
drop policy if exists event_state_update on public.event_state;
drop policy if exists event_state_delete on public.event_state;
drop policy if exists event_state_all on public.event_state;

create policy event_state_all on public.event_state
  for all to anon, authenticated, service_role
  using (true) with check (true);

-- 配下テーブル（select/insert 常時、update/delete は編集可能時）
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

do $$
declare
  t text;
begin
  foreach t in array array[
    'participants', 'teams', 'draw_sessions', 'matches'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('drop policy if exists %I_all on public.%I', t, t);

    execute format(
      'create policy %I_select on public.%I for select to anon, authenticated, service_role using (true)',
      t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to anon, authenticated, service_role with check (true)',
      t, t);
    execute format(
      'create policy %I_update on public.%I for update to anon, authenticated, service_role
         using (public.event_is_editable(event_id)) with check (true)',
      t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to anon, authenticated, service_role
         using (public.event_is_editable(event_id))',
      t, t);
  end loop;
end $$;

-- team_members
drop policy if exists team_members_select on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;
drop policy if exists team_members_all on public.team_members;

create policy team_members_select on public.team_members
  for select to anon, authenticated, service_role using (true);
create policy team_members_insert on public.team_members
  for insert to anon, authenticated, service_role with check (true);
create policy team_members_update on public.team_members
  for update to anon, authenticated, service_role
  using (exists (
    select 1 from public.teams t
    where t.id = team_members.team_id and public.event_is_editable(t.event_id)
  ))
  with check (true);
create policy team_members_delete on public.team_members
  for delete to anon, authenticated, service_role
  using (exists (
    select 1 from public.teams t
    where t.id = team_members.team_id and public.event_is_editable(t.event_id)
  ));

-- マスタ系
do $$
declare t text;
begin
  foreach t in array array[
    'media_assets', 'sponsors', 'playlists', 'playlist_items', 'presentation_presets'
  ]
  loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to anon, authenticated, service_role using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ログ
drop policy if exists operation_log_select on public.operation_log;
drop policy if exists operation_log_insert on public.operation_log;
drop policy if exists operation_log_undo   on public.operation_log;
create policy operation_log_select on public.operation_log
  for select to anon, authenticated, service_role using (true);
create policy operation_log_insert on public.operation_log
  for insert to anon, authenticated, service_role with check (true);
create policy operation_log_undo on public.operation_log
  for update to anon, authenticated, service_role
  using (true) with check (true);

drop policy if exists ad_impressions_select on public.ad_impressions;
drop policy if exists ad_impressions_insert on public.ad_impressions;
drop policy if exists ad_impressions_update on public.ad_impressions;
create policy ad_impressions_select on public.ad_impressions
  for select to anon, authenticated, service_role using (true);
create policy ad_impressions_insert on public.ad_impressions
  for insert to anon, authenticated, service_role with check (true);
create policy ad_impressions_update on public.ad_impressions
  for update to anon, authenticated, service_role
  using (true) with check (true);


-- ---------------------------------------------------------------------
-- 4. Storage バケット権限（参加者写真）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('participant-photos', 'participant-photos', true),
  ('participant-faces',  'participant-faces',  true),
  ('tournament-media',   'tournament-media',   true)
on conflict (id) do nothing;

drop policy if exists participant_photos_all on storage.objects;
drop policy if exists participant_faces_all on storage.objects;
drop policy if exists tournament_media_read on storage.objects;
drop policy if exists tournament_media_write on storage.objects;

create policy participant_photos_all on storage.objects
  for all to anon, authenticated, service_role
  using (bucket_id = 'participant-photos')
  with check (bucket_id = 'participant-photos');

create policy participant_faces_all on storage.objects
  for all to anon, authenticated, service_role
  using (bucket_id = 'participant-faces')
  with check (bucket_id = 'participant-faces');

create policy tournament_media_read on storage.objects
  for select to anon, authenticated, service_role
  using (bucket_id = 'tournament-media');

create policy tournament_media_write on storage.objects
  for all to anon, authenticated, service_role
  using (bucket_id = 'tournament-media')
  with check (bucket_id = 'tournament-media');


-- ---------------------------------------------------------------------
-- 5. 動作確認用（成功すれば 1 行返る。最後に消す）
-- ---------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  insert into public.events (title, status)
  values ('[RLS_CHECK] probe', 'entry')
  returning id into v_id;

  if not exists (select 1 from public.event_state where event_id = v_id) then
    raise exception 'event_state が自動生成されませんでした';
  end if;

  delete from public.events where id = v_id;
  raise notice 'OK: events insert + event_state trigger + delete 成功';
end $$;
