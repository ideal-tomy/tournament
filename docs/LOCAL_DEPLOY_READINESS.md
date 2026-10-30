# ローカル起動・Cloudflare公開準備の検証（2026-10-30）

**これは前段の8名・公開準備時点の記録です。現在の32人大会・公開Worker・確認URLは [REHEARSAL32.md](REHEARSAL32.md) を使用してください。** この記録の後、同じ既存canonical Workerへ32人対応を公開しています。

## 対象と変更

この作業ディレクトリに存在していた未コミット実装を含むCloudflare受付版を対象とした。通常の `dev` / `build` / `preview` をCloudflare版へ統一し、旧Supabase版はlegacyコマンドとした。既存の未コミット差分を巻き戻していない。

- `scripts/local-app.mjs`：初回専用Secret生成、画面build、ローカルmigration・seed、API／画面同一origin起動。開発中は画面build watchも起動する。
- `cloudflare/local/wrangler.jsonc`：remoteリソースのID・バケット名を使用しない、ローカル専用D1/R2設定。
- `cloudflare/local/seed.sql`：初期制御大会・受付元大会の追加のみ。既存大会を変更しない。
- `src/checkin/main.tsx`：run未指定の検証用管理・受付・Displayに大会選択案内を追加。通常大会Workerでは既存経路を維持する。
- `vite.config.ts`：junction参照を維持し、通常テストのGSAP解決エラーを解消。
- `scripts/check-deployment.mjs`：通常／通し検証Workerのbundleとbindingをdry-run検証。出力先を絶対パスでworkspace内に固定。
- READMEと `vercel.json`：現行Cloudflareと旧Supabase/Vercelの入口・成果物を区別。

## 保護・環境

- Node 22.14.0、既存Wrangler 4.152.0、既存Playwright＋インストール済みMicrosoft Edgeを利用。
- このPCのnode_modulesは元のtournament/node_modulesへのjunction。新規インストール・共有依存の更新は行っていない。
- 検証先は `http://localhost:5174`、D1/R2保存先は `.wrangler/local-app`。
- local Secretは `cloudflare/local/.dev.vars`（Git除外）。既存公開Secret・通常大会・公開D1/R2には変更なし。
- 公開・push・remote migrationは実行していない。

## 確認結果

| 境界・チェック | 実測 |
|---|---|
| 管理・受付・Displayの直アクセス | ログイン画面を表示。Supabase環境変数不要 |
| 実フォームの認証 | 誤コード拒否、正コード成功、ログアウト成功 |
| Cookie／Origin | Secure・HttpOnly・SameSite=Strictを維持。外部Originの更新403 |
| 大会未指定 | 大会選択案内を表示 |
| 受付フォーム→API→D1/R2 | 模擬PNGを選択し、JPEGへcropして登録。再読込で同じ参加者を復元 |
| 編集・写真差し替え | 同じ参加者IDで名前・写真・version更新。参加者が増えない |
| 非公開写真 | 未認証401、別の認証済みブラウザから200 |
| 外部通信 | 受付ブラウザ検証で外部リクエスト0、JS例外0、想定外HTTP失敗0 |
| 標準unit | `npm test -- --reporter=dot`：25ファイル・179テスト成功 |
| 型検査・build | `npm run build`成功（checkin Workerの型検査を含む）。`npm run cf:typecheck`も成功 |
| 公開準備 | 通常／通し検証Worker双方のdeploy dry-run成功。公開せず終了 |
| 再起動 | `npm run dev`を停止→`npm run preview`で起動。migration適用済みを認識し、D1の完走大会・優勝結果とR2の編集後写真を復元 |

## 通し検証の最終結果

2026-10-30 17:45 JSTに開始した最終実行は成功（exit 0）。8名・4チーム・6試合で優勝し、条件付き決勝リセットを含む7枠のうち、今回はリセット不要で終了した。全8名の写真、4ペア、ペア一覧、WINNER、更新Bracket、FINAL、CHAMPIONを確認した。D1のdone試合数と勝者操作ログはともに6件。整合性一致、想定外HTTP失敗0、JS例外0。

一時停止→再開、意図的な開始API503→停止→同一requestIdで再開、優勝状態のリロード復元、新しいrunの準備後も完走大会が保持されることを確認した。標準unit、受付試験、再起動試験、両Worker dry-runも成功している。

- 確認入口：<http://localhost:5174/rehearsal?run=cf-through-ef6d8e80-596b-449b-b2a4-2cfed4f3ef4b>（8名準備済み・受付中）
- 運営：<http://localhost:5174/admin?run=cf-through-ef6d8e80-596b-449b-b2a4-2cfed4f3ef4b>
- Display：<http://localhost:5174/display?run=cf-through-ef6d8e80-596b-449b-b2a4-2cfed4f3ef4b>
- 完走大会：`cf-through-e0fe8cc6-1d1e-4eec-a812-5a202a4fb76a`（version 28）
- 確認コード：`cloudflare/local/.dev.vars` の `REHEARSAL_ACCESS_CODE`。値は本資料へ転記しない。

現在は `npm run preview` で固定buildを配信。実装を続ける際はこれを停止して `npm run dev` を起動する。以前から起動していた5173の旧版プロセスは停止していない。

## 証跡

- 認証・受付：`.wrangler/local-entry/result.json` と同ディレクトリのPNG。
- 通し操作：`.wrangler/local-e2e/progress.json`／`result.json`、各演出のPNG。
- サーバー再起動：`.wrangler/local-restart/result.json`、`champion-after-restart.png`。
- bundle：`.wrangler/deploy-check/normal`／`rehearsal`。
- Gitに含められる要約：[result.json](local-deploy-verification/result.json)。[大会選択](local-deploy-verification/01-select-event.png)、[受付・編集](local-deploy-verification/02-registration-edit.png)、[優勝表示](local-deploy-verification/03-champion.png)。全て模擬データで、認証値を含まない。
- 引渡し用の8名大会で `/admin?run=...` を直接開き、対象8名・大会運営の表示とJS例外0を最終確認：[管理画面](local-deploy-verification/04-admin-ready.png)。

## 試験中の問題と扱い

初回の通し操作は6試合で優勝まで到達したが、並行build中に素材404と短時間表示の観測漏れが発生した。固定buildのpreviewで確認する手順に揃えた。次の実行では8名・4ペア・WINNER・Bracket・FINAL・優勝の表示を確認できたが、ローカル初回に確認ダイアログが出ないため、テストの初回用handlerが最後まで残り、作り直し用handlerと重複した。handlerを必要な場合だけ登録するよう修正し、最終実行では新規大会準備・完走大会保持まで成功した。

受付検証スクリプトでは、登録初期versionを固定値とした期待と、ログアウト後の想定内401を失敗として集計した期待を修正した。受付APIやCookie仕様を変更してテストへ合わせる修正は行っていない。

## 今回の受入範囲と残る確認

8名サンプルによるローカルD1/R2の動作と、既存Cloudflare公開設定のbundle作成が対象。新しいPCでのclean install、remote公開後の実接続、実参加者のカメラ撮影、スマホ／会場LAN、音響、16/32名Cloudflare大会、広告、undo、運営／Display権限の分離は今回の合格項目に含めない。現行の確認コードは受付・運営・Display共通であり、役割別権限の分離を実装したとは扱わない。

Wranglerは既存インストールを利用した。package.json／lockfileへの開発依存固定は事前確認待ちで、承認がない間は実行しない。別PCでの再現にはWrangler CLIとブラウザ試験ツールの準備が必要。

参考：[Cloudflareのローカルデータ運用](https://developers.cloudflare.com/workers/local-development/local-data/)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)。local指定と同じpersist-toを使用し、公開DBのmigrationを流用実行しない。
