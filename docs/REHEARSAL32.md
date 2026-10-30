# 32人大会の観客通し確認

## 今後使う確認環境

canonical Workerは既存の **tournament-through-rehearsal**。入口は <https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal>。このWorker内の受付・Admin・Display・Rehearsal・登録写真のAnimation Previewを使用する。今回、新しい公開Workerは作らない。

### 今後確認に使うURLセット（32名・16ペア確定済み・発表前）

| 画面 | URL |
|---|---|
| Rehearsal | [通し確認を開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal?run=cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003) |
| Admin | [運営を開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/admin?run=cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003) |
| Display | [観客Displayを開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/display?run=cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003) |
| Check-in | [受付完了一覧を開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/checkin?run=cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003) |
| Animation Preview | [登録写真の演出確認を開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/show-preview?run=cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003) |

全5 routeをこの同じrunでdirect access／reload確認済み。SHOW・scene idle・version 1で、まだ発表・試合は始めていない。初期化せず、Displayを別窓で開いてRehearsalの「自動通し確認を開始・再開」を押すと最初から観覧できる。手動ではAdminの「ペア発表開始」→「ゲームスタート」→VS待機→「試合開始」→勝者確定で進む。確認コードは従来と同じで、`.checkin-access.local`に保存されている。

各大会は `?run=cf-through-...` で指定する。同じrun付きURLを各端末で使う。古いmatch-loop等の検証Workerは削除せず、今回の確認入口として使わない。通常受付Workerと通常大会も更新・初期化しない。

### 起動・検証・公開

```powershell
npm run dev                    # Cloudflare版。localhost:5174
npm run dev:rehearsal           # 同じCloudflare版（旧Viteへの入口ではない）
npm test
npm run build                  # dist-checkin + Worker型検査
npm run deploy:check            # dry-runのみ
npm run deploy:rehearsal        # 既存canonical Workerへ公開
```

`npm run preview`は同じローカルAPIと固定buildを配信する。通し確認中は別ターミナルでbuildしない。Supabase環境変数は不要。既存Wranglerを使用し、この作業ではパッケージの追加・更新を行わない。旧Supabase画面は `dev:legacy` / `dev:legacy-rehearsal` のみで使用する。

## 環境監査（Phase 0）

| 対象 | 現在の構成・判断 |
|---|---|
| localhostの旧Admin白画面 | 旧Vite入口→Supabase版Admin→環境変数未設定のmodule例外。route欠落ではなかった |
| Router | 旧`src/App.tsx`には/adminと/displayが存在。現行は`src/checkin/main.tsx`が既存Admin/Display/受付等をdispatchする |
| 標準dev | `scripts/local-app.mjs`がbuild・ローカルmigration・seed・Wranglerを起動。APIと画面を同一originで提供 |
| Vite | `vite.checkin.config.ts`のrootはcheckin、entryは/src/checkin/main.tsx、出力dist-checkin。legacyのvite.configとrehearsal configは旧版・unit用として保持 |
| Worker main | cloudflare/checkin/src/index.ts。canonical設定のmainはsrc/index.ts |
| Static Assets | dist-checkin、binding ASSETS、run_worker_first=true |
| 直アクセス・reload | Workerが/admin /display /rehearsal /checkin /show-previewをindex.htmlへ配信。APIへSPA fallbackしない |
| API | /api/sessionで認証後、同じWorker内の/api/checkin /api/draw /api/tournament /api/rehearsalへdispatch |
| D1/R2 | canonicalの既存tournament-rehearsal-dbと非公開tournament-rehearsal-portraitsを継続。localは別のローカルD1/R2 |
| 公開Secret | 既存REHEARSAL_ACCESS_CODEとSESSION_SECRETを継続。値を資料やブラウザbundleへ転記しない |
| 複数Worker | throughをcanonicalに指定。通常checkinは通常大会、match-loop/pair-gates等は過去の検証。新規作成・削除をしない |

build後・公開後の実際のroute確認結果は下の検証結果に追記する。新設ページによるAdmin代替は行っていない。

## 32人大会の作り方

1. 確認コードでログインする。公開コードのローカル保存先は `.checkin-access.local`、または `cloudflare/checkin/.secrets.local`。ローカル起動のコードは `cloudflare/local/.dev.vars` で別管理。
2. 「サンプル32名・16チーム・15試合」と「SHOW」または「FAST CHECK」を選ぶ。
3. 「初期化・参加者準備」を押す。既存大会を残し、新しいrunへ32人を通常participant APIで登録する。模擬PNG肖像を非公開R2へ保存し、全員にid・name・rating・portraitを持たせる。
4. 同じ画面の「会場Display」「運営」「受付」のrun付きリンクを開く。Displayは実際の大会用Displayであり、専用の代替プレビューではない。
5. 受付終了時に既存rating-balancedロジックで16ペアと15matchを事前保存する。発表中に再抽選しない。

新しい32名大会はsingle_elimination。既存8名・既存通常大会のdouble_eliminationを変更しない。formatは既存events.format、timing presetはevents.subtitleのJSONへ保存し、追加schema migrationを不要にした。ペア／member登録をJSON-backed INSERTへまとめ、32人でD1のquery数が増えすぎることも避けた。

## SHOW / FAST CHECKと手動確認

両方とも同じDrawStage・PairConfirmed・PostMatchStage・AnimatedBracketAdvanceを使用する。カード・ダーツ・反転・進出線の移動時間は共通。FASTはimpact後・ペア確定・結果・Bracket・NEXT MATCH等のholdだけを短縮し、16ペア・15試合を省略しない。

| 保持 | SHOW | FAST CHECK |
|---|---:|---:|
| ペア確定 | 7秒 | 1.4秒 |
| 結果scene | 6秒 | 4.2秒 |
| Bracket advance scene | 6秒 | 4.6秒 |
| VS導入後の自動START待機 | 5秒以上 | 1.8秒以上 |

自動リハーサルは模擬START／Team A勝利を運営APIへ送る。**手動ではVS導入が終わっても、Adminの「試合開始」を押すまで試合を開始しない。** 全15試合でNEXT MATCHと両チーム4人の写真・名前を見せる。

一時停止は自動運営コマンドを停止する。再生中の演出は完了し、次の試合開始待機で観察できる。再開は同じrunを継続し、リセット相当の「初期化」は新しいrunを作る。現在Step／Round名／Match／次Matchを同じ画面で確認する。

## 検証方法・証跡

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/ryoji/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL='msedge'
node scripts/verify-rehearsal32.cjs                # local FAST全通し
node scripts/verify-rehearsal32.cjs --public --show # canonical公開SHOW全通し
```

既存ブラウザで実Displayを1920×1080表示し、既存ffmpegで960×540のWebMへ録画する。フルHD画像はPNGで保存する。録画負荷を下げ、アニメーション自体の確認を妨げない。画面内を50ms間隔で継続観測して32人・16ペアを数え、全15回のVS・WINNER・14回の進出線と肖像移動を記録する。最初のVSで自動を停止し、手動AdminのSTARTが必要なことも確認する。単なるAPIのfinished判定にしない。

公開の再確認には、既にキャッシュに存在したPlaywright 1.64 alphaとインストール済みEdgeを使用する。初回に使った1.52から計測ツールの参照先だけを切り替え、プロジェクトの依存・lockfile・OSソフトウェアは変更していない。

出力先は `.wrangler/rehearsal32-local-fast` / `.wrangler/rehearsal32-public-show`。progress/result.json、WebM、各RoundとWINNER・進出線・優勝のPNGを保存する。最後にD1のdone match15件とSTART／winner操作ログ各15件を照合し、公開元の通常参加者が変更されていないことも確認する。

## 実行結果

- Unit最終確認：27ファイル・181件成功。32人API登録、ペア固定、シングル15試合、R16/QF/SF/Final、START前の結果入力拒否、実進出先14件、最終champion、D1と操作ログ、初期化後の読取専用ポーリングを含む。
- build：Cloudflare版とWorker型検査成功。
- dry-run：既存通常Worker／canonical through Workerで成功。
- ローカルFAST全通し：2026-10-30 18:59:34～19:08:07 JST、成功。32名・16ペア・15 VS・15 WINNER・14進出線、done15件、START／winnerログ各15件。全VSの観測時間は最短2.019秒。各進出線で勝者肖像の位置変化を最少13点観測した。JS例外・想定外HTTP失敗0。優勝とリロード復元も成功。
- 公開：既存canonical Workerへのdeploy成功。初回version `89a5ae9c-6401-43c6-bbfe-3f65b5eccafc`、連続ポーリングの修正後は `6a2ecda1-1ec0-446a-9821-39e0573f5525`。新規Worker・Secret・binding・migrationの追加なし。
- 公開SHOW全通し：2026-10-30 19:47:55～20:00:25 JST、成功（約12分30秒、途中の再開なし）。run `cf-through-2b16d40e-1d6e-41df-9b81-86e64d18e921`。32人・16ペア・15試合・15 VS・15 WINNER・14進出線を実Displayで観測。R16→Quarter Final→Semi Final→Final→CHAMPION、優勝のリロード復元まで成功。手動確認の最初のVSは2.2秒停止を観測し、その他の自動VSは最短4.802秒の可視保持を観測した。進出線上の勝者移動は各線で最少45点を観測。D1 done15件、START／winnerログ各15件が一致。通常参加者の変更なし。通信再試行・JS例外・想定外HTTP失敗はいずれも0。
- 引渡し用大会は別runを新規作成し、32名登録→16ペア・15枠確定→未発表で保持。通常大会・完走大会・中断した検証大会を削除・初期化していない。

証跡：[結果JSON](rehearsal32-verification/result.json)、[全16ペア](rehearsal32-verification/public-all-16-pairs.png)、[START待機](rehearsal32-verification/public-start-wait.png)、[進出線](rehearsal32-verification/public-moving-line.png)、[決勝](rehearsal32-verification/public-final.png)、[優勝](rehearsal32-verification/public-champion.png)、[発表前のAdmin](rehearsal32-verification/public-admin-ready.png)。

特に重要な連続表示は [公開SHOWのWINNER→Bracket Advance→NEXT MATCH／VS（55秒動画）](rehearsal32-verification/public-winner-to-next.webm) で確認できる。公開SHOW全編は `.wrangler/rehearsal32-public-show/video/page@1b7f6c120a10653c6b4df0ed24f893d1.webm` に保存した（大きいためGit除外）。

初回の32人確認では、Bracketの各SVGに写真を再取得していたため、scene冒頭で未読込の空枠が見えた。`portraitCache.ts`で認証付き取得・decodeした写真をページ内メモリのblob URLとして再利用するよう修正した。HTTPのno-store／非公開R2／認証要件を緩めず、公開bucket・永続画像cacheを追加しない。全32枚がBracketで利用できることも実Display試験へ加えた。

## 各演出の接続状態

| 演出 | 主系統で使用する既存実装 | 状態 |
|---|---|---|
| Pair Reveal | DrawStage：カード裏→ダーツ→impact→反転→顔・名前 | 動作確認済み（ローカルFAST／公開SHOW） |
| Pair Confirmed | PairConfirmed | 動作確認済み（ローカルFAST／公開SHOW） |
| Bracket | 保存済みsnapshot→BracketView | 動作確認済み（16チーム・15枠） |
| VS / NEXT MATCH | PostMatchStage＋次試合の実チーム・写真・位置 | 動作確認済み（15回・START待機） |
| WINNER | PostMatchStage＋確定勝者 | 動作確認済み（15回） |
| Bracket Advance | AnimatedBracketAdvance＋resolveResultAdvance | 動作確認済み（14回・線と勝者移動） |
| Champion | 既存FixtureStageのchampion＋実優勝チーム | 動作確認済み（優勝・reload復元） |

WINNER→実進出線→更新後Bracket→NEXT MATCH／VSは**同じ既存Display routeで連続表示**している。別の確認ページや完成済みBracketへの単純な切替をもって代替していない。旧Supabase側のResultScene／VsCardScene／LineCollisionを無理にimportせず、Cloudflare主系統に既にあった上記実装へ実データを渡している。

## 残課題の分類

### 機能不足・運用上の制約

- 自動リハーサルの勝者はTeam A固定。異なる勝者は既存Adminで手動選択でき、API結合テストでは両側を勝者にして15試合を検証したが、自動シナリオ選択UIはない。
- 保存済み大会を一覧から選ぶUIはなく、run付きURLの保存が必要。同じ大会のペア発表を巻き戻す操作もなく、最初からの確認は「初期化」で新しいrunを作る。
- 一時停止は自動運営操作の停止であり、GSAPの演出フレームをその場で停止する操作ではない。演出を終えて次のSTART前で待機する。
- 速度は新しい大会の作成時に保存し、途中でSHOW／FASTを切り替える操作は設けていない。

### 演出不足

- 現行の会場Displayは音声無効。映像の接続は確認対象だが、会場のSE・BGMを含む完成体験ではない。
- R16では勝者の進出先はQF、直後に実施する試合は別のR16となる。実際の進出先と次試合の位置を使っているが、なぜ別チームの試合へ移るかを説明する観客向けナレーションや案内はない。
- 決勝後は進出先・次試合がないため、WINNER→CHAMPIONへ移る。進出線は14回であり、架空の15本目や次VSを作らない。

### UI/UX問題（今回は変更しない）

- 16チームBracketを全体表示すると顔・参加者名が小さく、会場での読める距離には実機確認が必要。
- 長いチーム名はVSで複数行へ折り返される。参加者個別の写真・名前は表示されるが、カード・文字の整理は未実施。
- Adminは32名の参加者情報と確定ペアを縦に並べるため長い。試合操作の情報優先度・一覧の整理は次のUIUX段階に残す。

### 不具合・検証上の問題

- 修正済み：旧入口のSupabase設定例外、32人サンプルの9人目以降のrating未定義、シングル決勝の判定・Round表示、NEXT MATCHを保持せず自動STARTする挙動、Bracket冒頭の写真未読込。
- 32人のペア／membership登録はまとめてINSERTし、D1 query数が人数に比例して増えすぎる構成を是正した。
- 状態取得が毎回初期化INSERTを発行していた点を是正し、初期化後はSELECTだけになることを追加テストで確認した。Displayからの自動advance POSTもなくし、運営側へ集約。画面内の50ms観測は維持し、計測のAPIポーリングは500msへ下げた。
- 計測側：CSPに抵触する待機方法を避け、短い個人発表は画面内の50ms継続観測へ変更。フルHD録画の過負荷は表示解像度を維持して録画だけ縮小した。
- 公開の初回計測はNode側のGETがECONNRESET、次の計測も同クライアントの読取タイムアウトで中断。画面側のHTTP/JSエラーは観測されなかったため、計測の読取も実画面と同じブラウザのfetchへ統一し、bounded retryを設けて再実行した。中断した試験を成功として集計せず、未完走runも削除していない。
- 実機カメラ、会場モニター／HDMI・音響、別OS・スマホ、新規PCでのclean installは今回の自動確認に含めない。現在の既存依存・Wranglerでbuild/deployを実測した結果であり、未検証を不具合なしと扱わない。

参考：[brackets-managerのシングル構成](https://drarig29.github.io/brackets-docs/user-guide/structure/)、[Cloudflare Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)。ライブラリ標準のsingle_eliminationと既存Workerのassets bindingを使用する。
