# ドキュメント案内

このディレクトリでは、今後の判断に使う資料だけを管理する。

## 正本

1. [`TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md`](./TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md)  
   演出、Show Control、進行制御、Cloudflare移行、実装順、受入基準の正本。

2. [`CLOUDFLARE_MIGRATION_UIUX_CURRENT_STATE_AUDIT.md`](./CLOUDFLARE_MIGRATION_UIUX_CURRENT_STATE_AUDIT.md)  
   2026-10-12時点の現行コード、Supabase依存、UI/UX、演出、移行課題の技術監査。

## 現行環境の運用資料

- [`CLOUDFLARE_API_RUNBOOK.md`](./CLOUDFLARE_API_RUNBOOK.md): 準備完了後の読取専用Worker APIのローカル認証・D1接続確認。

- [`CLOUDFLARE_SETUP_RUNBOOK.md`](./CLOUDFLARE_SETUP_RUNBOOK.md): 次段階の検証用D1・非公開R2の準備手順。実行用SQLは `cloudflare/` に配置。アプリ切替は別の開発段階。
- [`RUNBOOK.md`](./RUNBOOK.md): 現在のSupabase版を運用するための当日手順。
- [`KIOSK_SETUP.md`](./KIOSK_SETUP.md): 現在の表示端末セットアップ。

RUNBOOKとKIOSK_SETUPはCloudflare移行完了までの暫定資料。移行後は提案書に沿って更新する。

## 補助資料

- `hit_explosion_fullscreen_test.html`: 爆発動画の単体表示確認。
- `files.zip`: 過去資料の受領時アーカイブ。通常の実装判断には使用しない。

## 管理ルール

- 新しい方針は正本へ追記し、同じ目的の計画書を増やさない。
- 調査結果は日付・対象commit・実測範囲を明記する。
- 完了済みの作業指示、AI向け一時プロンプト、引継ぎ文書は残さない。
- 現行仕様と将来提案を同じ記述で混在させない。
