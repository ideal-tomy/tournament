-- =====================================================================
-- 00_inspect_current_schema.sql
-- 現行スキーマの吸い出し。参照のみ。データは一切変更しない。
-- Supabase SQL Editor で 1 ブロックずつ実行し、出力を保存すること。
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) public スキーマのテーブル一覧と概算行数
-- ---------------------------------------------------------------------
select
  c.relname                                as table_name,
  c.reltuples::bigint                      as approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;


-- ---------------------------------------------------------------------
-- (2) 全テーブルの列定義
-- ---------------------------------------------------------------------
select
  table_name,
  ordinal_position as pos,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ---------------------------------------------------------------------
-- (3) 主キー・外部キー・一意制約
-- ---------------------------------------------------------------------
select
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name  as ref_table,
  ccu.column_name as ref_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.table_schema    = tc.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema    = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type, tc.constraint_name;


-- ---------------------------------------------------------------------
-- (4) CHECK 制約
-- ---------------------------------------------------------------------
select
  rel.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
  and con.contype = 'c'
order by rel.relname, con.conname;


-- ---------------------------------------------------------------------
-- (5) インデックス
-- ---------------------------------------------------------------------
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ---------------------------------------------------------------------
-- (6) RLS の有効状態とポリシー
-- ---------------------------------------------------------------------
select relname as table_name, relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by relname;

select
  tablename, policyname, cmd, roles,
  qual        as using_expr,
  with_check  as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ---------------------------------------------------------------------
-- (7) Realtime 配信対象テーブル
-- ---------------------------------------------------------------------
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;


-- ---------------------------------------------------------------------
-- (8) Storage バケット
-- ---------------------------------------------------------------------
select id, name, public, file_size_limit, created_at
from storage.buckets
order by name;


-- ---------------------------------------------------------------------
-- (9) 新スキーマと同名のテーブルが既に存在するか
--     ここに 1 件でも出たら 02_データベース設計書.md の 0 章の判断表に従う
-- ---------------------------------------------------------------------
select t.name as conflicting_table
from (values
  ('events'), ('event_state'), ('participants'), ('teams'), ('team_members'),
  ('draw_sessions'), ('matches'), ('operation_log'), ('media_assets'),
  ('sponsors'), ('playlists'), ('playlist_items'), ('ad_impressions'),
  ('presentation_presets')
) as t(name)
where to_regclass('public.' || t.name) is not null
order by t.name;
