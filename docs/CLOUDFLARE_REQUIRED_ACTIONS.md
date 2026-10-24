# Cloudflare実環境の確認結果と、次に必要な作業

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
