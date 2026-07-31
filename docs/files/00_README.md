# ダーツトーナメント演出システム v2 ドキュメント一式

作成日: 2026-07-31

## ファイル構成

| ファイル | 内容 | 読む人 |
|---|---|---|
| `01_要件定義書.md` | 目的・設計原則・機能要件・フェーズ計画 | 全員（最初に読む） |
| `02_データベース設計書.md` | テーブルの設計意図・移行方針・RLS 方針 | 実装者 |
| `03_実装指示書.md` | Cursor 向けのフェーズ別タスクと完了条件 | 実装者・Cursor |
| `sql/00_inspect_current_schema.sql` | 現行スキーマの吸い出し（参照のみ） | 最初に実行 |
| `sql/01_schema.sql` | スキーマ本体（DROP 文なし） | 2 番目に実行 |
| `sql/02_rls_realtime.sql` | RLS / Realtime / Storage | 3 番目に実行 |
| `sql/03_seed.sql` | 注意事項プレイリスト・演出プリセット | 4 番目に実行 |
| `sql/04_reports.sql` | スポンサー報告・進行実績の集計（参照のみ） | 大会後 |

## 実行順（v2 ハイブリッド）

```
00_inspect → 出力を確認
→ 05_archive_v1_rename（旧同名テーブルを *_v1 へ退避）
→ 01_schema → 02_rls_realtime → 03_seed
→ 06_hybrid_patch（bracket_snapshot / 写真パス等）
→ 07_fix_grants_rls（anon GRANT + トリガー SECURITY DEFINER。必須）
→ 08_realtime_replica_identity（Display のシーン同期用。推奨）
```

`events` 作成で RLS / 401 が出る場合は、まず `07_fix_grants_rls.sql` だけ再実行する。
Display がシーンから動かない場合は `08_realtime_replica_identity.sql` を実行する。

SQL はリポジトリの `supabase/migrations/` 配下を正とする。

`00_inspect` の (9) で同名テーブルが検出された場合は、
`02_データベース設計書.md` の 0 章「同名テーブルが存在した場合の判断」に従うこと。

**SQL は DROP 文を 1 つも含まない。** 既存テーブルは rename 退避するか、形が同じならスキップされる。

## この設計の要点（これだけは崩さない）

1. **抽選結果と演出を分離する** — 組み合わせは `draw_sessions` に確定済み。演出は再生のみ
2. **画面はシーン状態機械で駆動する** — Admin は `event_state` を更新、Display は購読
3. **テンプレ固定 + 実行時差し込み** — 大会名・広告・注意事項はコードではなくデータ
4. **Winners / Losers でページを分けない** — 同一画面のテーマを切り替える

## 未確定・要確認事項

- 現行スキーマを直接確認できていない（Supabase 連携に当該プロジェクトが含まれていなかった）。
  `00_inspect` の出力があれば、差分マイグレーションの形に書き換えられる。
- 注意事項スライドの実ファイル（`notices/notice-01.png` 等）は未作成。
  Storage の `tournament-media` バケットにアップロードすること。
- 花びら演出の透過 WebM（`vfx/petals.webm`）は既存資産からの流用を想定。
