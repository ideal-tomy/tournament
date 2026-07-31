-- =====================================================================
-- 03_seed.sql  初期データ
--   - 全大会共通の注意事項プレイリスト（削除不可）
--   - 演出プリセット
--   - 動作確認用のテストイベント（末尾。不要ならその節を実行しない）
-- 冪等: 複数回実行しても重複しない
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 全大会共通の注意事項プレイリスト（event_id = null）
--    is_locked = true → UI から削除・無効化できない
-- ---------------------------------------------------------------------
insert into public.playlists (id, event_id, slot, name, is_loop, is_locked)
values ('00000000-0000-0000-0000-000000000101', null, 'opening', '注意事項（共通・固定）', true, true)
on conflict (id) do nothing;

-- 注意事項スライドの枠。実ファイルは Storage にアップロード後 storage_path を更新すること。
insert into public.media_assets (id, title, kind, source, storage_path, duration_sec, preload, note)
values
  ('00000000-0000-0000-0000-000000000201', '注意事項 1: 投矢時の安全確認',
   'image', 'storage', 'notices/notice-01.png', 8, true, '差し替え時は同じ storage_path に上書きする'),
  ('00000000-0000-0000-0000-000000000202', '注意事項 2: 機器トラブル時の対応',
   'image', 'storage', 'notices/notice-02.png', 8, true, null),
  ('00000000-0000-0000-0000-000000000203', '注意事項 3: 撮影・SNS 掲載について',
   'image', 'storage', 'notices/notice-03.png', 8, true, null)
on conflict (id) do nothing;

insert into public.playlist_items (id, playlist_id, media_id, order_no, is_locked, is_enabled)
values
  ('00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 1, true, true),
  ('00000000-0000-0000-0000-000000000302',
   '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 2, true, true),
  ('00000000-0000-0000-0000-000000000303',
   '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000203', 3, true, true)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 2. 演出素材（透過 WebM）の枠
-- ---------------------------------------------------------------------
insert into public.media_assets (id, title, kind, source, storage_path, has_alpha, preload, note)
values
  ('00000000-0000-0000-0000-000000000211', '花びら演出（透過 WebM）',
   'video', 'storage', 'vfx/petals.webm', true, true, '勝敗演出のオーバーレイ。パーティクル生成の代替'),
  ('00000000-0000-0000-0000-000000000212', '花びら演出（静止画 / lite 用）',
   'image', 'storage', 'vfx/petals-lite.png', true, true, 'presentation_mode = lite で使用')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 3. 演出プリセット（大会テンプレート）
--    events.settings にコピーして使う
-- ---------------------------------------------------------------------
insert into public.presentation_presets (id, name, description, config, is_default)
values
(
  '00000000-0000-0000-0000-000000000401',
  '標準（ダブルス 16 名）',
  '通常運用の既定値',
  jsonb_build_object(
    'draw', jsonb_build_object(
      'secPerPerson', 6,          -- full 版で 1 人あたりに使う秒数（3-12）
      'defaultMode',  'short'
    ),
    'vs', jsonb_build_object(
      'autoClose',    false,      -- 手動クローズ（更新.md 項目 1）
      'introSec',     2.5
    ),
    'result', jsonb_build_object(
      'dimSec',       0.2,
      'winnerScale',  1.5,
      'loserScale',   0.75,
      'winnerDelay',  0.2,
      'loserDelay',   0.5,        -- 勝者より遅らせる
      'petalDelay',   1.0,
      'totalSec',     3.5
    ),
    'playlist', jsonb_build_object(
      'imageDefaultSec', 8
    )
  ),
  true
),
(
  '00000000-0000-0000-0000-000000000402',
  '短時間進行（演出を絞る）',
  '進行が押しているとき用。full 版を使わない',
  jsonb_build_object(
    'draw',   jsonb_build_object('secPerPerson', 3, 'defaultMode', 'short'),
    'vs',     jsonb_build_object('autoClose', false, 'introSec', 1.2),
    'result', jsonb_build_object('totalSec', 2.0)
  ),
  false
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 4. 動作確認用テストイベント（不要ならこの節を実行しない）
--    event_state はトリガーで自動生成される
-- ---------------------------------------------------------------------
insert into public.events (id, title, subtitle, format, team_size, draw_mode, status, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  '第1回 テストトーナメント',
  'SCHEMA v2 動作確認',
  'double_elimination', 2, 'full_random', 'draft',
  (select config from public.presentation_presets
    where id = '00000000-0000-0000-0000-000000000401')
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 5. 確認
-- ---------------------------------------------------------------------
select
  e.id, e.title, e.status, e.team_size,
  s.scene, s.scene_seq, s.presentation_mode
from public.events e
join public.event_state s on s.event_id = e.id
order by e.created_at desc;
