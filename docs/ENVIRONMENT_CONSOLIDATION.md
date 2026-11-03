> 最新の環境統合・公開8名E2E・旧Worker分類: [2026-10-31 統合報告](CANONICAL_CONSOLIDATION_20261031.md)。今後の公開は `npm run deploy:rehearsal` のみ。

# 公開リハーサル環境の整理（2026-10-30）

**当日運用の手順（スマホ受付・運営・モニター連動）の正本は [DAY_OF_EVENT.md](./DAY_OF_EVENT.md) です。** 本資料は環境・検証・固定 URL 例を記録します。

## 連動がわかる画面・デプロイ準備（最新対応）

2026-10-30: 旧Supabase受領資料と移動時点の生成物を `archive/` へ保管後、canonical Worker `tournament-through-rehearsal` へデプロイ完了。Version ID: `aca4f408-5939-4e36-8723-1971e2a76c64`。公開URLは https://tournament-through-rehearsal.pine-shaken.workers.dev 。`/`・`/rehearsal`・`/checkin`・`/admin`・`/display` はすべてHTTP 200、HTML app rootあり。未認証の `/api/rehearsal/config` は401（認証必須）を返すことも確認。

画面の入口をRehearsal中心に整理し、受付・運営・Displayの連動方法、大会ID、反映を確認する方法、次に行う操作を各run上で確認できるようにした。旧Supabase版・旧検証画面は通常の画面とメニューに表示しない。Rehearsalの自動全通しは折りたたみ、Team Aを模擬勝者として記録することを明記する。実データの操作はAdminで手動進行する。

localhostで新しい空run準備→異なるブラウザsessionでAdmin/Display→4人の受付→Admin一覧反映→受付終了→ペア発表開始まで通し確認済み。テストrun：cf-through-16962004-e974-4460-85d1-5401f88c9b28。パッケージテスト27ファイル/181件成功、build成功、npm run deploy:checkで通常／canonicalの2設定のdry-run成功。frontend bundleではSupabase URL・client token・Secret値が非検出。

この更新は上記version `aca4f408-5939-4e36-8723-1971e2a76c64` として公開済み。`npm run deploy:check` の通常／canonical dry-run後、`npm run deploy:rehearsal` で既存canonicalだけに反映した。依存追加・migration・新Worker・既存大会への変更はない。32人SHOW全編の公開証跡は前節のものを継続して参照し、今回32人全編は再実行していない。

shared flowの確認は `npm run test:shared-run-ux`（`npm run dev` 起動中）で再実行でき、結果は `.wrangler/shared-run-ux/result.json` に出力される。保存する場合は下記へコピーする。再現／確認資料：[shared flowの確認結果](environment-verification/shared-run-ux/result.json)、[bundle確認](environment-verification/bundle.json)、[Worker棚卸し](environment-verification/WORKERS.md)。未解決：実スマートフォンでのカメラ確認、Safari、物理会場設備。ユーザー確認によりスマホ操作がAdmin/Displayへ反映されたことは会話内で確認済み。

## 調査結果と実行計画

依頼.md更新版への対応。参加者受付→同じ大会の運営→会場Display→Championを同一originで利用する。

1. 現状調査：package/scripts/config/entry/API/authを照合。既存Worker一覧・最新版・binding・Secret名のみを読み取り取得する。値は記録しない。
2. 入口整理：既存checkin frontendにトップを設ける。大会リハーサルを主入口、受付・運営・Displayを補助入口とし、Preview・接続確認を折り畳みの開発ツールへ移す。旧実装を削除しない。
3. 既存Admin維持：localhostの直アクセス・reload・認証・大会選択を検証する。新しいAdminを作らない。
4. 公開受付検証：新しい隔離大会だけで名前・rating・模擬カメラ撮影・連続登録・写真API・別セッション反映を確認。実スマートフォンはユーザーの実機確認として別記する。
5. 回帰・公開：型検査・build・必要なブラウザ試験後、既存canonical Workerにのみdeploy。トップを含む各routeを直接開きreloadする。過去の32人SHOW証跡を保持する。
6. 引渡し：撮影受付用の空大会と32人SHOW大会を区別し、6 URL・実行command・確認済み/未確認/未実装を記載する。

## 現在のFrontendとAdmin問題

標準`npm run dev`は`scripts/local-app.mjs`を経由し、`vite.checkin.config.ts`で`src/checkin/main.tsx`をbuild、WranglerでAPIとassetsを同じlocalhost:5174に配信する。`npm run build`も同じ構成。出力は`dist-checkin`。

旧`vite.config.ts` / `vite.rehearsal.config.ts`からの`src/App.tsx`はSupabase版。/admin route自体は存在するが、Supabase環境変数未設定のmodule例外で白画面となった。標準入口をCloudflare版へ切り替えて既存Cloudflare Adminを使用しており、新Adminへの置換ではない。古い5173のViteを開き続けると旧画面が残る。

Workerは`cloudflare/checkin/src/index.ts`、canonical configは`cloudflare/checkin/wrangler.through-rehearsal.jsonc`。`ASSETS`はdist-checkin、`run_worker_first=true`。Workerが既知routeへindex.htmlを返し、未知route・未知APIは404にする。APIへの無条件SPA fallbackは行わない。

## Route分類

| Route | 用途 | 現在使用 | 今後必要 | 公開対象 |
|---|---|---|---|---|
| / | 整理したトップ | A・今回対応 | 必要 | canonical |
| /checkin | 撮影・名前・rating・受付 | A | 必要 | canonical、認証あり |
| /admin | 受付終了・発表・試合進行 | A | 必要 | canonical、認証あり |
| /display | 会場画面 | A | 必要 | canonical、認証あり |
| /rehearsal | 大会準備・通し操作 | A | 必要 | canonical、認証あり |
| /show-preview | 登録写真の個別演出 | B | 開発用 | canonical、開発ツール |
| /cloudflare-check | 同一Worker接続確認 | B・今回対応 | 開発用 | canonical、開発ツール |
| /match-transition | 既存試合結果の開発確認 | B | 当面保持 | canonical、通常入口には出さない |
| /api/* | session・受付・進行・写真API | A | 必要 | canonical、health以外は認証 |
| /demo | 旧検証デモ | C | 保管 | legacyのみ |
| /local-rehearsal | 旧ブラウザ内大会 | C | 保管 | legacyのみ |
| /presentation | 旧連続演出プレビュー | C | 保管 | legacyのみ |
| 旧/admin・/display・/rehearsal・/show-preview | Supabase版 | C | 保管 | legacyのみ、通常入口には出さない |
| 旧/cloudflare-check | 別read-model検証 | C | 保管 | legacyのみ、新接続確認から分離 |

旧版は`dev:legacy` / `dev:legacy-rehearsal`だけで使用する。通常トップにSupabase・旧演出デモのリンクを設けない。

## canonical構成

既存8 Workerの現在の版・deploy元・D1/R2/ASSETS・Secret名・Routeは[Worker棚卸し一覧](environment-verification/WORKERS.md)と[API照会結果](environment-verification/workers.json)に記録。旧animation-previewはassetsを持つがsettingsのASSETS bindingはない。今回更新したのはthroughだけ。

- Worker：既存`tournament-through-rehearsal`。
- D1：既存`tournament-rehearsal-db`。
- R2：既存非公開`tournament-rehearsal-portraits`。`tournament-rehearsal-media`は旧素材用であり、現行受付・進行のbindingに追加しない。
- Secrets：`REHEARSAL_ACCESS_CODE`、`SESSION_SECRET`をWorkerに保持。ブラウザにはSecure/HttpOnly/SameSite=Strictのsession cookieのみ。Secret値をbundle・HTML・query・資料へ記載しない。
- 新Worker、DB migration、データ削除、依存追加は不要。

## 検証結果

| 確認項目 | 結果 | 根拠・範囲 |
|---|---|---|
| localhostトップ整理 | 確認済み | 主入口＋3補助入口。開発ツールは折り畳み。旧入口非表示 |
| localhost Admin/Display/受付 | 確認済み | 認証・大会指定・直アクセス・reload。既存受付編集・写真差替え・別session・logout試験も成功 |
| build・deploy | 確認済み | 型検査＋build成功。既存canonicalのみ更新、181 tests成功 |
| 公開TOP/受付/Admin/Display/Rehearsal/Preview/接続確認 | 確認済み | 各routeのdirect/reload 200。画面描画と認証後表示を確認 |
| 実スマートフォン撮影 | **未確認** | このPCから実機を操作できない。撮影用の空大会を準備済み |
| PC模擬カメラ撮影・参加者登録 | 確認済み | Edge・390×844・touch/mobile viewportで実フォーム撮影8名。登録後フォームが空に戻り次の参加者を登録 |
| D1保存 | 確認済み | 新規隔離runの参加者8件をCloudflare D1 APIで照合 |
| R2保存・写真取得API | 確認済み | R2写真8件とWorker APIの全byte一致。480×480画像。非公開バケットを維持 |
| Admin反映 | 確認済み | 別sessionで同じ8名・写真を表示 |
| 大会開始・ペア発表・Draw・Pair Confirmed・Bracket | 確認済み | 今回8人撮影大会が同じ運営・Displayへ接続。前回32人SHOWの詳細観測証跡も保持 |
| VS・試合開始・Winner・次試合 | 確認済み | 今回8名・4チーム・シングル3試合。結果→勝ち上がり→次VS。前回32人では全15試合と手動STARTも確認 |
| Final・Champion | 確認済み | 今回決勝→award→finished。D1 done 3件。Display reloadで復元 |
| 32人サンプル | 確認済み | 32名・16チーム・15試合のSHOW全編は前回公開versionで完走。今回は入口変更で、32人全編を再実行していない |
| Secret非露出 | 確認済み | Worker Secret名のみ棚卸し。bundle内の既存Secret値不在を検証。token認証の旧版は別構成のまま |

今回の公開撮影大会は`cf-through-37ae44d6-6ff8-46e6-baa5-e5137008780a`。8名撮影登録を20:59頃JSTに完了し、状態確認スクリプトを再開して21:02:15 JSTにfinishedを観測、21:03頃に最終復元確認。勝者は自動モードのTeam Aであり実試合の結果ではない。

途中の検証停止を成功として隠さない。最初の別大会はAdmin取得を待たないassertで停止。次の大会はstatus読取時の`VERSION_CONFLICT` 409で計測が停止したため、既存クライアントと同じ上限付き再取得を検証側に追加し、同じrunを再開した。進行中に`/api/tournament/advance` 409が1件あり、既存RehearsalPageの競合回復で進行を継続した。最終確認はUI alertなし、JS errorなし、ChampionとD1完了数整合。競合はJSONの`expectedReadConflicts`・`recoveredAdvanceConflicts`へ別記し、予期しないHTTP失敗とは分けている。通信・競合が一切発生しなかったという意味ではない。

証跡：[localhost結果](environment-verification/local/result.json)、[公開結果](environment-verification/public/result.json)、[D1/R2照合](environment-verification/public/data-audit.json)、[引渡し確認](environment-verification/handoff.json)、[公開トップ](environment-verification/public/top.png)、[撮影フォーム](environment-verification/public/camera.png)、[8名受付](environment-verification/public/eight-registrations.png)、[Admin](environment-verification/public/admin.png)、[Champion](environment-verification/public/champion.png)。前回の32人SHOW全編・動画は[REHEARSAL32.md](REHEARSAL32.md)。

未実装として今回要求された主要フローに欠ける機能は検出していない。ただし実スマホ、Safari、実会場の映像・音声機材は未確認。自動運営とAdmin双方の進行要求による回復可能な競合は残る。会場音声や細かなUIUXは今回の対象外。既存大会・旧Workerは削除せず保持している。

## 固定 URL 例（スナップショット・当日は Rehearsal 準備直後のリンクを正本に）

以下は **2026-10-30 時点の1大会の例** です。再「準備」や別端末での大会作成をすると ID が変わります。当日は [DAY_OF_EVENT.md](./DAY_OF_EVENT.md) の手順どおり Rehearsal から取った 3 リンクのみ使ってください。

## 今後使うURL（スマートフォン受付用・参加者0名から）

| 画面 | URL |
|---|---|
| TOP | https://tournament-through-rehearsal.pine-shaken.workers.dev/?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |
| 受付 | https://tournament-through-rehearsal.pine-shaken.workers.dev/checkin?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |
| Admin | https://tournament-through-rehearsal.pine-shaken.workers.dev/admin?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |
| Display | https://tournament-through-rehearsal.pine-shaken.workers.dev/display?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |
| Rehearsal | https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |
| Animation Preview | https://tournament-through-rehearsal.pine-shaken.workers.dev/show-preview?run=cf-through-81b47523-4b12-43b8-80e3-9ba6496e75b2 |

準備時点で参加者0名・受付中・SHOW・発表前。スマホで確認コードを入力し、名前・rating・写真を登録する。同じrunのAdmin/DisplayをPCから開く。写真付き4名以上の偶数人数を登録後、受付終了→ペア発表開始→Bracket→ゲームスタート→VS待機→試合開始→勝者確定を繰り返す。ratingは現仕様では任意だが、確認時には入力する。

この空大会で「初期化・参加者準備」を再実行すると別大会になる。撮影後は同じrunのURLを使い続ける。既存の32人SHOW発表前大会は[REHEARSAL32.md](REHEARSAL32.md)のURLを使用する。自動通しでは仮勝敗を入力するため、実際の勝敗を操作する場合はAdminで手動進行する。

## 再現command

- ローカル起動：`npm run dev`（http://localhost:5174/）。ローカル確認コードは`cloudflare/local/.dev.vars`。
- build：`npm run build`。
- 公開：`npm run deploy:rehearsal`。既存canonical Workerのみを更新。
- 公開確認コード：repo直下の`.checkin-access.local`。Secret値は本資料に記載しない。

現時点の公開version：`aca4f408-5939-4e36-8723-1971e2a76c64`。トップと開発用接続確認は既存checkin frontendに接続。既存Admin/Display/API/認証を保持し、D1/R2/Secretsの追加や更新、既存大会の初期化・削除、新規依存の導入は行っていない。
