# 写真付き受付 → Display確認

最新：受付からChampionまでの接続を公開しました。[連続した大会運営の手順・通常大会4名の状態・公開7試合完走結果](TOURNAMENT_FLOW.md) を参照してください。以下は前段の実装・検証記録です。

最新のDraw接続は [既存Draw → D1確定ペア → Bracket](DRAW_D1_REHEARSAL.md) を参照してください。運営画面にDraw開始が加わり、Displayは会場用表示になっています。

## 最新（2026-10-25）：連続受付・編集・削除・受付終了を公開済み

本人写真付き「にゃー」さん1名の登録を確認し、名前・写真を保持したまま、新しい受付フローを通常URLへ反映しました。4名の公開検証は専用大会で実施し、編集・写真差し替え・削除・再登録・6演出・受付終了まで確認済みです。**検証大会の4名は既存テスト画像のアップロードであり、実機4名の撮影試験ではありません。**

[最新の操作手順・公開URL・D1/R2検証・変更ファイル](CHECKIN_LIFECYCLE.md) を優先してください。以下は経過記録です。

## 過去記録：登録データから演出までの接続（本人写真登録前）

公開Version: `461c1fc4-752a-467b-a9c4-842b0b0b9786`（再ログイン時の写真再取得も含む）。

**実装・公開は済んだが、実スマホの本人写真による公開E2Eは未完了。** 公開DBにある写真付きデータは、前回こちらが作った模擬カメラの1件だけ。返信「1」を受けて再確認したが、名前「1」の登録もまだなかった。実写を登録したことにはしない。今回の公開環境への参加者・模擬画像の追加は0件。

### 公開URL

| 役割 | URL |
|---|---|
| スマホ受付 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin |
| 参加者確認 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display |
| 運営の参加者・写真確認（読取専用） | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/admin |
| **登録した写真で演出確認** | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/show-preview |
| 従来のサンプル専用Animation Preview | https://tournament-animation-preview.pine-shaken.workers.dev/ |

最初の4画面は既存の確認コード／HttpOnlyセッションを共有する。確認コードは [`.checkin-access.local`](../.checkin-access.local)。従来のサンプル専用WorkerへはDB・R2接続や秘密値を追加していない。既存Supabase版のAdmin／Displayとは別origin・別アプリであり、既存版の業務処理を置き換えない。

### 現在のデータ経路

```text
スマホの前面カメラ、または capture=user の画像入力
  → ブラウザで中央を480×480のJPEGへ変換
  → POST /api/participants（名前・任意rating・画像・再送用UUID）
  → Workerが画像シグネチャと宣言MIMEを照合
  → PORTRAITS.put（非公開R2）
  → D1 participants.photo_path / face_crop_pathへR2キー保存
  → participants APIが同一originのportraitUrlを返す
  → Display / 運営確認 / presentationAdapter が共通データを使用
  → 演出のmembers / faces / participantIdsへ渡す
```

新しい保存キーは `events/{eventId}/participants/{participantId}/{uploadAttemptUUID}/portrait.jpg`。APIへPNG／WebPを直接送信した場合もバイナリのシグネチャ・MIME一致を確認し、対応する拡張子・Content-Typeで保存する。スマホ画面の通常経路はJPEGに統一。R2 customMetadataへ `eventId`・`participantId`・`requestHash` を保存する。D1へ画像本体・base64・blob URLは保存しない。

既存の `photo_path` がportrait keyに相当するため、重複した `portrait_key` 列やmigrationは追加していない。形式はR2の `httpMetadata.contentType` を配信時に使用し、D1へ別のMIME列を重複管理しない。従来の `checkin/{eventId}/{participantId}.jpg` も読取互換を維持する。

参加者DTOには `id`・`eventId`・`name`・`rating`・`portraitUrl`・`portraitContentType`・`portraitSource` を含む。従来の `photoUrl` は互換用に保持するが、今回の画面・adapterは `portraitUrl` を使う。

### 写真APIと保存失敗への対応

画像取得: `GET /api/events/:eventId/participants/:participantId/portrait`。D1で検証大会と参加者を確認し、保存済みのキーだけをR2から取得する。Content-TypeはR2 metadataから、Content-LengthはR2 object sizeから設定し、バイナリをそのまま返す。`Cache-Control:no-store`、`nosniff`。別大会・不正キー・存在しないobjectは404。metadataが画像型でなければ503として扱い、固定のJPEGやサンプルへ置き換えない。

R2保存が失敗した場合、D1の参加者は追加しない。各送信試行は固有のR2キーを使う。D1で確定したSQLエラーや競合・受付停止が発生した場合、今回作成し参照されなかったobjectだけを削除する。同時再送の勝者が保存した画像は削除しない。D1の応答だけ失われた場合は保存済み行を読み返して成功を判定する。

ネットワーク障害でD1のcommit結果を確定できない場合は、参照中の画像を削除する危険を避けて非公開objectを保持し、503・同じ要求の再試行を案内する。その場合は未参照objectが残り得るが、写真のない参加者を成功扱いにしない。R2とD1を横断した完全なtransactionを保証する実装ではない。

### 実データ専用の演出adapter

`src/checkin/presentationAdapter.ts` が、APIの参加者から `id / displayName / rating / faceUrl` と表示用チームの `members / faces / participantIds` を生成する。他大会、blob URL、サンプル画像パス、外部URL、既知の模擬データを拒否する。データがない場合はエラーまたは登録待ちであり、固定の選手で埋めない。

- 1名登録でDraw／Result／Bracket advance／Championへ同じ名前・写真を渡せる。
- VS／NEXT MATCHは実際に登録された別の写真付き参加者がいる場合に有効。1名の写真を別人として複製しない。
- Draw・Championの表示部品とPostMatchStageを再利用する。共通部品へ大会ラベルを任意指定できるようにし、従来サンプル画面の既定動作は保持する。
- 抽選、勝敗確定、実チーム形成、bracket更新は行わない。表示確認の選択を大会結果として保存しない。

### 模擬画像の扱い

緑色の既知の検証レコード `checkin-981ee495-ed79-44fd-a00c-6a8792e17102` はD1・R2から削除せず保管する。ただし通常のparticipants API・Display・運営確認・演出から除外する。APIは除外件数を返す。通常のportrait APIもこの既知の模擬画像を返さない。

診断時だけ認証付き `?includeTestData=1` で一覧・portraitを読める。`/display?includeTestData=1` では明示した検証画像として確認できるが、演出adapterには渡せない。一般的な写真の内容から「本人写真か」を自動判定する仕組みではなく、既知の自動試験データを隔離する処理。

### 今回の検証と残り

| 工程 | 実装 | 公開の実写確認 |
|---|---|---|
| A スマホ撮影・登録 | 前面カメラ・ネイティブ画像入力、中央クロップ、再送対応あり。ローカル模擬カメラで検証済み | **実スマホ操作待ち** |
| B D1の参加者・キー | 実D1互換のローカルDBで新形式の保存を確認 | **実写レコード未登録** |
| C R2実体・metadata | ローカルR2で保存、eventId／participantId・形式のunit test成功 | **実写object未登録** |
| D portrait API | 型・長さ・バイナリをローカルで確認。旧検証objectは診断APIで200／image/jpeg／3146 bytes | **本人写真の200は未確認** |
| E Display・運営確認 | ローカルで共通portrait URLの表示を確認 | 公開は実データ0件の登録待ちを確認 |
| F 演出内の写真 | ローカルの保存済みデータで6シーンすべてを確認 | **公開で本人写真が登場する確認は未実施** |

- 166 unit testsが成功。画像形式、保存失敗、同時再送と不要objectの削除、commit後の応答喪失、adapterの不正写真拒否を含む。
- 専用build、従来アプリbuild、サンプル専用Preview buildが成功。
- 公開participants APIは200、通常対象0名・除外された自動試験データ1名。
- 公開 `/display`・`/admin`・`/show-preview` の登録待ち、fixture代用なし、JSエラー0件、秘密値のbundle混入なしを確認。
- 既存サンプル専用Previewは再公開せず維持。従来Admin／Display・Supabase・読取Worker、既存migration・lockfileは変更していない。

個人写真をGitへ保存しないため、今回の詳細結果・画面は `.wrangler/participant-e2e/`、R2／D1監査結果は `.wrangler/photo-audit/` に置く。local結果を公開実写成功とは扱わない。

残っているのは、スマホで本人写真を1名登録し、公開データに対してD1 → R2 → portrait API → Display → 演出を照合する工程。受付完了後の「この写真で演出を確認」から直接進める。これが確認できるまでは全体の完了とはしない。

### 今回変更したファイル

- `cloudflare/checkin/src/index.ts`・`index.test.ts`: MIME照合、R2 metadata、試行ごとのキー・失敗補償、portrait API、DTO、模擬データの隔離、追加画面配信。
- `src/checkin/api.ts`: portrait DTO。
- `src/checkin/CheckinPage.tsx`: canonical portrait表示と登録写真の演出リンク。
- `src/checkin/DisplayPage.tsx`・`ParticipantPhoto.tsx`: 運営確認の共通表示、portrait URL、試験データ除外、画像エラー。
- `src/checkin/useParticipants.ts`: 共通の参加者取得・更新。
- `src/checkin/presentationAdapter.ts`・`presentationAdapter.test.ts`: 実参加者から演出モデルへの変換・検証。
- `src/checkin/LiveShowPreviewPage.tsx`: 実データ専用の演出確認。
- `src/checkin/main.tsx`・`checkin.css`: 画面入口、リンク、演出確認の配置。
- `src/features/presentation/postMatch/PostMatchStage.tsx`・`src/preview/FixtureStage.tsx`: 既定動作を維持したラベル指定と1名表示。
- `vite.checkin.config.ts`: 必要な純粋な描画部品だけの依存許可と素材出力。
- `scripts/audit-checkin-photos.cjs`: D1キーを読取照合し、R2とcanonical APIの画像を比較。
- `scripts/verify-live-participants.cjs`: 読取専用のDisplay・運営・演出確認。公開データがなければ未完了を記録。
- `scripts/verify-photo-display.cjs`: canonical portraitと明示的な診断モードへの追従。
- `PLAN.md`・本書: 最新状態と未完了条件。
- `docs/CLOUDFLARE_REQUIRED_ACTIONS.md`: 公開設定と実写確認待ちの状態を更新。

### 以下は前回までの経過記録

## 写真が緑色に見える件の確認・修正（2026-10-25）

**緑色の原因は、前回こちらが公開環境へ登録したChromium模擬カメラの画像そのものだった。** 写真付き参加者は `受付検証 2026-10-24 d1d324` の1名のみで、実際のスマホ撮影写真は今回の調査時点では登録されていない。R2から直接ダウンロードした画像も同じ緑色だった。保存・配信による破損やCSSの緑背景ではない。

| 依頼の確認項目 | 実測結果 |
|---|---|
| 1. 送信画像とR2保存 | 前回の公開試験は送信JPEGと配信JPEGの一致を記録済み。今回はR2直接取得とWorker配信の全バイト一致を確認 |
| 2. R2 Content-Type | R2の実オブジェクト取得応答が `image/jpeg` |
| 3. D1 portrait key | `photo_path`／`face_crop_path` は `checkin/cf-rehearsal-001/checkin-981ee495-ed79-44fd-a00c-6a8792e17102.jpg`。実在するR2キーと一致 |
| 4. Worker画像バイナリ | HTTP 200、JPEG 3146 bytes、480×480。R2と一致 |
| 5. レスポンスheader | `Content-Type: image/jpeg`、`Cache-Control: no-store`、`X-Content-Type-Options: nosniff` |
| 6. フロントのimg | 同一originの写真APIを直接指定。Displayではobject URL／blob変換なし。デコード成功 |
| 7. CSS | 画像背景は `rgb(28,45,67)`、filterはnone、object-fitはcover。緑色のplaceholderではない |

画像SHA-256: `8fd8d97be68a7eef532827a59624f3164c7bf7d2828e265bc3d895b485944592`。

修正・公開したもの:

- 上記の**既知の検証レコード1件だけ**に「自動試験用の画像・実際の顔写真ではない」と表示する。名前の推測で実写を判定せず、このレコードのIDだけを対象とする。保存データの削除・置換・非表示化はしていない。
- 写真のロード失敗を明示し、再読み込みできるようにした。手動更新時はURLのrefresh値も更新し、ブラウザ内部に残った同一URLの画像を再利用せず再取得する。通常の5秒ポーリングでは不要な写真再取得を増やさない。
- `verify-checkin.cjs` に公開環境での模擬写真登録を既定で拒否する制限を追加。意図的な公開試験データ追加には `ALLOW_PUBLIC_TEST_REGISTRATION=1` が必要。今回この設定は使用せず、参加者の追加・更新・削除は0件。

公開Version: `39349028-ecb3-4afd-b283-95b68110d17b`。専用buildと153 unit testsが成功。公開URLで画像表示・検証画像の明示・画像取得503をブラウザ内で模擬したエラー表示・再読み込みによる復帰・JSエラー0件を確認した。Worker保存処理、D1、R2オブジェクト、既存Admin／Display・演出機能は変更していない。

読取専用監査: `scripts/audit-checkin-photos.cjs`。UIの読取専用試験: `scripts/verify-photo-display.cjs`。記録・画像は個人写真がGitに混入しないよう `.wrangler/photo-audit/` 配下（Git管理対象外）へ保存する。

**未完了の条件:** 実スマホからの撮影登録と、その実写の別端末表示。利用者へ受付URLで1名撮影・登録するよう依頼済み。こちらからスマホを操作して撮影することはできないため、実写登録後にR2・Worker・Displayの照合を行う。この段階を「実写確認済み」とは扱わない。

2026-10-24。今回の最小ゴール「名前・写真を1名登録し、別端末で表示する」を実装・公開した。既存Admin／Display・Supabase版、読取専用Worker、演出Previewは切り替えていない。

## 実際に使うURL

- スマホ受付: https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin
- PC・モニターのDisplay確認: https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display
- 演出Preview: https://tournament-animation-preview.pine-shaken.workers.dev/

確認コードは作業フォルダ直下の [`.checkin-access.local`](../.checkin-access.local) に保存した。Git管理対象外であり、この文書やbundleには値を記載していない。各端末で同じコードを一度入力する。セッションは8時間有効。コードを知る利用者は受付と参加者確認の両方を利用できる。今回は本番の利用者別・役割別認証ではない。

### スマホで登録する

1. 受付URLをSafari／Chromeで開き、確認コードを入力する。
2. 名前を入力する。ratingは任意。入力する場合は0より大きく30以下。
3. 「カメラを起動」を押してカメラ利用を許可し、「写真を撮影」を押す。前面カメラの中央を480×480に切り取る。
4. カメラ起動が利用できない端末では「スマホのカメラで撮影・写真を選択」を使う。ファイル入力に `capture="user"` を指定している。撮り直しも可能。
5. 写真を確認して「参加者を登録」。完了画面に保存した名前・写真が出る。

写真はブラウザでJPEGへ変換し、元画像のメタデータを引き継がず中央を切り取る。選択画像は20MBまで、送信用JPEGは512KBまで。登録完了はWorkerがD1の保存を読み返してから応答する。

通信失敗時は入力・写真・リクエストIDを画面のメモリに保持する。「同じ登録を再試行」を使用する。同じリクエストの再送で参加者は増えない。確定前の再試行中は内容を変更できない。タブを閉じる・再読込すると未保存の入力は失われる。

### 別PCで確認する

1. 別PCでDisplay確認URLを開き、同じ確認コードを入力する。
2. 受付アプリで登録した参加者の名前・写真が表示される。表示中は5秒間隔で更新する。
3. 「今すぐ更新」で手動更新できる。背面タブから戻った際も更新する。

Displayは確認アプリで登録した最新100名を対象とする。従来の初期サンプル2名は、写真なしの別データとして保持し、この確認画面には表示しない。抽選・勝敗・演出制御・端末の同時刻再生は実装していない。

## 保存先と保護範囲

| 項目 | 今回の実装 |
|---|---|
| 専用Worker | `tournament-checkin-rehearsal` |
| 公開設定 | `cloudflare/checkin/wrangler.jsonc` |
| D1 | 既存 `tournament-rehearsal-db`、`participants` への追加のみ |
| 対象大会 | `cf-rehearsal-001`、`environment='rehearsal'`。新規登録はstatusがdraft／entryのみ |
| 写真 | 非公開R2 `tournament-rehearsal-portraits` |
| R2キー | `checkin/cf-rehearsal-001/checkin-<request UUID>.jpg` |
| D1写真列 | `photo_path`／`face_crop_path` に上記キー。公開R2 URLは保存しない |
| 写真配信 | `/api/participants/:id/photo`。同一originの認証済みWorker経由 |
| ブラウザの認証 | HttpOnly・Secure・SameSite=Strictの署名付きcookie。localStorageには保存しない |
| ブラウザ用bundle | 管理・Display APIトークン、Supabase SDK、既存Admin／Displayを含めない |

R2のr2.dev公開は無効、custom domainもなし。CORSやR2公開設定は変更していない。ブラウザはDB／R2を直接操作しない。写真・API応答は `no-store`。変更系APIは同一originからの要求に限定する。フォーム名はReactでエスケープして描画する。

## API

| Method / path | 用途 |
|---|---|
| GET `/api/health` | 機密情報を返さない稼働確認 |
| POST `/api/session` | 確認コードを検証してセッションcookieを発行 |
| GET `/api/session` | ログイン確認 |
| DELETE `/api/session` | この端末のcookieを失効 |
| POST `/api/participants` | 名前・任意rating・JPEGを保存 |
| GET `/api/participants` | この受付アプリで登録した参加者一覧 |
| GET `/api/participants/:id/photo` | 対象大会の写真を認証付きで配信 |

今回のAPIにはADMIN_API_TOKEN／DISPLAY_API_TOKENを設定しない。専用Secretsは `REHEARSAL_ACCESS_CODE` と `SESSION_SECRET`。確認コードだけでは既存Admin・既存APIにアクセスできない。

### 保存の順序と再試行

同じrequest UUIDを参加者IDに使い、名前・rating・写真内容のSHA-256を照合する。R2は条件付きputで既存オブジェクトを上書きせず、D1は主キー競合時に二重挿入しない。応答が失われても、同じ内容の再試行は保存済み参加者を返す。別内容で同じIDを使用すると409。

R2とD1を横断するtransactionはない。R2保存後にD1で障害が起きた場合、非公開の写真を保持し、同じ要求の再試行でD1へ保存する。自動削除はしない。受付状態が途中で変わった場合や再試行を放棄した場合、D1から参照されない写真が残る可能性がある。削除機能・定期清掃は今回の対象外。

## 検証結果

- 専用frontend・Workerの型検査とbuild、従来アプリのbuildが成功。
- 既存135件＋追加18件、計153 unit testsが成功。未認証拒否、改変cookie、別origin、入力検証、R2障害、D1障害後の再試行、異なる内容での再送などを確認。
- ローカルでは隔離したD1・R2を使用し、実Worker runtimeを経由した撮影・保存・Display確認が成功。
- 公開URLでも、390px幅の受付と独立した1920×1080のDisplayセッションで成功。Displayは通常の5秒ポーリングで登録を検出した。
- 撮影データと配信写真のバイト列が一致。画像は480×480。再送で重複が増えない。未ログインの一覧／写真取得401、別originからの登録403。
- 公開ブラウザのJSエラー・外部originへの通信・予期しないHTTPエラーは0件。bundleに実際の専用秘密値・管理トークン名・Supabase URLがないことも確認。
- remote D1で新規参加者1件とR2キーを確認。既存2名は保持し、総参加者3名。検証大会の状態はrehearsal／draftのまま。外部キー違反なし。
- 既存読取Workerのhealth、演出Preview、新しい2画面はHTTP 200。既存の業務画面・共通演出・Supabaseコード、既存Worker・migration・lockfileの差分なし。

**ブラウザ試験はChromiumの模擬カメラによるもの。実際のスマホの撮影・権限操作、iPhone Safari、会場モニターの実機確認は未実施。** まず上記URLで1名撮影して確認する。

- [公開試験の結果](checkin-verification/public/result.json)
- [スマホ幅の撮影画面](checkin-verification/public/checkin-photo.png)
- [登録完了画面](checkin-verification/public/checkin-success.png)
- [Display画面](checkin-verification/public/display-1920.png)
- [ローカル試験の結果](checkin-verification/local/result.json)

検証参加者 `checkin-981ee495-ed79-44fd-a00c-6a8792e17102` と模擬写真は保存したまま。削除・既存データの置換は実行していない。

## Cloudflare側の作業・更新手順

初回デプロイと専用Secrets設定は完了済み。初回のSecrets設定後のVersionは `98bed6b4-c6fb-4e2c-ad10-80748f791a1c`。最新Versionは冒頭を参照。利用開始に必要なCloudflare側の追加操作はない。D1 migrationやR2のpublic化は不要。

```powershell
npm run build:checkin
wrangler deploy --config cloudflare/checkin/wrangler.jsonc --experimental-autoconfig=false
```

専用SecretsはGit管理対象外の `cloudflare/checkin/.secrets.local` に保存した。初回設定・明示的な更新時だけ以下を使う。通常の再公開では再設定しない。

```powershell
wrangler secret bulk cloudflare/checkin/.secrets.local --config cloudflare/checkin/wrangler.jsonc
```

`scripts/prepare-checkin-secrets.mjs` は既存秘密ファイルがあれば値を維持する。確認コード変更時はSESSION_SECRETも更新すると発行済みセッションを失効できる。秘密ファイルや確認コードをGitや公開資料に載せない。

今回PCのOS DNSに断続的な障害があったため、デプロイ時のみ次の任意設定でCloudflareドメインをDoH解決した。OSのDNS設定・hosts・ソフトウェアは変更していない。TLS証明書検証も維持している。

```powershell
$env:NODE_OPTIONS='--require=./scripts/dev/cloudflare-dns-fallback.cjs'
# このPowerShellプロセスから実行するWranglerだけに適用
```

通常の名前解決で動作する環境では不要。

## ローカル確認・次の範囲

既存依存を使い、新規パッケージは追加していない。ローカルWorkerは `.wrangler/checkin-test` の隔離ストア、ポート8795で試験した。元の8787／8788のWorkerプロセスは停止・変更していない。

今回の保存処理は受付専用の最小実装。既存AdminのCloudflare移行、参加者編集・削除、番号付け、写真管理、抽選、勝敗、Durable Objects、WebSocket、本番への切替は未実装。

参照: [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[D1 Worker binding](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)。
