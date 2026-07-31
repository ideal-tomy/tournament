-- =====================================================================
-- 05_archive_v1_rename.sql
-- 旧スキーマ（0001_init）の同名テーブルを退避する。
-- 01_schema.sql の「前」に実行すること。
-- DROP はしない。リハーサルデータは移行対象外（新側で作り直し）。
-- =====================================================================

do $$
begin
  -- events: 旧形判定（name 列があり title が無い）
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'title'
  ) then
    if to_regclass('public.events_v1') is null then
      execute 'alter table public.events rename to events_v1';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'participants' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'participants' and column_name = 'display_name'
  ) then
    if to_regclass('public.participants_v1') is null then
      execute 'alter table public.participants rename to participants_v1';
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'teams'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'display_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'draw_session_id'
  ) then
    if to_regclass('public.teams_v1') is null then
      execute 'alter table public.teams rename to teams_v1';
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'team_members'
  ) and to_regclass('public.teams_v1') is not null
    and to_regclass('public.team_members_v1') is null
    and exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.table_schema = 'public'
        and tc.table_name = 'team_members'
        and tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_name = 'teams_v1'
    ) then
    execute 'alter table public.team_members rename to team_members_v1';
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'team_members'
  ) and to_regclass('public.teams_v1') is not null
    and to_regclass('public.team_members_v1') is null then
    -- FK 情報が取れない場合でも teams が退避済みなら members も退避
    execute 'alter table public.team_members rename to team_members_v1';
  end if;
end $$;
