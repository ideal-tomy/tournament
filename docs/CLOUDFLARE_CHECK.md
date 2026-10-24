# M1.1：Cloudflare読取接続の確認

2026-10-24。`docs/依頼.md` の「次の最小単位」だけを実装した。既存Admin／Display・Supabase・Worker・D1 schema・R2処理は変更しない。

## 起動・動作確認URL

```powershell
Set-Location 'C:\Users\ryoji\00myapp\ai_demo_workspace\tournament-latest-review-20261024'
npm run dev:rehearsal
```

<http://127.0.0.1:5174/cloudflare-check?eventId=cf-rehearsal-001>

ホームにも「Cloudflare接続確認」を追加した。`/show-preview`・`/presentation`・`/local-rehearsal` はそのまま使用できる。

## 接続の仕組み

```text
新しい確認画面
  GET /__cloudflare_check/api/events/cf-rehearsal-001/state
  → localhost開発サーバーがDisplay認証を付加
  → 公開Worker GET /api/events/cf-rehearsal-001/state
  → D1 SELECT
  → 型検証・不要フィールド除外
  → 大会名・scene・scene_seq・version等を画面表示
```

ブラウザは固定トークンを保持しない。proxyは `vite.rehearsal.config.ts` の開発サーバーだけに登録し、buildや `vite preview` では使えない。既存の本番認証方式は決めていない。

## ローカル専用の設定

このPCではGit除外済みの `.env.cloudflare-check.local` に次を用意した。

```dotenv
CF_CHECK_WORKER_ORIGIN=https://tournament-rehearsal.pine-shaken.workers.dev
```

固定キーの読み込み順（サーバー側のみ）:

1. 実行プロセスの `CF_CHECK_DISPLAY_API_TOKEN`
2. `.env.cloudflare-check.local` の `CF_CHECK_DISPLAY_API_TOKEN`
3. 既存 `cloudflare/.dev.vars` の `DISPLAY_API_TOKEN`

公開Workerとローカル用のキーが異なる場合は、`.env.cloudflare-check.local` に公開用の読取キーを `CF_CHECK_DISPLAY_API_TOKEN=値` として記入する。秘密値をチャット・URL・VITE変数に入れない。`.dev.vars` を書き換える必要はない。設定はリクエストごとに読み、ファイル保存後は画面の「再取得」で反映する。プロセス環境変数を変更した場合はサーバーを再起動する。

このファイルと `.dev.vars` はGit除外に加え、Viteの直接ファイル配信も403で拒否する。設定内容を出力するコマンドやスクリーンショットで秘密値を共有しない。

## 制限

- 接続元はloopbackのみ。HostとOrigin、Sec-Fetch-Siteも確認する。
- GETのみ。POST/PUT/PATCH/DELETE/HEAD/OPTIONSは拒否。
- 固定の検証大会のstate pathだけを許可。query付き転送・別大会・任意pathは拒否。
- 接続先はHTTPSの `tournament-rehearsal.<subdomain>.workers.dev` originのみ。リダイレクトは追従しない。
- upstreamに送るのはサーバーのDisplayキーのみ。ブラウザのAuthorizationやcookieを転送しない。
- upstreamのエラー本文・ヘッダーを中継しない。成功時もDTOを再構成し、admin応答やキーを含む応答を拒否する。
- no-store。キーをブラウザbundle・画面・通信に含めない。
- DB更新API、R2 upload、抽選、勝敗、undoは追加していない。

## DTOと画面

専用DTOでschemaを検証し、以下を画面用read modelへ変換する。既存の `EventRow` にない値を仮の値で補ったり、Supabase型を変更したりしない。

| Worker JSON | 確認画面read model |
|---|---|
| scenePayload | scene_payload |
| sceneSeq | scene_seq |
| startedAt | scene_started_at（null保持） |
| currentMatchId | current_match_id（D1の文字列ID／null保持） |
| version | version（非負の整数） |
| awaitingOperator / presentationMode / audioEnabled | awaiting_operator / presentation_mode / audio_enabled |
| playbackPositionMs / updatedAt | playback_position_ms / updated_at |

loading、成功、401、403、404、500系、通信失敗、タイムアウト、不正JSON／型不一致、再取得を実装。失敗時は古い成功データを消し、成功のように見せない。ページ遷移や連続取得では前のリクエストを中断する。

## 検証結果

- 既存81件＋クライアント・DTO・proxyの54件、計135 unit tests成功（最終実行時）。buildとCloudflare型チェックを実施。
- ブラウザ自動確認：loading、成功（模擬応答）、401／403／404／500／503、不正JSON、再取得、既存3プレビュー画面。JS例外なし。
- 公開Workerへの実GETは現在のローカルDisplayキーでは401。公開Workerへの到達と認証失敗表示を確認した。実D1の取得成功は、公開用キー設定後に再確認する。
- 既存Admin／Display・Supabase・LocalRehearsalPage・Worker・既存SQL・package/lockfileのハッシュを変更前後で照合し、一致。
- 既存Admin／DisplayのSupabase実接続E2Eは今回の範囲外。上記ソース不変と既存回帰テストを根拠とする。
- private tokenが生成bundleにないこと、ブラウザの通信に固定キーがないこと、秘密設定ファイルの直接取得403を確認。
- D1/R2への更新処理はない。公開Workerへの要求は上記state GETのみ。

実環境の成功画面と、模擬応答の成功画面を区別する。検証画像は `docs/cloudflare-check-verification/live.png` と `mock-success.png`。

## テストの再実行

```powershell
npm run test:rehearsal
npm run build
npm run cf:typecheck
```

このPCの既存ブラウザテスト環境を使う場合（新規導入なし）:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/ryoji/AppData/Local/npm-cache/_npx/c61c9351a0dbcfa7/node_modules/playwright'
$env:PLAYWRIGHT_EXECUTABLE_PATH='C:/Users/ryoji/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'
node scripts/verify-cloudflare-check.cjs
```

このスクリプトは最初に実APIをGETし、以降の成功・エラー試験はブラウザ内の模擬応答で行う。模擬試験は公開WorkerやDBに送らない。

## 残課題

公開用Displayキーのローカル設定後、実state取得と画面の大会名・scene・versionを確認する。それまで完了条件3・4を合格にしない。M1.2以降の管理認証・更新基盤・参加者登録は未着手のまま。
