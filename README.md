> 最新の環境統合・公開8名E2E・旧Worker分類: [2026-10-31 統合報告](docs/CANONICAL_CONSOLIDATION_20261031.md)。今後の公開は `npm run deploy:rehearsal` のみ。

# ダーツ大会 — Cloudflare版（現在の標準）

**当日運用（受付→運営→モニター）：[docs/DAY_OF_EVENT.md](docs/DAY_OF_EVENT.md)**。環境整理・デプロイ：[docs/ENVIRONMENT_CONSOLIDATION.md](docs/ENVIRONMENT_CONSOLIDATION.md)。入口 <https://tournament-through-rehearsal.pine-shaken.workers.dev/>。32人SHOWは [docs/REHEARSAL32.md](docs/REHEARSAL32.md)。canonicalは `tournament-through-rehearsal`。

受付・ペア抽選・大会運営・Display・優勝表示を、同じWorker APIとD1／非公開R2で動かします。通常の `npm run dev` はこのCloudflare版です。Supabaseの環境変数は不要です。

## ローカルで確認する

Node.js 22.14以上と、インストール済みの依存を使用します。Wranglerは `node_modules/wrangler/bin/wrangler.js` を使用し、自動ダウンロードしません。このPCの `node_modules` は別フォルダのjunctionです。共有先を変更するインストールは行わないでください。

```powershell
Set-Location 'C:\Users\ryoji\00myapp\ai_demo_workspace\tournament-latest-review-20261024'
npm run dev
```

初回は画面build→ローカルmigration→初期大会の準備を行ってから起動します。

1. <http://localhost:5174/rehearsal> を開く。
2. `cloudflare/local/.dev.vars` の `REHEARSAL_ACCESS_CODE` を確認コードに入力する。初回起動時にローカル専用値を生成します。公開環境の確認コードとは別です。
3. 「サンプル32名・16チーム・15試合」とSHOW／FAST CHECKを選び、「初期化・参加者準備」を押す。ローカルD1に大会と32名、ローカルR2に模擬写真を保存します。旧8名ダブルも個別に選択できます。
4. 画面内の「運営画面を開く」「Displayを別ウィンドウで開く」「参加者受付を開く」を使用する。大会を指定する `?run=cf-through-...` はURLに保持します。
5. 手動確認は受付終了→ペア発表開始→Bracket→ゲームスタート→VS→試合開始→勝者確定。通しリハーサルの自動実行では模擬勝敗を入力して優勝まで進めます。

`/admin`、`/display`、`/checkin`の直アクセスでもログインできます。ローカル検証で大会未指定なら、大会選択の案内を表示します。別ブラウザでは各自確認コードを入力し、同じrun付きURLを開きます。

### 保存・再起動・開発中の反映

- 停止は起動ターミナルで `Ctrl+C`。再起動は `npm run dev`。migrationとseedは繰り返しても既存大会を消しません。
- 永続先は `.wrangler/local-app`。完走大会を含め保持します。再開にはrun付きURLを保存してください。「初期化」は既存大会を残して新規大会を作ります。
- frontend変更はViteのbuild watch、Worker変更はWranglerで反映します。画面再読み込み時は自動runnerが止まるので、状態を確認して再開してください。
- ポート使用中は既存サーバーを停止せずエラーにします。変更例：`$env:PORT='5180'; npm run dev`。以前の5173サーバーは旧版なので、新しい5174を開いてください。
- 起動先はloopbackのみ。ローカルD1/R2に限定し、remote DB ID／バケットを使用しません。スマホや会場端末での実機確認は公開検証環境で別途行います。
- `npm run preview` は現在のCloudflare buildを同じローカルAPIで配信します。frontend watchは行いません。変更後は先に `npm run build` を実行します。

### 検証コマンド

```powershell
npm test
npm run build
npm run cf:typecheck
npm run deploy:check
```

`deploy:check` は既存の通常Workerと通し検証Workerの両設定でbundle・binding・静的ファイルのdry-runを行います。公開もremote migrationも実行しません。出力は `.wrangler/deploy-check/normal` と `rehearsal` です。

ローカルのブラウザ通し検証（別ターミナルでサーバーを起動してから実行）：

```powershell
# このPCの既存Playwrightを利用。追加インストール不要。
$env:PLAYWRIGHT_MODULE='C:/Users/ryoji/AppData/Local/npm-cache/_npx/c61c9351a0dbcfa7/node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e:local
npm run test:entry:local
```

他のPCでは `PLAYWRIGHT_MODULE` に利用可能なPlaywrightモジュールのパス、`PLAYWRIGHT_CHANNEL` にインストール済みブラウザ（例：msedge、chrome）を指定します。未導入なら別途セットアップが必要です。結果・画像は `.wrangler/local-e2e/`。ローカルD1内の試合・操作履歴も照合します。

受付フォーム・認証の結果は `.wrangler/local-entry/`。サーバーを停止・再起動した後に `node scripts/verify-local-restart.cjs` を実行すると、直前の検証大会・優勝結果・編集した写真が復元されることを確認できます。`local:query`はローカルDBのSELECT用です（例：`npm run local:query -- "SELECT id,title,status FROM events"`）。

通し検証中は `npm run build` 等で成果物を更新せず、固定したbuildを配信する `npm run preview` を推奨します。検証中の画面自動更新と大会ロジックの失敗を混同しないためです。

## Cloudflareへの公開

公開成果物は `dist-checkin` と `cloudflare/checkin/src/index.ts`。**静的ファイルだけをVercel等へ配置しても受付・管理APIは動きません。** Worker・D1・R2・Secretを一体として公開します。

| 対象 | Wrangler設定 | 用途 |
|---|---|---|
| ローカル | `cloudflare/local/wrangler.jsonc` | ローカルだけのDB・R2。公開用ではない |
| 通常大会 | `cloudflare/checkin/wrangler.jsonc` | 既存通常大会を保持して更新 |
| 公開通し検証 | `cloudflare/checkin/wrangler.through-rehearsal.jsonc` | 新しい検証大会を作成できる専用Worker |

canonicalの公開は `npm run deploy:rehearsal` を使用します。32人確認のため既存canonicalへ公開済みです。通常大会を更新する場合は別途対象を確認してください。以下は同じ専用Workerを指定する個別コマンドです。

```powershell
npm test
npm run build
# 先に専用Workerでdry-run
node node_modules/wrangler/bin/wrangler.js deploy --config cloudflare/checkin/wrangler.through-rehearsal.jsonc --dry-run
# 公開対象が確定したときに実行
node node_modules/wrangler/bin/wrangler.js deploy --config cloudflare/checkin/wrangler.through-rehearsal.jsonc
```

通常大会の更新は `--config cloudflare/checkin/wrangler.jsonc`。既存D1/R2 bindingとWorker Secrets `REHEARSAL_ACCESS_CODE`／`SESSION_SECRET`を継続使用します。ローカルSecretを公開環境へコピーしません。初回の別環境ではD1/R2・schema・Secretsの準備が別途必要です。既存公開DBのmigration適用済み状況を確認せずSQLを再実行しないでください。

dry-runはbundle作成までの確認です。公開先の認証・実データ・実機カメラ・会場音響の動作を保証するものではありません。公開後は専用runで通し確認し、通常大会へ模擬勝敗を入力しない運用にします。

[実行計画](PLAN.md) ／ [2026-10-30検証結果](docs/LOCAL_DEPLOY_READINESS.md) ／ [詳細ドキュメント](docs/README.md)

旧Supabase版の画面、SQL、Vercel設定はリポジトリから外しています。公開とローカル確認は上のCloudflare手順だけを使います。

# 公開リハーサルの入口

環境整理・Worker一覧・受付から優勝までの確認結果は [docs/ENVIRONMENT_CONSOLIDATION.md](docs/ENVIRONMENT_CONSOLIDATION.md)。公開TOPは https://tournament-through-rehearsal.pine-shaken.workers.dev/ 。

ローカルは `npm run dev` → http://localhost:5174/ 。確認コードで入り「大会リハーサルを開始」へ進む。「スマホ受付から開始（参加者0名）」で新しい空大会を準備し、run付きの受付URLをスマホへ渡す。32人の観客通し確認は「サンプル32名・16チーム・15試合」を明示選択する。公開は `npm run deploy:rehearsal` 。旧Viteの5173は通常操作に使用しない。
