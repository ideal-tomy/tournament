-- =====================================================================
-- 0001_init.sql  — Phase 0-2 用スキーマ
-- 配置: supabase/migrations/0001_init.sql
-- 適用: Supabase Dashboard > SQL Editor で実行、または supabase db push
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- events : 開催単位（真実源となる bracket_snapshot を保持）
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  held_on           date not null default current_date,
  status            text not null default 'setup',  -- setup | running | finished
  bracket_snapshot  jsonb,                           -- brackets-manager stageData(真実源)
  current_match_id  int,                             -- 進行中/次の試合(manager内ID) ※Phase3で使用
  odd_strategy      text not null default 'trio',    -- trio | bye  (奇数人数の扱い)
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- participants : 参加者（顔写真＋名前）
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  name            text not null,
  photo_path      text,    -- Storage: 原画像   participant-photos/{event_id}/{id}.jpg
  face_crop_path  text,    -- Storage: 顔トリミング済 participant-faces/{event_id}/{id}.jpg
  created_at      timestamptz not null default now()
);
create index if not exists idx_participants_event on public.participants(event_id);

-- ---------------------------------------------------------------------
-- teams : チーム(ペア)。トーナメントの「枠」
--   manager_participant_id … brackets-manager 内 participant.id との対応
--   （seeding に team.id(uuid) を name として渡すため name でも引けるが、明示保持）
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references public.events(id) on delete cascade,
  seed                    int,
  manager_participant_id  int,
  display_name            text,
  created_at              timestamptz not null default now()
);
create index if not exists idx_teams_event on public.teams(event_id);

-- ---------------------------------------------------------------------
-- team_members : チーム⇔参加者（多対多。原則2名、奇数時のみ3名あり）
-- ---------------------------------------------------------------------
create table if not exists public.team_members (
  team_id         uuid not null references public.teams(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  primary key (team_id, participant_id)
);

-- =====================================================================
-- Storage バケット
-- =====================================================================
insert into storage.buckets (id, name, public)
values
  ('participant-photos', 'participant-photos', true),
  ('participant-faces',  'participant-faces',  true)
on conflict (id) do nothing;

-- =====================================================================
-- RLS（※MVP方針）
--   運営者限定の内部ツール前提のため anon に許可する簡易ポリシー。
--   ⚠ 本番公開・外部公開する場合はここを必ず絞ること（認証導入 or event単位制限）。
-- =====================================================================
alter table public.events       enable row level security;
alter table public.participants enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

do $$
begin
  -- events
  if not exists (select 1 from pg_policies where tablename='events' and policyname='events_all') then
    create policy events_all on public.events for all to anon using (true) with check (true);
  end if;
  -- participants
  if not exists (select 1 from pg_policies where tablename='participants' and policyname='participants_all') then
    create policy participants_all on public.participants for all to anon using (true) with check (true);
  end if;
  -- teams
  if not exists (select 1 from pg_policies where tablename='teams' and policyname='teams_all') then
    create policy teams_all on public.teams for all to anon using (true) with check (true);
  end if;
  -- team_members
  if not exists (select 1 from pg_policies where tablename='team_members' and policyname='team_members_all') then
    create policy team_members_all on public.team_members for all to anon using (true) with check (true);
  end if;
end $$;

-- Storage オブジェクトの読み書き（anon）。※同様に本番では要見直し。
do $$
begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='faces_photos_read') then
    create policy faces_photos_read on storage.objects for select to anon
      using (bucket_id in ('participant-photos','participant-faces'));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='faces_photos_write') then
    create policy faces_photos_write on storage.objects for insert to anon
      with check (bucket_id in ('participant-photos','participant-faces'));
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='faces_photos_delete') then
    create policy faces_photos_delete on storage.objects for delete to anon
      using (bucket_id in ('participant-photos','participant-faces'));
  end if;
end $$;
