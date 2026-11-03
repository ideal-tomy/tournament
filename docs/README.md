# ドキュメント案内

**会場当日の基本フロー（スマホ受付・運営・モニター連動）:** [DAY_OF_EVENT.md](./DAY_OF_EVENT.md)

更新版の環境整理・全Route分類・既存Worker棚卸し・スマホ受付の入口は [ENVIRONMENT_CONSOLIDATION.md](ENVIRONMENT_CONSOLIDATION.md)。[Worker一覧](environment-verification/WORKERS.md)には稼働versionとbindingを記録。

**32人・16チーム・15試合の確認は [REHEARSAL32.md](REHEARSAL32.md) が現在の正本です。** 既存 `tournament-through-rehearsal` をcanonicalとし、5つのrouteを同じrunから確認します。過去の8名・match-loop等のURLへ移動しないでください。

ローカル起動・現行Cloudflare版のbuild／公開準備は [ルートREADME](../README.md) を入口とします。[2026-10-30の実装・検証結果](LOCAL_DEPLOY_READINESS.md) と [実行PLAN](../PLAN.md) を参照してください。旧Supabase版の手順とCloudflare版の手順を混用しないでください。

最新の試合結果演出の実装・既存コード調査・公開確認は [MATCH_RESULT_PRESENTATION.md](MATCH_RESULT_PRESENTATION.md) を参照。

このディレクトリでは、今後の判断に使う資料だけを管理する。

## 正本

1. [`TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md`](./TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md)  
   演出、Show Control、進行制御、Cloudflare移行、実装順、受入基準の正本。

2. [`CLOUDFLARE_MIGRATION_UIUX_CURRENT_STATE_AUDIT.md`](./CLOUDFLARE_MIGRATION_UIUX_CURRENT_STATE_AUDIT.md)  
   2026-10-12時点の現行コード、Supabase依存、UI/UX、演出、移行課題の技術監査。

## 現行環境の運用資料

- [THROUGH_REHEARSAL.md](./THROUGH_REHEARSAL.md): 最新。公開/rehearsalから受付→CHAMPIONを手動・自動で通す入口、サンプル準備・停止再開・初期化・完走結果。

- [MATCH_PROGRESS_LOOP.md](./MATCH_PROGRESS_LOOP.md): 最新。第1試合開始→勝者保存→WINNER→更新済みBracket→第2試合自動VS→開始待ちの公開確認結果と運営手順。

- [PAIR_ANNOUNCEMENT_FLOW.md](./PAIR_ANNOUNCEMENT_FLOW.md): 最新。受付終了で事前ペア保存、ペア発表開始、Bracket待機、ゲームスタート、第1試合VS後の待機。大会フロー再確認.mdへの対応。

- [`TOURNAMENT_FLOW.md`](./TOURNAMENT_FLOW.md): 前段階の実装記録。受付からChampionまでの連続運営。次試合の自動選択、開始・勝者確定、公開7試合完走、通常大会の開始待ち。

- [`DRAW_D1_REHEARSAL.md`](./DRAW_D1_REHEARSAL.md): 最新。登録参加者を既存Drawへ接続し、D1で確定ペアを保存してBracket表示。公開URL・E2E結果・操作手順。

- [`CHECKIN_LIFECYCLE.md`](./CHECKIN_LIFECYCLE.md): 最新の連続受付・編集・写真差し替え・削除・受付終了の公開URLと操作、4名公開検証の結果。

- [`CHECKIN_REHEARSAL.md`](./CHECKIN_REHEARSAL.md): スマホ撮影・参加登録から別端末Display確認まで。公開URL、確認コードの保存場所、Cloudflare設定・検証記録。

- [`ANIMATION_PREVIEW.md`](./ANIMATION_PREVIEW.md): 公開演出PreviewのURL、6シーンの操作、Cloudflare設定・再公開、検証記録。
- [`../PLAN.md#公開演出previewの先行計画2026-10-24`](../PLAN.md#公開演出previewの先行計画2026-10-24): 公開Previewの実装方針、既存2画面の調査、専用build、公開方法の比較。

- [`CLOUDFLARE_CHECK.md`](./CLOUDFLARE_CHECK.md): M1.1の読取確認画面、localhost専用proxy、秘密設定、検証結果と残課題。
- [`CLOUDFLARE_REQUIRED_ACTIONS.md`](./CLOUDFLARE_REQUIRED_ACTIONS.md): D1・R2の所在と初回調査記録。冒頭にWorker公開・接続確認完了の最新状態を追記。
- [`REHEARSAL_PREVIEW_GUIDE.md`](./REHEARSAL_PREVIEW_GUIDE.md): 2026-10-24の新規クローン照合結果、DB不要の演出確認の起動・操作手順。
- [`../PLAN.md`](../PLAN.md): 初期接続完了後のアプリ実装計画。次の最小単位、変更ファイル、実装順序、各段階の確認方法。

- [`CLOUDFLARE_API_RUNBOOK.md`](./CLOUDFLARE_API_RUNBOOK.md): 準備完了後の読取専用Worker APIのローカル認証・D1接続確認。

- [`CLOUDFLARE_SETUP_RUNBOOK.md`](./CLOUDFLARE_SETUP_RUNBOOK.md): 次段階の検証用D1・非公開R2の準備手順。実行用SQLは `cloudflare/` に配置。アプリ切替は別の開発段階。
- [`RUNBOOK.md`](./RUNBOOK.md): 現在のSupabase版を運用するための当日手順。
- [`KIOSK_SETUP.md`](./KIOSK_SETUP.md): 現在の表示端末セットアップ。

RUNBOOKとKIOSK_SETUPはCloudflare移行完了までの暫定資料。移行後は提案書に沿って更新する。

## 補助資料

- `hit_explosion_fullscreen_test.html`: 爆発動画の単体表示確認。
- 旧Supabase受領資料は [`../archive/docs/legacy-supabase/`](../archive/docs/legacy-supabase/) に保管。通常の実装判断には使用しない。

## 管理ルール

- 新しい方針は正本へ追記し、同じ目的の計画書を増やさない。
- 調査結果は日付・対象commit・実測範囲を明記する。
- 完了済みの作業指示、AI向け一時プロンプト、引継ぎ文書は残さない。
- 現行仕様と将来提案を同じ記述で混在させない。
