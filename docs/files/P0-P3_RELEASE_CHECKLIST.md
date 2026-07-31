# v2 P0〜P3 実装完了チェックリスト

実装日: 2026-07-31

## コード側（完了）

- [x] ハイブリッドスキーマ SQL（`05_archive_v1_rename` / `06_hybrid_patch`）
- [x] シーン状態機械（`src/features/scene/`）
- [x] snapshot → matches 投影
- [x] VS / 勝敗演出シーン
- [x] プレイリスト + MediaManager
- [x] `npm run build` / `npm test` 通過

## 本番適用（手動）

1. Supabase SQL Editor で順に実行:
   `00_inspect` → `05_archive_v1_rename` → `01_schema` → `02_rls_realtime` → `03_seed` → `06_hybrid_patch` → **`07_fix_grants_rls`**
   （Admin/Demo で RLS 401 が出る場合は `07` だけ再実行）
2. Storage に花びら WebM を配置する場合は `tournament-media` または `/images/` を確認
3. 新イベントで登録 → 抽選 → VS → 勝敗 → オープニングを通し確認
4. P4 以降（抽選演出 short/full）は別 PLAN
