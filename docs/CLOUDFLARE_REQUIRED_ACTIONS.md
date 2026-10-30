# Cloudflare実環境の確認結果と、次に必要な作業

## 最新：試合結果→次試合の演出を公開済み（2026-10-25）

追加の手動Cloudflare作業はありません。既存D1／非公開R2／Secretを継続使用し、新規migrationも不要です。

- 専用Worker最終version: `8b3eff5e-ebf0-4dbe-b8d6-37fc957b4cac`
- 通常Worker最終version: `5a6faa66-35e4-49da-8c36-ca783dc6d705`
- 専用画面: https://tournament-through-rehearsal.pine-shaken.workers.dev/match-transition
- 通常大会は既存4名・第1試合開始待ちを維持。結果入力・初期化は検証専用runだけで実施。

[公開確認URL・使い方・調査と検証結果](MATCH_RESULT_PRESENTATION.md)。以下のversion記載は過去の記録です。
## 最新：通しリハーサルを公開済み（2026-10-25）

追加の手動Cloudflare設定は不要です。専用Worker `tournament-through-rehearsal`（version `3e43f1b5-7bdd-445b-9ae6-078c469f10ee`）を既存D1／非公開R2へ接続し、既存の2つのSecretを設定済みです。`REHEARSAL_ENABLED=1` は専用Workerのみで有効、sourceは読取専用の `cf-rehearsal-001`。`cf-through-<UUID>` の新規検証大会を作成し、既存大会を削除・初期化しません。

通常Workerもversion `7e70a5e6-cce5-4128-81f0-de49029c5779` に更新済みで、通常大会の4名・ペア・第1試合開始待ち・結果未入力を保持しました。通常Workerの大会作成APIは無効です。新規DB・R2・migration・依存追加・バケット公開・ブラウザへのToken設定は不要です。

専用公開入口： https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal

再公開は `npm run build:checkin` → `wrangler deploy --config cloudflare/checkin/wrangler.through-rehearsal.jsonc`。既存のSecret・bindingを継続利用します。通常画面は再読み込みしてください。[使い方・準備済み大会URL・完走記録・発見不具合](THROUGH_REHEARSAL.md)。以下は前段階の記録です。
## 最新：第1試合→第2試合の進行を反映済み（2026-10-25）

追加の手動Cloudflare作業は不要です。通常Workerはversion `36ba4275-71de-4244-bc56-0a6397922255`。既存のD1 `operation_log` にコマンド履歴を記録し、WINNER後の更新済みBracket表示から次VSへ自動接続しました。DB migration、新しい依存、バケット公開、ブラウザへのToken追加はありません。

隔離Worker `tournament-match-loop-e2e`（version `837be8aa-77da-487e-a401-076de44abaaa`）、event `cf-match-loop-e2e-20261025` を既存D1・非公開R2へ接続済みです。既存4名の写真を各2件の検証用登録へコピーし、模擬勝敗を1試合だけ入力しました。通常大会の勝敗は変更していません。隔離大会は第2試合の開始待ちです。

確認コードは従来と同じです。既に開いている通常画面は再読み込みしてください。再公開は専用build後、通常用 `cloudflare/checkin/wrangler.jsonc`／検証用 `cloudflare/checkin/wrangler.match-loop-e2e.jsonc` を指定します。既存大会の初期化は不要です。[状態・公開URL・検証記録](MATCH_PROGRESS_LOOP.md)。以下は前段階の記録です。
## 最新：ペア発表・ゲーム開始の待機を反映済み（2026-10-25）

追加で依頼する手動Cloudflare作業はありません。通常Workerをversion `7482c5dd-7f9f-411b-b835-e64b9d0b6de0` に更新し、通常大会の既存ペア・現在試合を維持しました。開いたままの端末は画面を再読み込みしてください。

検証専用Worker `tournament-pair-gates-e2e` を同じ既存D1／非公開R2へ接続し、独立event `cf-pair-gates-e2e-20261025` と既存と同じ2つのWorker Secretを設定済みです。DB・R2作成、migration、バケット公開、ブラウザへのAPI Token追加は不要です。実登録4名の既存写真・ratingをコピーし、受付終了→発表待ち→Draw→Bracket待ち→ゲームスタート→第1試合VS待ちを公開確認しました。新しい実機撮影ではありません。

今後コードだけ再公開するときは、既存依存がある作業ディレクトリで `npm run build:checkin` → `wrangler deploy --config cloudflare/checkin/wrangler.jsonc`。検証専用は `wrangler.pair-gates-e2e.jsonc` を使用します。通常大会を初期化したり、既存の確定ペアを再作成したりする操作は不要です。

[最新操作・検証結果・残作業](PAIR_ANNOUNCEMENT_FLOW.md)。以下は過去時点の記録です。

## 最新：大会の連続進行を公開済み（2026-10-25）

追加の手動Cloudflare操作は不要。既存のmatches・event_state・events.bracket_snapshot・command_receiptsへ連続進行を接続し、DB migrationや新規依存は追加していません。通常Workerを更新し、隔離した `tournament-flow-e2e` を同じDB/private R2へ固定event IDで追加しました。既存の確認コード・署名キーをWorker Secretとして設定済み。

通常大会は4名・確定2ペアで最初の試合の開始待ち。隔離検証は8名・4チーム・7試合で終了。新しい設定作業のために通常大会を再作成・初期化する必要はありません。[最新の運営手順・検証結果](TOURNAMENT_FLOW.md)。以下は過去記録です。

## 最新：既存Drawへの接続を反映済み（2026-10-25）

通常受付Workerと検証Workerを更新しました。通常大会の現在の登録は3名のため、4名目の登録後に受付終了→Drawの確認が残っています。設定作業待ちではありません。新しいDB・R2・Secret・migrationの適用は不要です。既存BracketライブラリをWorkerで再利用するため、両wrangler設定に `compatibility_flags: ["nodejs_compat"]` を追加済みです。既存の依存を利用し、インストール・更新はしていません。公開ブラウザにトークンを追加していません。

`npm run build:checkin` → `wrangler deploy --config cloudflare/checkin/wrangler.jsonc` で更新できます。旧read-only Worker・Supabase環境・サンプルPreviewの再公開は不要です。[操作と公開確認結果](DRAW_D1_REHEARSAL.md)。

## 最新：受付フローの設定反映済み（2026-10-25）

追加の手動設定なしで [通常受付](https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin) を利用できます。本人写真付き1名は保持。専用検証大会4名は受付終了済みです。

今回実施済み：

- remote D1を `cloudflare/backups/before-checkin-lifecycle-20261025.sql` に退避（Git除外）。
- `0003_checkin_lifecycle.sql` を適用。既存participantsにversion追加、受付状態・操作再送記録・写真削除記録・整合性トリガーを追加。既存行は削除・書換えなし。**同じSQLを再適用しないでください。**
- `tournament-checkin-rehearsal` を更新、`tournament-checkin-e2e` を追加。DB/private R2は既存を使用し、大会IDとcookie署名を分離。既存の確認コードを各WorkerのSecretとして使用。
- 各Workerの `scheduled` と `*/5 * * * *` を設定。写真削除失敗の再試行用。R2のpublic化は不要。

今後の更新は `npm run build:checkin` → `wrangler deploy --config cloudflare/checkin/wrangler.jsonc`。既存のWranglerを使用し、依存追加・更新なし。確認コードやSecretファイルを公開リポジトリに含めないこと。

Cronは [Cloudflare公式のWrangler設定](https://developers.cloudflare.com/workers/wrangler/configuration/) に従って構成管理しています。受付状態と写真後処理は [運用手順](CHECKIN_LIFECYCLE.md) を参照してください。以下は過去の調査時点の記録です。

2026-10-25最新: 受付Workerに実データ専用の運営確認・演出確認、canonical portrait APIを公開済み。新しいDB・R2・Secret設定、migrationの追加は不要。公開実写E2Eは本人写真の登録待ち。[最新のURL・保存経路・検証状況](CHECKIN_REHEARSAL.md#現在登録データから演出までの接続2026-10-25)。以下の写真1件保存は過去の模擬カメラによる記録であり、本人写真での確認済みを意味しない。

## 最新追記：公開受付・写真表示の最小実装

2026-10-24、既存基盤とは別の `tournament-checkin-rehearsal` Workerを公開し、専用確認コード／セッションを設定済み。既存D1の検証大会へ参加者1件、非公開R2へ写真1件を保存し、別セッションのDisplayで表示を確認した。利用開始のための追加Cloudflare操作は不要。既存DB・R2の再作成やpublic化、既存APIへのトークン追加は行わない。[操作・更新・秘密設定・検証記録](CHECKIN_REHEARSAL.md)。以下は従来基盤の経過記録。

## 最新状態：初期準備と接続確認は完了

2026-10-24、[依頼.md](./依頼.md) にてWorker公開、health 200、state未認証401、DISPLAY_API_TOKEN認証200、remote D1から検証大会取得成功の報告を受領。今回CLIでも `tournament-rehearsal` の公開・Secrets更新履歴を確認した。認証付きAPIの再試験は今回行っていない。

以下の「Worker未公開」「10007」はその前の調査時点の記録。現在の未完了作業として扱わない。DB/R2作成・初期SQL適用・Worker公開をやり直す必要はない。以後は [PLAN.md](../PLAN.md) のM1.1（新規画面での読取接続）からアプリ実装を進める。固定トークンの接続成功と、利用者別の管理セッション・業務更新APIの実装完了は別である。

## 以下は初回調査時点の記録

確認日: 2026-10-24 JST。既存Wrangler `4.71.0` のログインを使い、実リソースを照合した。新規インストール・アップグレード・リソース作成・Worker公開・大会データの更新／削除は行っていない。D1にはSELECT／PRAGMAのみを実行した。verify.sqlのfile実行ではWranglerがクエリファイルを転送するため、metadata上のchanged_dbと業務行の変更は区別する（rows_writtenは0）。

## 1. 演出調整を始めるためのCloudflare作業

**今のローカル演出確認にはCloudflare側の追加作業は不要。** `npm run dev:rehearsal` で起動し、`/local-rehearsal` または `/show-preview` を開く。

写真のクラウド保存と独立したAdmin／Displayの同期を含む運用リハーサルには、以下の設定と [PLAN.md](../PLAN.md) の業務API実装が必要。DB作成だけで旧 `/rehearsal` が動く構成にはなっていない。

## 2. 見つかった環境

対象アカウントID: `5b27490470fa62bc7b51865e4e2cd786`。アカウントIDは秘密値ではない。

[Cloudflareの対象アカウントを開く](https://dash.cloudflare.com/5b27490470fa62bc7b51865e4e2cd786)

画面で見つからない場合、まず選択中アカウントを確認する。アカウント内のD1／R2の一覧で以下の正確な名前を探す。

| 種類 | 実名・ID | 実測 |
|---|---|---|
| D1 | `tournament-rehearsal-db` | 存在。作成2026-10-12。約0.25MB |
| D1 ID | `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c` | リポジトリの設定例と一致 |
| 写真用R2 | `tournament-rehearsal-portraits` | 存在、0 objects／0 B、r2.dev公開なし、custom domainなし |
| 素材用R2 | `tournament-rehearsal-media` | 存在、0 objects／0 B、r2.dev公開なし、custom domainなし |
| 想定Worker | `tournament-rehearsal` | deployments照会でcode 10007「このアカウントには存在しない」 |

別名Workerの有無までは網羅していない。この名前のWorkerがないという確認であり、アカウント内の全Workerがないという意味ではない。

D1の実データ:

- アプリテーブル15個と管理用テーブルあり。D1一覧のnum_tables欄だけで空DBと判断しない。
- `d1_migrations` に `0001_tournament.sql`、`0002_command_receipts.sql`。適用日時は2026-10-12 15:26:07／08 UTC。
- 大会 `cf-rehearsal-001`、名称「Cloudflare接続確認用大会」、environment=`rehearsal`。
- 参加者2名、event_stateはscene=`idle`、version=`0`。
- `PRAGMA foreign_key_check` の違反0件。
- R2は空で、写真登録や演出素材配置はまだ行われていない。

前回の文書の「Cloudflare実リソース未確認」は、今回この範囲について解消した。DB・R2の初期準備は実施済みだったと確認できる。

## 3. 読み取り確認を再現するコマンド

インストール済みWranglerを使用する。`npx`による暗黙の導入は不要。

```powershell
wrangler --version
wrangler whoami
wrangler d1 list
wrangler r2 bucket list
wrangler d1 execute tournament-rehearsal-db --remote --command "SELECT id,title,environment FROM events; SELECT COUNT(*) AS participants FROM participants; SELECT event_id,scene,version FROM event_state; SELECT * FROM d1_migrations; PRAGMA foreign_key_check;" --json
wrangler r2 bucket info tournament-rehearsal-portraits
wrangler r2 bucket info tournament-rehearsal-media
wrangler r2 bucket dev-url get tournament-rehearsal-portraits
wrangler r2 bucket dev-url get tournament-rehearsal-media
wrangler r2 bucket domain list tournament-rehearsal-portraits
wrangler r2 bucket domain list tournament-rehearsal-media
wrangler deployments list --name tournament-rehearsal --json
```

最後のコマンドは初回調査時点では10007だった。現在は公開済みで、今回の照会でも履歴が返った。DB初期化や再作成は不要。

## 4. Cloudflare接続確認を次に進める場合

以下は今回未実施の操作。ローカルのUI/UX調整が済んだ後、対象リソースを確認して進める。

### A. 既存リソースを実設定へ結び付ける

クローンのルートで、実設定がなければ作成する。

```powershell
if (!(Test-Path cloudflare/wrangler.jsonc)) {
  Copy-Item cloudflare/wrangler.jsonc.example cloudflare/wrangler.jsonc
}
```

`database_id` が上記の実ID、bindingがDB／PORTRAITS／MEDIA、バケット名が上記2つであることを確認。実設定はGit除外対象。既存設定がある場合は上書きせず照合する。

remoteには0001／0002とseedが適用済みなので、再作成・初期化・一括再適用は不要。今後のschema変更は新しいmigrationにする。

### B. 読取APIをローカルで確認する

既存 [CLOUDFLARE_API_RUNBOOK.md](./CLOUDFLARE_API_RUNBOOK.md) の方法に従い、異なる管理用・Display用キーを `cloudflare/.dev.vars` に用意する。キーは32文字以上、URL／VITE変数／Gitへ入れない。

```powershell
# ローカルD1はremoteとは別。ローカル用DBへの準備のみ。
wrangler d1 migrations apply DB --local --config cloudflare/wrangler.jsonc
wrangler d1 execute DB --local --config cloudflare/wrangler.jsonc --file cloudflare/seeds/rehearsal.sql
wrangler dev --config cloudflare/wrangler.jsonc
```

`/api/health` 200に加え、state APIの未認証401／認証付き200を確認する。現状のAPIは読取専用なので、この時点でも写真登録や勝敗処理はできない。

### C. 外部から接続する必要が出たら検証Workerを公開する

UI調整用に今すぐ公開する必要はない。公開対象・認証方式・許可eventIdを確認した後、読取APIの公開確認を行う場合の順序:

1. localで認証付き状態取得を成功させる。
2. Worker名 `tournament-rehearsal`、対象アカウント、D1、R2を再確認。
3. 公開専用の異なるキー2つをWorker Secretsに用意する。
4. `wrangler deploy --config cloudflare/wrangler.jsonc` で対象Workerを公開し、`wrangler secret put ADMIN_API_TOKEN --config cloudflare/wrangler.jsonc` と `DISPLAY_API_TOKEN` を設定。対話入力を使い、値をコマンド履歴や資料へ書かない。
5. 秘密値未設定の間はstate APIが503になることを確認。設定後に公開URLで未認証401／認証付き200を確認。

ここで使う固定トークンは接続検証専用。ブラウザに管理トークンを埋め込む方式で本番Admin認証を代用しない。

## 5. 設定だけでは完成しない残作業

実装PLANのM1～M6に沿って、Admin認証・大会権限、登録／写真upload／取得、抽選／勝敗／undo、DOによる調停と配信、frontend切替を実装する。複数Display同期・音声・会場実機での通し確認も必要。

現時点のローカルrehearsalは端末内保存であり、R2に写真が増えなくても正常。元の `/rehearsal` はSupabase版のままなので、今回のCloudflare DBが存在するだけでは動かない。

## 6. 参照

- [D1の開始手順](https://developers.cloudflare.com/d1/get-started/)
- [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers SPA配信](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
