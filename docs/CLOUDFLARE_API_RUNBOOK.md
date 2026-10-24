# Cloudflare API：ローカル接続確認

## 2026-10-24追記：公開接続確認は完了

`docs/依頼.md` の報告により、検証Worker公開、health 200、state未認証401／Display認証200、remote D1から `cf-rehearsal-001` の状態取得が完了。公開履歴も今回CLIで確認した。以下は読取APIの確認・再現用手順として保持する。公開を未完了のタスクとしてやり直さず、次は [PLAN.md](../PLAN.md) の段階的なアプリ実装へ進む。

2026-10-13。環境準備の次の段階です。検証用大会の状態を取得するWorkerを追加しました。現時点では読取専用で、登録・抽選・勝敗確定・写真配信・画面接続は後続の実装です。

## 1. 変更内容

- `cloudflare/src/index.ts`：Workerの入口。
- `GET /api/health`：稼働確認。DBや秘密値は返しません。
- `GET /api/events/cf-rehearsal-001/state`：認証してD1の状態を取得。
- 設定の `ALLOWED_EVENT_IDS` に含まれる検証用大会だけにアクセス可能。
- 管理用・Display用に別々のBearerキーを使用。どちらも今は読取専用。
- APIキー未設定の場合は503、未認証は401、許可外大会は403。

これは検証段階のAPIキー認証です。利用者のログイン・セッションや個人別監査はまだ実装していません。キーを `VITE_*` 環境変数やURLへ入れないでください。Workerの秘密値は [Cloudflare公式のSecrets説明](https://developers.cloudflare.com/workers/configuration/secrets/) に従って扱います。

## 2. ローカル用のキーを作る

プロジェクトのターミナルで実行します。

```bash
cd /Users/test/01client/ace/tournament
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

64文字のランダムな文字列が出ます。同じコマンドをもう一度実行し、**異なる2つ**を用意します。

エディタで `cloudflare/.dev.vars` という新しいファイルを作り、以下を記入します。右側をそれぞれ生成した文字列へ置き換えます。ファイルはGit管理対象外です。

```dotenv
ADMIN_API_TOKEN=管理用に生成した文字列
DISPLAY_API_TOKEN=Display用に生成した別の文字列
```

このファイルをチャットへ貼る必要はありません。両方とも32文字以上で、同じ値でない必要があります。

## 3. ローカルDBを用意してWorkerを起動

remoteに保存したサンプルとlocalは別です。ローカルにサンプルがない場合に備え、次を実行します。

```bash
npx wrangler d1 migrations apply DB --local --config cloudflare/wrangler.jsonc
npx wrangler d1 execute DB --local --config cloudflare/wrangler.jsonc --file cloudflare/seeds/rehearsal.sql
npx wrangler dev --config cloudflare/wrangler.jsonc
```

起動後、ターミナルを開いたままにします。表示されたURL（通常 `http://localhost:8787`）の `/api/health` をブラウザで開き、`ok: true` が返れば起動成功です。ポートが違う場合は以下のコマンドも読み替えてください。

## 4. 未認証で拒否されることを確認

別のターミナルを開いて実行します。

```bash
curl -i http://localhost:8787/api/events/cf-rehearsal-001/state
```

`401` と `UNAUTHORIZED` が出れば正常です。`503 API_NOT_CONFIGURED` なら `.dev.vars` の場所、キー名、文字数を確認しWorkerを再起動します。

## 5. 認証付き取得を確認

キーをコマンド履歴に残さないよう、以下を**1行ずつ**実行します。Macのzsh向けです。

```bash
read -rs 'CF_CHECK_TOKEN?管理用キーを貼り付けてEnter: '
```

入力文字は表示されません。`.dev.vars` の管理用キーを貼り付けてEnterを押したら、次を実行します。

```bash
curl -i -H "Authorization: Bearer $CF_CHECK_TOKEN" http://localhost:8787/api/events/cf-rehearsal-001/state
```

期待する結果：HTTP `200`、`role: admin`、大会名 `Cloudflare接続確認用大会`、`scene: idle`、`version: 0`。その後、変数を消します。

```bash
unset CF_CHECK_TOKEN
```

同じ手順をDisplay用キーでも試すと `role: display` になります。キーはAPIへ渡す必要がありますが、問い合わせやエラー報告には含めないでください。

## 6. 公開時の手順（現在は実施済み・再現用）

ここまでが今回のローカル確認です。型チェックと74 unit testは成功していますが、実WorkerからのD1取得は上の手順で確認してください。unit testのD1はmockで、Cloudflare上の実リソースに対するテストではありません。

Worker公開は別の操作です。公開するときは次の準備を実施します。

1. ローカルの認証付き取得を確認する。
2. 検証用Worker名、対象D1・R2、許可event IDを確認する。
3. ローカル用とは別の公開用キー2つを用意する。
4. Workerを公開し、Cloudflare Secretsに `ADMIN_API_TOKEN` と `DISPLAY_API_TOKEN` を登録する。秘密値が未設定の間、状態APIは503で拒否します。
5. 公開URLで未認証401・認証付き200を確認する。

具体的な公開操作はローカル検証後に進めます。認証のない更新APIはありません。Supabase版アプリはまだこのAPIを利用していません。

次のコード実装は個人のAdminセッションと大会権限、Durable Objectでのコマンド調停、D1への原子的保存、frontend接続です。管理用キーをブラウザへ埋め込む方式で代用しません。
