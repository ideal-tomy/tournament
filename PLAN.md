# Cloudflareアプリ実装 PLAN

更新日: 2026-10-24。対象: `c40cfb7` と、この作業フォルダに追加済みのローカルリハーサル実装。依頼元: [docs/依頼.md](docs/依頼.md)。M1.1の読取クライアント・開発専用proxy・新規確認画面を実装。既存Admin／Display・Supabase・公開Worker・DB・R2は変更していない。

M1.1の最新状態: 135 unit tests、画面のloading・成功模擬応答・各エラー表示、既存プレビューの回帰確認を実施。実公開Workerは現在のローカル読取キーで401のため、実D1の成功表示は公開用キー設定後の確認待ち。[接続方法と検証結果](docs/CLOUDFLARE_CHECK.md)。M1.2以降は実装していない。

演出と進行制御の設計方針は [提案書](docs/TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md) を継承する。本書は次の実装単位・変更対象・確認方法を定める実行計画。Cloudflare初期構築はやり直さない。

## 1. 結論と次の最小単位

**次の1回の実装は「既存画面を変更せず、新規の確認画面からCloudflareの大会状態を読み取る」までに限定する（M1.1）。**

実装するものは、型付きAPIクライアント、秘密値をブラウザへ渡さないローカル開発用の読取プロキシ、新しいCloudflare状態確認画面。対象は `cf-rehearsal-001` のみ。成功時は大会名・scene・scene_seq・versionを表示し、失敗時は認証・大会権限・DB取得・通信障害を区別する。

既存 `/admin`・`/display` の直接差し替え、参加者INSERT、写真upload、勝敗更新は含めない。現在のGET APIには参加者一覧・写真・bracketが含まれず、既存Display全体を動かすには不足しているため。

その後は **管理認証 → 更新の共通基盤 → 参加者の文字情報 → 写真 → 抽選 → 勝敗・undo → Display同期 → 切替** の順に進める。

## 2. 現在確認できている状態

### 完了済みの基盤

| 項目 | 状態・確認元 |
|---|---|
| D1 | `tournament-rehearsal-db`、ID `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c`。前回CLIで実在確認 |
| D1 schema | 0001/0002適用済み、15アプリテーブル、検証大会1件・選手2名。前回SELECTで確認 |
| R2 | `tournament-rehearsal-portraits`／`tournament-rehearsal-media`。前回、非公開・空を確認。以後の件数は再測定していない |
| Worker | `tournament-rehearsal` 公開済み。今回CLIで公開・Secrets更新の履歴を確認 |
| API接続 | `依頼.md` のユーザー確認: health 200、state未認証401、DISPLAY_API_TOKENで200、remote D1の `cf-rehearsal-001` 取得成功 |
| ローカル演出 | `/show-preview`、`/presentation`、`/local-rehearsal` 実装済み |
| 回帰基準 | 前回81 unit tests、build、CF型チェック、ブラウザで8名完走・模擬カメラ4名登録成功。今回は文書のみのため再実行していない |

「ユーザー確認」「前回実測」「今回コード確認」を区別する。今回、公開APIの認証付き再試験はしていない。`.dev.vars` の秘密値を出力・転記していない。公開URLとサーバー側資格情報の設定元は、M1.1着手時に確認する。

### 最終目標8項目に対する実装状況

| 目標 | 存在する実装 | Cloudflareで残っていること |
|---|---|---|
| 1. Admin参加者登録 | CameraCapture、顔crop、参加者一覧。Supabase版／端末内版は存在 | Admin認証・大会認可、新APIと登録UIの接続 |
| 2. D1保存 | participants等のテーブル | 登録・編集・取得repository、入力検証、重複防止 |
| 3. 写真をR2保存 | R2バケットbinding、既存の写真生成処理 | PUT/GET、認可、upload状態、失敗補償、撮り直し |
| 4. 抽選をD1保存 | draw計算、brackets-manager、draw_sessions等のschema | サーバー計算、チーム・試合・snapshot等の原子的保存 |
| 5. 勝敗・undo | progression計算、Supabase更新、端末内undo | API更新、永続undo、競合検証。現行useProgressionのundoはrefであり再読込で失われる |
| 6. scene/version更新 | D1の両カラム、command_receipts、sceneMachine | version検証、更新コマンド、ログ、receiptの一括保存 |
| 7. Display反映 | Supabase Realtime＋1.5秒polling | CFの状態・bracket・画像取得、再取得、後にDO配信 |
| 8. Supabase依存切替 | API単位の既存ファイルはある | provider分離、直import解消、全利用経路の確認 |

現行Worker `cloudflare/src/index.ts` はGET healthとGET stateのみ。管理・Display両固定トークンとも読取専用で、POSTは405。EnvにはDBとトークン等しかなく、R2 bindingを使う処理、DOクラス、利用者セッションは存在しない。

APIと画面の型には差がある。state APIは `scenePayload`／`sceneSeq`／`startedAt`／`currentMatchId` のcamelCase、既存画面はsnake_case。既存 `EventStateRow` にversionはなく、`EventRow` はCF schemaにない `admin_token` を必須にしている。型assertだけで流用せず専用DTOを作る。GET stateにはevent.status・bracket・参加者一覧・写真がないので、それらを仮の値で埋めて既存Displayを動かさない。

`/local-rehearsal` はlocalStorage保存。D1/R2や複数端末の動作証拠として扱わない。

## 3. 既存動作を守る境界

- `/show-preview`、`/presentation`、`/local-rehearsal` はCloudflare・Supabase・ログインなしで使える状態を維持。
- 旧 `/admin`、`/display`、`/rehearsal` は初期段階で変更しない。新画面をlazy loadし、CF画面にSupabaseモジュールを読み込ませない。
- 既存のVITE_ADMIN_PASSCODEは画面ガードのみ。新APIの認証として流用しない。
- 公開済みhealth/stateのURL・応答・401/403/404/503と読取専用契約を保つ。新しい更新権限は別契約として追加。
- 0001/0002は編集・再適用しない。schema差分が必要な段階で新migrationを作る。
- 同じ大会にSupabaseとD1を二重書き込みしない。切替は大会ごとに固定し、失敗時に他DBや本番大会へ自動フォールバックしない。
- 既存のWINNER→NEXT MATCH自動、NEXT MATCH→START手動、最低5秒保持、full/short/liteを維持。プレビューのseekは試合状態を変えない。
- 現在の未コミット変更・ユーザー文書を保持。初回にSupabase SDKや旧演出資産を削除しない。

## 4. 段階別の実装順序・確認方法

### M0：初期準備・公開接続【完了として次へ進む】

D1・R2・Worker・Secrets・読取API接続は依頼内容により完了。追加のDB作成や初期化は不要。管理セッション・個人別認可・DO・業務APIの完了を意味するものではない。

### M1.1：新規画面でstateを読む【次の最小実装】

**対象範囲**

1. 既存JSON応答と一致する `CloudflareEventStateResponse` を定義。文字列sceneの妥当性、数値version、boolean、nullable値を境界で検証。
2. APIクライアントにタイムアウト・中断・エラー分類を設ける。APIからHTML／不正JSONが返った場合も画面が落ちないようにする。
3. 新規 `/cloudflare-check?eventId=cf-rehearsal-001` に大会名・environment・scene・sceneSeq・version・再取得ボタンを表示。
4. ローカル開発時は同一originの読取プロキシを使用する。サーバー側だけで選択した読取キーを付与。VITE変数、URL、localStorage、ブラウザのAuthorizationヘッダーへ固定キーを渡さない。
5. プロキシはlocalhost・GET・許可path・eventId・設定済みWorker originに限定。任意URLへ転送する汎用プロキシにしない。遠隔公開版の認証方式として使わない。

**変更対象案（まだ未作成）**

- 新規 `src/lib/api/cloudflareTypes.ts`、`cloudflareClient.ts` とテスト。
- 新規 `src/routes/CloudflareCheckPage.tsx`。
- 新規 `scripts/dev/cloudflareReadProxy.ts`、既存 `vite.rehearsal.config.ts` に開発時のみ接続。
- `src/App.tsx` に追加route、`src/routes/HomePage.tsx` に確認導線。
- サーバー専用ローカル設定の説明。秘密ファイルはGit除外。Workerのコード・D1/R2 schema変更は不要。

**確認方法・完了条件**

- Browser→ローカルproxy→公開Worker→remote D1→画面まで `cf-rehearsal-001` の同じ値を確認。
- キー誤り・許可外event・存在しないevent・未設定・通信断をテストし、再試行できる。
- proxyのPOST・許可外path・任意転送先が拒否される。
- frontend bundle・ブラウザ通信・画面・consoleに固定キーが含まれない。
- 81件の回帰テスト・build・CF型チェックと既存3プレビュー画面が成功。D1/R2の業務データ件数は変わらない。

**この段階でできないこと:** 参加者登録、写真表示、抽選、勝敗更新、旧Displayの置換。新画面に大会状態が出ればこの単位は完了。

### M1.2：運営・Displayの認証をアプリ用へ整理

**依存:** M1.1。更新APIを公開する前に完了。

- 運営人数・撮影端末に応じAdminセッション方式を確定。既存案のCloudflare Access＋WorkerでJWT検証・大会権限照合を第一候補とする。
- Displayは大会限定・読取専用・失効可能なセッション／ペアリングにする。固定の管理キーをブラウザへ配らない。
- サーバーがactorと権限を決める。cookie方式ならOrigin/CSRFを検証。期限切れ・失効と再ログインを扱う。
- 新しいCF Admin／Displayを `/cloudflare-admin` と `/cloudflare-display` 等の独立routeで追加し、旧画面を保つ。
- 同一originでSPA/APIを提供する経路を確定。現WorkerはSPA assetsもCORS/OPTIONS処理もないので、ブラウザ直fetchを追加するだけでは完了しない。

**変更対象:** 新規 `cloudflare/src/auth/`、`routes/session.ts`、共有セッションDTO、frontend session client、必要な権限migration・Worker設定。認証方式に伴う外部設定はこの段階で限定して行う。

**確認:** 未認証更新401、Display更新403、他大会403、期限切れ・失効・CSRF拒否。既存read-only APIは互換性テストを通す。

### M1.3：更新・保存の共通基盤

**依存:** M1.2。参加者登録の最初のD1書き込みに先行。

- event単位DOを全更新の窓口とし、awaitをまたぐ操作を明示的に直列化。DOを置くだけで自動的に安全とは扱わない。
- コマンドにrequestId・expectedVersion・対象ID・payloadを定義。actorはセッションから取得。
- 同一requestId/同一内容は既存応答を返す。同一ID/異なる内容は拒否。古いversionは409と最新stateを返す。
- domain変更・event_state・operation_log・command_receiptsをD1の原子的保存にまとめる。sceneは演出遷移のときだけ変更し、versionは確定更新ごとに増やす。
- 条件付きUPDATEが0件でもbatchは自動rollbackしない点に対応。競合時にdomain更新だけ成立しない設計を結合テストする。
- 永続状態の真実源はD1。DO停止・保存直後の応答断からreceiptで回復できる。WebSocket配信は後段で追加可能。

**変更対象:** 新規 `cloudflare/src/commands/`、`repositories/`、`objects/EventCoordinator.ts`、Worker route、DO binding/class migration、必要な新SQL。0002は既存のreceipt保存先として再利用。

**確認:** 同時2要求・再送・異なるpayload・旧version・途中失敗で、DB更新とversionが一度だけ成立。mock以外にローカルD1/DOで検証。

### M2.1：Adminから文字情報だけをD1へ登録

**依存:** M1.3。最初の業務機能の実装単位。

- 対象は既存検証大会。名前・rating・entry_noの登録と一覧取得に限定する。
- `POST/GET /api/events/:id/participants` を追加。UUID生成、名前・rating・受付状態、所属eventとenvironment、再送重複を検証。
- 写真なし／登録途中は明示し、抽選対象の可否を決める。二重タップと再読み込みで重複しない。
- 新CF Adminの登録フォームを接続。旧RegistrationPanelを全面置換せず、保存処理を注入できる形へ分離する。

**変更対象:** 新規 participants route/repository/command、ParticipantDTO、CF Adminのフォーム・一覧。`registrationApi.ts` は旧providerとして残す。

**確認:** 1名登録→画面再読込→D1 SELECTで同じID・名前・rating。Display権限での登録拒否、他大会・不正値・再送を検証。R2はまだ変更されない。

### M2.2：写真撮影→R2→再表示

**依存:** M2.1。

- `CameraCapture.tsx` と `faceCrop.ts` の撮影・顔crop処理を再利用。DB操作をimportするCameraCaptureは保存callback/adapterに切り離す。
- 原写真／顔cropのupload intent、容量・MIME・画像検証、R2保存、metadata commitを実装。新migrationで未完了状態と回収対象を記録する。
- R2とD1は同一トランザクションにできない。片方失敗時の再試行・補償・期限付き回収を用意し、未完了写真で登録完了扱いにしない。
- 非公開R2の顔画像を認可付きAPIで配信。撮り直しはrevision付きキーで保存し、新commitまで旧画像を保持。cache更新・失効を確認。

**変更対象:** 新規 portrait/upload route・service・repository・migration、WorkerのR2 Env型、CF版registration adapter、CameraCaptureと一覧、`faceUrl`／`teamFaces` のCF用解決。

**確認:** 実写1名で撮影→保存→再読込→別ブラウザで同じ顔。模擬カメラで自動検証、実カメラで手動検証。二枚目失敗・撮り直し・権限外GET・容量超過で整合性を確認。

### M3：抽選結果・チーム・bracketをD1へ保存

**依存:** M2.2。まず8名、次に16/32名。

- `draw.ts` と `bracket/manager.ts` の計算を共有・サーバー側再利用。Worker runtimeでbrackets-managerの互換性を先に検証。
- プレビューと確定を分け、保存済みreveal_orderで演出を再生する。再読込で再抽選しない。
- draw_sessions・teams・team_members・matches・events.bracket_snapshot・state・ログ・receiptを一貫して保存する。
- managerの整数match IDとD1のTEXT match IDの対応を維持。大会をまたぐチーム／参加者参照を拒否。
- サンプル32名のCF投入は専用rehearsal操作。ローカル保存データを暗黙に本番へuploadしない。

**変更対象:** 新規 draw service/repository/command、read model API、`drawApi.ts`／DrawPanelのadapter、`syncMatchesFromSnapshot.ts` のサーバー版、bracket/写真DTO。

**確認:** 8/16/32名の漏れ・重複・rating編成、奇数trio/bye、再送、保存途中失敗、再生やり直し。32名の処理量がD1のstatement/parameter制限内に収まるかも実測する。

### M4：勝敗確定・undo・scene/version更新

**依存:** M3。

- `progression.ts` の計算をWorkerへ移し、勝敗・snapshot・matches・current ID・state・ログ・receiptを一括保存。
- undoはブラウザから任意snapshotを送る方式にしない。サーバー保存済みの直前操作を対象にし、次試合が進んだ場合などの拒否条件を定義。
- NEXT MATCH最低5秒をサーバー時刻で検証し、STARTは手動。スキップで勝敗を変更しない。
- scene_seqとversionを分離。演出リプレイ・一時停止・seekが二重の勝敗確定を起こさないようにする。
- GF reset・最終勝者・優勝保持を確認し、優勝表示と写真削除を分離する。

**変更対象:** 新規 progression/scene command・service・undo repository、`progressionApi.ts`／useProgression／MatchControlのCF adapter、`sceneMachine.ts` の共有化、必要なログschema差分。

**確認:** 8/16/32名完走、GF reset、undo後の全read model照合、複数Admin、連打・再送・保存後応答断、finished後の写真保持。

### M5：Displayへの反映と演出接続

**依存:** M3/M4。段階的に行う。

1. まずCF Displayでstate・bracket・チーム・写真をGETし、短いpolling／明示更新で反映を確認。取得は読取だけでD1を書き換えない。
2. DO WebSocketと再接続時の最新state取得へ拡張。古いversionを破棄し、通信断から復帰する。
3. DrawScene／ResultSceneのDB更新をCF表示経路から取り除く。Admin／サーバーが遷移を所有し、必要な完了ackはversion付きで冪等にする。旧Supabase経路の動作は維持。
4. 実チーム・写真・更新前後のbracketを共有演出へ接続。次試合が直前勝者を含まない場合、未確定、最終試合を分岐する。
5. 開始時刻・時計差・playback位置を扱い、再接続で過去の衝突SEを連発しない。音声・素材失敗時は静的／無音で続行。

**変更対象:** 新規CF read-model hook／subscription、CF Display、`useEventState.ts`／useBracketDisplayのprovider境界、`DrawScene.tsx`／`ResultScene.tsx` のcallback分離、`PostMatchStage.tsx`、必要なPlayer/音声adapter。

**確認:** Adminの更新→別Displayのversion一致、2台の再接続・リロード、Display不在でも進行、Displayから更新が送られないこと。NEXT MATCH保持・手動STARTと優勝分岐の画面録画。

### M6：provider切替・運用リハーサル

**依存:** M1～M5。

- 全機能が揃ったCF大会だけに旧Admin／Displayの導線を切替。SupabaseとCFのproviderは大会単位で固定。
- `AdminPage.tsx` の大会メタ情報更新、`DisplayPage.tsx` のevents取得、PlaylistPlayer／MediaManager／eventCleanup／rehearsalActionsの直接Supabase呼び出しも棚卸しする。
- 広告・プレイリストなど当日不要な機能はCF画面で未対応と明示する。使わない機能が裏でSupabaseへアクセスしないことを確認。
- 写真cleanupは処理状態を保存して再試行可能にする。表彰後の別操作で削除し、DB/R2/cacheを照合。
- 会場端末・音響・ネットワークで30分以上確認し、当日手順・バックアップ・手動進行・復旧手順を更新。

**確認:** 実写8名とサンプル32名の通し、Supabase通信0、CF画面にSupabase環境変数不要、認証失効・通信断・復旧、写真削除は使い捨て検証データのみ。本番環境への公開・切替はこの合格後に対象を明示して行う。

## 5. 全体順序と段階ごとの見える成果

| 順番 | 最小単位 | 見える成果 | 書き込み先 |
|---|---|---|---|
| 1 | M1.1 読取接続 | 新しい画面に実D1の大会名・scene・version | なし |
| 2 | M1.2 認証 | 運営とDisplayの権限を分離 | セッション／権限管理 |
| 3 | M1.3 共通保存 | 再送・競合・保存失敗を一貫して処理 | 検証用D1、DO |
| 4 | M2.1 文字登録 | Adminから名前・ratingを登録して再表示 | D1 |
| 5 | M2.2 写真 | 実写1名を別ブラウザで表示 | R2＋D1 |
| 6 | M3 抽選 | 写真付きチームと保存済みbracket | D1 |
| 7 | M4 進行 | 勝敗・undo・scene更新・優勝 | D1 |
| 8 | M5 Display | 別画面への最新状態反映・演出 | 読取／配信 |
| 9 | M6 切替 | Cloudflareだけで運用リハーサル | 検証環境全体 |

## 6. 実装着手時に確定する設定・判断

- M1.1: 使用する公開Worker URL、remote用Display資格情報のサーバー側設定元。local用.dev.varsと公開Secretsが同じとは仮定しない。秘密値はチャットに貼らずローカル設定で扱う。
- M1.2: Admin認証と大会権限、Displayペアリング、同一origin公開経路。新しい依存パッケージが必要なら導入対象と影響を示して事前確認。
- M2.2: 実写の取扱い・保存期間・削除責任者。R2の公開URLは有効化しない。
- M5/M6: 1出力分配／独立Displayの構成、音声を出す端末、同期精度と会場解像度。

これらは後段の完了に必要な判断であり、今回の調査・計画提出を止める条件ではない。

## 7. 回帰確認・中断・復旧

- 基準テスト: `npm run test:rehearsal`、`npm run build`、`npm run cf:typecheck`。CFのtsconfigは現在index.tsのみがinclude対象なので、分割時は新Worker実装全体の型検査範囲を明示する。
- unitで認可・DTO・進行計算を確認し、ローカルD1/R2/DOで保存と再送を結合検証。mock成功をremote成功と扱わない。
- 各段階の認証付き手動／E2E確認と、既存プレビュー3画面の回帰確認を行う。実カメラ・会場音響は模擬入力と別に確認。
- 最初の読取画面はrouteと開発proxyを外せば戻せる。旧画面・DBには変更がない。
- 更新開始後は書き込み停止→version・ログ・バックアップ確保→schema互換の安定版へ復帰→整合性確認の順。旧Supabaseへ自動切替しない。
- 公開Workerの更新時はhealth/state契約を回帰確認。新migrationは互換的に追加し、実D1を消して復旧しない。

## 8. 根拠となるファイル

- Worker契約: `cloudflare/src/index.ts`、`index.test.ts`、`cloudflare/migrations/0001_tournament.sql`／`0002_command_receipts.sql`。
- Supabase境界: `src/lib/event.ts`、`supabase.ts`、`hooks/useActiveEvent.ts`、`hooks/useAdminPasscode.ts`。
- 登録: `src/features/registration/registrationApi.ts`、`CameraCapture.tsx`、`faceCrop.ts`。
- 抽選・進行: `draw/draw.ts`、`draw/drawApi.ts`、`bracket/manager.ts`、`progression/progression.ts`、`progressionApi.ts`、`useProgression.ts`、`scene/syncMatchesFromSnapshot.ts`。
- scene・Display: `scene/useEventState.ts`、`sceneActions.ts`、`routes/DisplayPage.tsx`、`presentation/scenes/DrawScene.tsx`／`ResultScene.tsx`。
- ローカル比較用: `rehearsal/localTournament.ts`、`routes/LocalRehearsalPage.tsx`、`presentation/postMatch/`。

[Cloudflare実環境の記録](docs/CLOUDFLARE_REQUIRED_ACTIONS.md)／[読取API手順](docs/CLOUDFLARE_API_RUNBOOK.md)／[演出確認手順](docs/REHEARSAL_PREVIEW_GUIDE.md)。
