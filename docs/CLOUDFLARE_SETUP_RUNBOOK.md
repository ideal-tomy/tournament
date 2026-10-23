# Cloudflare移行：初めての方向け準備手順

作成日：2026-10-12。提案書のPhase 2に向けた環境準備。方針の正本は [演出・進行制御提案書](./TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md)。

## 今回のゴール

検証用のデータベースD1と、写真・素材の保管先R2を作り、サンプル大会が保存できることを確認します。**この手順の完了だけでは、アプリはCloudflare版に切り替わりません。** 現行AdminとDisplayは引き続きSupabaseを利用します。

今は本番データの移動、Supabaseの削除、ドメイン変更、Workerの公開は行いません。今回は新しい検証用リソースだけを使います。

| 用語 | 役割 | 今回の作業 |
|---|---|---|
| D1 | 大会・参加者・試合を保存するデータベース | 作成、SQL適用、確認 |
| R2 | 顔写真・動画などを保存する保管庫 | 非公開バケットを2つ作成 |
| Workers | ログイン確認や大会操作を処理するAPI | 次の開発段階で実装 |
| Durable Objects | 同じ大会の操作順と画面配信を調整 | 次の開発段階で実装 |
| Wrangler | Cloudflareをターミナルから操作する道具 | インストール、ログイン |
| migration | DBにテーブルを作る変更ファイル | 0001、0002を順番に適用 |
| binding | Worker内でリソースを呼び出す名前 | DB、PORTRAITS、MEDIA |

## 1. 用意されたファイル

プロジェクトの `cloudflare/` にあります。旧 `docs/files/` や `supabase/migrations/` のSQLをD1へ貼り付ける必要はありません。

| ファイル | 内容 | 実行する場所 |
|---|---|---|
| `wrangler.jsonc.example` | 設定のひな形 | コピーしてDBのIDを記入 |
| `migrations/0001_tournament.sql` | 大会用14テーブル | D1検証用DB |
| `migrations/0002_command_receipts.sql` | 二重送信対策の記録テーブル | 同じDB |
| `seeds/rehearsal.sql` | サンプル大会1件・選手2名 | 同じDB |
| `checks/verify.sql` | 作成結果の確認（読取のみ） | 同じDB |
| `checks/validate_schema.py` | SQLのローカル検証 | 自分のPC、任意 |

SQLは新規の空DB向けです。既存の別DBへ適用しないでください。認証・操作の冪等性はSQLだけでは完成せず、Worker実装が必要です。

## 2. ターミナルとNode.jsを確認

Macの「ターミナル」を開き、以下を1行ずつ貼り付けてEnterを押します。コード枠の中だけコピーしてください。手順中のコマンドは、特記がない限りプロジェクトのルートから実行します。

```bash
cd /Users/test/01client/ace/tournament
pwd
node --version
npm --version
```

`pwd` が上記のプロジェクトパスを表示すれば正しい場所です。Nodeとnpmはそれぞれバージョン番号が表示されます。`command not found` の場合は [Node.js公式サイト](https://nodejs.org/) の現在のLTS版をインストールし、ターミナルを開き直してください。Wranglerはサポート対象のNode.jsとOSが必要です。[Wrangler導入の公式説明](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## 3. Wranglerをインストール

```bash
npm install --save-dev --save-exact wrangler@latest
npx wrangler --version
```

初回だけネットワーク接続が必要です。`package.json` と `package-lock.json` が更新されます。以後はこのプロジェクトに記録したWranglerを使います。

続いてログインします。

```bash
npx wrangler login
npx wrangler whoami
```

ブラウザが開いたら作成済みCloudflareアカウントでログインし、許可画面を確認して承認します。`whoami` で対象アカウントが表示されれば成功です。複数のアカウントがある場合は今回使うアカウントを確認します。アカウントIDは記録できますが、APIトークンやパスワードを手順書やチャットへ貼り付ける必要はありません。

## 4. 設定ファイルをコピー

```bash
cp -n cloudflare/wrangler.jsonc.example cloudflare/wrangler.jsonc
```

何も表示されなくても正常です。`-n` は、作成済みの設定を上書きしないための指定です。エディタで `cloudflare/wrangler.jsonc` を開きます。この時点では `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c` はそのままで構いません。

このファイルはGit管理対象外です。作成するリソースは以下に統一します。

| リソース | 名前 | binding |
|---|---|---|
| D1 | `tournament-rehearsal-db` | `DB` |
| 写真R2 | `tournament-rehearsal-portraits` | `PORTRAITS` |
| 素材R2 | `tournament-rehearsal-media` | `MEDIA` |

## 5. Cloudflare上に検証用D1を作成

**ここからはCloudflareアカウントにリソースが作られます。**

```bash
npx wrangler d1 create tournament-rehearsal-db --config cloudflare/wrangler.jsonc
```

出力された `database_id` の値をコピーします。表示がJSON形式でもTOML形式でも、UUID形式のIDだけを使います。

設定ファイルの次の行の値を置き換えて保存してください。

```json
"database_id": "0a7528e1-7f14-4e54-a896-4fbe2cf2c42c"
```

置き換え後は `"database_id": "実際に表示されたID"` となります。ダブルクォートを残し、実際のIDを入れてください。`database_name` と `binding` は変えません。

同名DBが作成済みと言われたら新しく作り直さず、次で確認します。

```bash
npx wrangler d1 list --config cloudflare/wrangler.jsonc
```

CloudflareダッシュボードのD1画面からもIDを確認できます。CLI出力やダッシュボードでDB名が `tournament-rehearsal-db` であることを確認します。[D1コマンドの公式説明](https://developers.cloudflare.com/d1/wrangler-commands/)

## 6. 先に自分のPCでSQLを試す

`--local` はPC内の検証DBです。Cloudflare上のDBとは別物です。

```bash
npx wrangler d1 migrations apply DB --local --config cloudflare/wrangler.jsonc
```

確認が表示されたら、対象がローカルで、一覧が `0001_tournament.sql` と `0002_command_receipts.sql` であることを確認して進みます。両方が成功表示になれば次へ進みます。

サンプルデータを入れ、結果を確認します。

```bash
npx wrangler d1 execute DB --local --config cloudflare/wrangler.jsonc --file cloudflare/seeds/rehearsal.sql
npx wrangler d1 execute DB --local --config cloudflare/wrangler.jsonc --file cloudflare/checks/verify.sql
```

期待する結果は次のとおりです。

- テーブル一覧に `events`、`participants`、`matches`、`event_state`、`command_receipts` などがある。アプリ用15テーブルのほか、Wrangler管理用の表が出る場合があります。
- 大会名：`Cloudflare接続確認用大会`
- `environment`：`rehearsal`、`scene`：`idle`、`version` と `scene_seq`：`0`
- `sample_participant_count`：`2`
- `foreign_key_check` と `missing_state_event_id` の結果：0行（問題なし）

**エラーが出たらここで止めます。** Cloudflare上への適用はまだ行わず、コマンドとエラー文を保存してください。サンプル投入は再実行しても同じ大会・選手を増やさない構成です。

## 7. Cloudflare上にもSQLを適用

手順6が成功したら実行します。`--remote` はCloudflare上のDBに対する操作です。

```bash
npx wrangler d1 migrations list DB --remote --config cloudflare/wrangler.jsonc
npx wrangler d1 migrations apply DB --remote --config cloudflare/wrangler.jsonc
```

確認画面で検証用DB名と2つのSQLを確認してください。未適用の変更だけが適用されます。初回以降、同じ手順で「適用する変更なし」になっても正常です。適用済みSQLを編集して再実行せず、後の変更は新しいmigrationにします。[D1 migrationの公式説明](https://developers.cloudflare.com/d1/reference/migrations/)

続けてサンプル投入と確認を行います。

```bash
npx wrangler d1 execute DB --remote --config cloudflare/wrangler.jsonc --file cloudflare/seeds/rehearsal.sql
npx wrangler d1 execute DB --remote --config cloudflare/wrangler.jsonc --file cloudflare/checks/verify.sql
```

手順6と同じ結果になれば成功です。これでCloudflare上のDB準備が完了します。

## 8. R2を有効化し、非公開バケットを作成

Cloudflareダッシュボードの「R2」を開きます。初回はサービス有効化や支払い情報の登録が求められる場合があります。画面上の条件・料金を確認してから進めてください。[R2開始の公式説明](https://developers.cloudflare.com/r2/get-started/)

有効化後、ターミナルで実行します。

```bash
npx wrangler r2 bucket create tournament-rehearsal-portraits --config cloudflare/wrangler.jsonc
npx wrangler r2 bucket create tournament-rehearsal-media --config cloudflare/wrangler.jsonc
npx wrangler r2 bucket list --config cloudflare/wrangler.jsonc
```

作成中に `Would you like Wrangler to add it on your behalf?`（設定へ追加しますか）と聞かれたら **no** を選びます。設定ひな形にすでに両バケットがあるためです。`What binding name` は名前の入力欄で、yes/noの質問ではありません。誤って追加した場合は `r2_buckets` を `PORTRAITS` と `MEDIA` の2件に整理し、追加された `y` の項目を除きます。

一覧に2つの名前が表示されれば成功です。同名が存在するときは一覧とダッシュボードで確認し、再作成しません。[R2コマンドの公式説明](https://developers.cloudflare.com/r2/reference/wrangler-commands/)

ダッシュボードで各バケットの設定を開き、公開用の `r2.dev` URLとカスタムドメインを有効化していないことを確認してください。写真は将来Workerの認可付き配信を使います。今回は写真アップロード、CORS、S3 APIキー作成は不要です。

## 9. 完了チェックと次の開発への引継ぎ

- [ ] `whoami` で対象アカウントを確認した
- [ ] `wrangler.jsonc` に実際のD1 IDを入れた
- [ ] localで2つのmigrationが成功した
- [ ] remoteでも2つのmigrationが成功した
- [ ] remoteにサンプル大会1件・選手2名がある
- [ ] 外部キー違反とevent_state欠落が0件だった
- [ ] R2の2バケットが存在し、公開していない

次の開発を依頼するときは、以下をコピーして結果を記入すれば十分です。

```text
Cloudflare準備結果
Wranglerバージョン：
D1名：tournament-rehearsal-db
local migration：成功 / 未完了
remote migration：成功 / 未完了
サンプル選手数：
外部キー違反・状態欠落：0件 / その他
写真R2：作成済み / 未完了
素材R2：作成済み / 未完了
R2公開設定：無効 / その他
エラーがある場合：実行したコマンドとエラー文
```

## 10. 次に開発側で実装するもの

以下は今すぐ手動で設定する手順ではなく、コード実装が必要な作業です。

| 順番 | 開発内容 | 完了の確認 |
|---|---|---|
| 1 | Worker API、Admin認証・大会単位の権限、Display読取認証 | 未認証の更新を拒否し、権限外大会を操作できない |
| 2 | D1 repository、登録・抽選・勝敗確定コマンド | 勝敗・snapshot・scene・ログを一括保存 |
| 3 | Durable Object、requestIdとversion検証 | 同時操作・再送でも結果が二重反映されない |
| 4 | 非公開R2アップロード・認可付き配信・削除ジョブ | 写真の登録・取得・再試行を確認 |
| 5 | Display配信・再接続・開始時刻補正 | 2台が同じversionへ復帰し、Displayが永続状態を変更しない |
| 6 | frontendのAPI切替、Show Control、連続演出接続 | NEXT MATCH自動到達・試合開始手動を確認 |
| 7 | 検証用Worker公開、サンプル大会の完走 | 登録から優勝まで確認してから移行判断 |

Admin認証方式は実装前に確定します。Cloudflare Accessを使う場合も、Worker側で本人・対象大会の権限を検証します。現行の `VITE_ADMIN_PASSCODE` や `admin_token` を新認証として流用しません。

Durable Objectのbindingとclass migration、Workerの `main`、Static Assets、秘密値は、動くWorkerのコードと一緒に追加します。2026-10-13に読取専用Workerの `main` と許可event ID設定を追加しました。次の確認は [API接続手順](./CLOUDFLARE_API_RUNBOOK.md) に沿って行います。公開前に秘密値の準備とローカル確認が必要です。

## 11. 既存データ移行はその後

今回のSQLはリポジトリ内のv2設計と `06_hybrid_patch.sql`、現行の型を基にした新DB用です。実際のSupabaseのスキーマや保存データを取得して比較したものではありません。

移行前に実DBの列・件数・写真一覧を確認し、必要な差分を新migrationで追加します。PostgreSQLのdumpをD1へそのまま取り込めないため、専用変換と照合が必要です。[D1 import/exportの公式説明](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

主な対応は以下です。

| 旧Supabase | D1の準備SQL | 開発時の扱い |
|---|---|---|
| UUID自動生成 | TEXT、ID指定必須 | WorkerでUUID生成 |
| jsonb | JSON文字列のTEXT | API境界でparse/stringify |
| boolean | INTEGERの0/1 | APIでbooleanへ変換 |
| 日付型 | UTCのISO文字列 | Workerで統一 |
| bracket_snapshotなど追加列 | 0001へ統合 | 既存ID・snapshot整合性を照合 |
| admin_token | 新DBには作らない | 新認証へ置換 |
| triggerでstate作成・updated_at更新 | triggerなし | Workerの保存処理が明示的に行う |
| RLS・Realtime publication | 移植しない | Worker認可・DO配信で置換 |
| v_next_match・v_team_display | 今回はビューなし | 確定したサーバークエリで計算 |

イベントをまたぐチーム・参加者の参照、現在試合と勝者の一致、許可scene遷移などはWorker側でも検証します。DBの外部キーだけで大会運営の整合性が完成するわけではありません。

移行リハーサルで大会件数・参加者・チーム・試合・勝者・写真を照合し、本番の切替と復旧手順を作ってから本番DBを作ります。Supabaseの停止・削除はその後の別作業です。

## 12. よくあるエラー

| 表示・症状 | 対処 |
|---|---|
| `command not found: node` / `npm` | 手順2へ戻る |
| ログイン・権限エラー | `wrangler whoami`、`wrangler login`でアカウントを確認 |
| `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c` が残っている | 手順5でIDを記入 |
| DBまたはbindingが見つからない | `--config cloudflare/wrangler.jsonc` の指定とDB名を確認 |
| `table already exists` | 空DBではない可能性。削除せず、対象DBとmigration履歴を確認して報告 |
| `no such table` | local/remoteの取り違え、migration未適用を確認 |
| ローカル成功、remoteは空 | 手順7を実行したか確認。2つは別DB |
| R2作成時の有効化エラー | ダッシュボードでR2の有効化を確認 |
| バケット名が利用できない | 代替名を決め、設定ファイルのbucket_nameと作成コマンド両方を変更 |
| JSON設定の構文エラー | ダブルクォートとカンマを確認 |
| SQLは成功したがアプリに大会が出ない | 現段階では正常。Workerとfrontendの接続は未実装 |

DB削除や初期化で解決しようとせず、失敗した手順で止めてください。作成した検証環境はそのまま残せます。

## 検証記録

2026-10-12：同梱SQLをPython SQLiteの空DBへ順番に適用し、15テーブル作成、サンプルの二度投入で重複なし、外部キー違反なし、同一requestId拒否を確認。Cloudflare上でのWrangler実行・D1適用・R2作成は未実施です。Cloudflare固有の動作は手順6・7で確認してください。
