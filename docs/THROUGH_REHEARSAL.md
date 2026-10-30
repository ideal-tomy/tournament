# 大会通しリハーサル

**履歴：2026-10-25の8名確認記録です。現在の32人・16チーム・15試合とcanonical URLは [REHEARSAL32.md](REHEARSAL32.md) を使用してください。** 新しい公開Workerは追加せず、同じthrough Workerを継続しています。

2026-10-25の `依頼.md` に対応。個別Animation Previewを選択せず、専用大会の受付からCHAMPIONまで、実際のD1・非公開R2・Worker API・既存Tournament Logic・Displayを通して確認する入口です。

## 公開入口と使い方

[大会通しリハーサルを開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal)。確認コードは従来と同じです。[ローカル保存先](../.checkin-access.local)。

1. 「参加者の準備」を選び、「初期化・参加者準備」を押します。標準は撮影不要のサンプル8名です。name・rating・PNG画像を通常登録APIでD1／R2へ実保存します。
2. 「Displayを別ウィンドウで開く」で会場用Displayを開きます。必要なら「運営画面を開く」も開きます。URLには同じ検証大会の`run`が付き、別端末でも同じ大会を確認できます。
3. **手動通し確認**では、入口下部の既存運営操作、または別の運営画面で、受付終了→ペア発表開始→ゲームスタート→各試合開始→勝者確定を押します。WINNER後のBracket更新と次VSは自動です。
4. **自動通し確認**では「自動通し確認を開始・再開」。runnerが同じ運営コマンドを呼び、試合開始後2.5秒以上待ってTeam Aを仮winnerとして確定します。演出速度は通常のままで、CHAMPIONまで進みます。
5. 「一時停止」で次の運営コマンド送信を止めます。既に送信した処理や再生中の演出は完了し、次の操作待ちで止まります。開始・再開で継続できます。再読み込み後の自動実行は明示的に開始・再開を押します。
6. 初期化し直すと新しい大会IDになります。古い大会・写真・結果は削除せず、古いURLも保持できます。

通常大会 `cf-rehearsal-001` を初期化・巻き戻しません。専用Workerだけで動作する機能で、生成IDは `cf-through-<UUID>`。通常Workerでは新規大会作成APIは無効です。専用Workerでも任意eventへの運営コマンドを許さず、生成したrehearsal大会だけを選択できます。

「現在の登録参加者をコピー」は、通常大会で保存済みの名前・rating・写真を新しい検証大会へ登録するモードです。元の参加者や結果は変更しません。4名なら2チームで初戦が決勝となるため、複数試合を通す確認にはサンプル8名を使います。サンプルは番号付きの模擬人物画像であり、実参加者8人の撮影を意味しません。

## 表示・停止・再開

入口にevent、受付状態、scene／phase、Round、current match、completed matches、next match、match数、team数、participant数、Championと到達ステップを表示します。これらの開発用ステータスやrunner操作をDisplayへ追加していません。

API失敗・写真取得／decode失敗・人数不足・未対応scene・対戦相手不足・D1のmatches／snapshot／現在試合の不整合を検知するとrunnerを止め、停止したAPIまたは準備段階を表示します。画面間で自動advanceが競合した場合だけ、既存version保護を使って最新状態を読み直します。その他のAPIエラーを成功扱いにして先へ進めません。

送信中コマンドはrequestId・expectedVersionとともにブラウザへ保持し、再開時は同じコマンドを再送します。サーバーの既存command_receiptsにより二重反映を防ぎます。初期化・参加者登録も同じrequestIdで再試行します。初期化が完了すると一時保存した写真データをブラウザから除去します。

全ブラウザを閉じている間はrunnerも進みません。再接続時にD1の状態・経過時刻から復帰します。永続的なサーバー常駐runner、WebSocket、Durable Objects、速度変更は追加していません。

## 本番ロジック・演出の共用

| 対象 | 共用している処理 |
|---|---|
| 参加者・portrait | 既存`/api/participants`、同じvalidation・D1保存・R2保存・portrait API |
| 受付終了・pairing | 既存`/api/checkin/close`、closed_roster固定、makeBalancedTeams／buildRevealOrder |
| Draw・Pair Confirmed | 既存`/api/draw/start`と`DrawStage`／`PairConfirmed` |
| matches・Bracket | 既存buildDoubleElimination、snapshot、matches投影、BracketView |
| 第1試合・next match | 既存game-start／advanceとgetNextMatch |
| 開始・winner | 既存start／winner、applyResult、同じCAS・receipt・operation_log |
| WINNER・NEXT MATCH・VS | 既存FlowPresentationとPostMatchStageへD1のteam／participantデータを渡す |
| FINAL・Champion | 同じ決勝判定、getChampionTeamId、award／finished、既存Champion描画 |
| 会場Display | 同じ`/display` route／DisplayPage。専用の偽物Displayは作らない |

runner自身はBracketやwinner反映を計算しません。現在のAPIレスポンスを見て、次に必要な通常コマンドを送るだけです。仮winnerのTeam A選択と2.5秒待ちは検証runner内だけにあり、通常運営の自動勝者入力には使用しません。

## 確認方法・記録

### 公開での自動完走結果

開始：2026-10-25 16:57:00 JST。終了：17:00:33 JST。意図的な一時停止とAPI失敗・再開の試験時間を含みます。

- 大会：`cf-through-682151c1-6591-4769-a6b2-bdbb13524a25`
- 参加者8名、4チーム、実施6試合（match ID 0→1→2→3→4→5）。初期snapshotには条件付き決勝リセットを含む7枠を生成し、今回はTeam Aが決勝に勝ったためリセット試合は不要でした。
- 最終scene：finished、version=28、scene_seq=28、完了試合6。
- Champion：**リハーサル参加者01 & リハーサル参加者04**（team `2bd0094c-eca0-4fb0-9605-8f5ca55aff59`）。
- D1のdone試合数とwinner操作履歴は各6件。Drawで全8名、4組のPAIR CONFIRMED、全ペア一覧を観察し、WINNER・更新Bracket・FINAL・CHAMPIONを確認しました。
- 個別Animation Previewを一度も選択せず完走。finishedのDisplayを再読み込みしても同じ優勝結果に復帰しました。
- 一時停止・再開、試合開始APIを意図的に1回503にした停止、同じrequestIdでの再開が成功。自動advanceのversion競合20件は通常の同時更新保護として整合状態へ再取得し、二重進行していません。予期しないHTTPエラー0、ブラウザ実行エラー0。
- 完走後の初期化で新しい8名の大会を作り、完走済み大会・登録写真・結果が保持されることを確認しました。

実際に通った状態：

```text
受付open / idle(v0)
→ 受付closed・pair保存 / idle(v1)
→ draw(v2)：Player Reveal ×8 → Pair Confirmed ×4 → 全ペア一覧
→ bracket(v3)：ゲームスタート待ち
→ vs_card(v4)：Match 0
→ match_live(v5) → result(v6) → bracket_update(v7)
→ vs_card(v8)：Match 1
→ match_live(v9) → result(v10) → bracket_update(v11)
→ vs_card(v12)：Match 2
→ match_live(v13) → result(v14) → bracket_update(v15)
→ vs_card(v16)：Match 3
→ match_live(v17) → result(v18) → bracket_update(v19)
→ vs_card(v20)：Match 4
→ match_live(v21) → result(v22) → bracket_update(v23)
→ vs_card(v24)：Match 5 / FINAL
→ match_live(v25) → result(v26) → award(v27) → finished(v28)
```

`bracket_update`はAPIのphase名で、保存sceneは既存の`bracket`です。WINNERは既存result内、CHAMPIONはaward／finished内の描画です。リハーサル専用sceneや大会State Machineは追加していません。

### すぐ開始できる大会と完走結果

| 用途 | URL |
|---|---|
| 8名準備済み・入口 | https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal?run=cf-through-7a1ad3e0-cf5c-474f-872d-cb87708c7ed5 |
| 同じ大会・運営 | https://tournament-through-rehearsal.pine-shaken.workers.dev/admin?run=cf-through-7a1ad3e0-cf5c-474f-872d-cb87708c7ed5 |
| 同じ大会・Display | https://tournament-through-rehearsal.pine-shaken.workers.dev/display?run=cf-through-7a1ad3e0-cf5c-474f-872d-cb87708c7ed5 |
| 完走済み大会・入口 | https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal?run=cf-through-682151c1-6591-4769-a6b2-bdbb13524a25 |
| 独立Animation Preview | https://tournament-animation-preview.pine-shaken.workers.dev/ |

準備済み大会は確認時点で受付open・scene idle・version0です。利用後はその時点の進行状態を表示します。最初からやり直す場合は入口で初期化してください。

### 発見した問題と対応

| 分類 | 問題／確認結果 | 対応 |
|---|---|---|
| 機能不具合 | 大会終了後、条件付き決勝リセット枠がnext match候補に残り、開発用ステータスに表示される | Champion確定時はnextMatchをnullに修正。進行は従来からaward／finishedへ正しく終了しており、余分な試合は開始されない |
| 機能不具合 | 4名・2チームの決勝結果を保存しても既存finalStandingsが取得できず、更新Bracketで停止 | 共通getChampionTeamIdに最少構成の互換処理を追加。保存済みの唯一の決勝のwin/lossだけから取得し、既に停止した大会も勝敗を書き換えずに復帰 |
| state不整合 | 意図的なAPI失敗時にも結果やversionの二重更新が起きないか | 失敗で停止、同じrequestIdで再開、D1件数・状態を照合。予期しない不整合なし |
| 演出の接続 | Draw・全ペア・Bracket・全試合・FINAL・CHAMPIONが同じ大会に接続されるか | 公開Displayで確認。個別演出の手動選択なし |
| 操作 | 一部の既存リンクがrunを落とし、別画面で大会を特定できなくなる | 受付・運営・Display・登録写真Previewの画面リンクにrunを維持 |
| UI/UX | 内部scene名や番号を含む簡易ステータス、サンプル画像・英語Step表示 | 今回は開発確認に必要な表示を維持。細かな画面設計・演出装飾・速度調整は未実施 |

新たなスマホ撮影、8人の実参加者による実戦、会場モニター実機の見え方は今回の自動試験に含めません。

### 4名の手動完走・修正後の確認

登録済み4名をコピーした `cf-through-ef480e2e-aed5-4d55-a197-5ce3038f07dd` で、受付終了・ペア発表開始・ゲームスタート・試合開始・勝者確定を実際の手動ボタンから操作し、finishedまで確認しました。2チーム／1試合、Championは「けんけん & テスト2」です。8名の自動完走とは別に、実保存写真を使った最少構成も確認しています。

優勝判定修正前に更新Bracketで止まった別大会 `cf-through-3bf4db3e-6eff-4cd6-bced-6c65f9ac7197` も、修正後は保存済みの同じ勝者からaward→finishedへ復帰しました。結果の削除・再入力・リセットはしていません。

準備済み8名の大会でportrait取得を意図的に404にした場合、写真エラーを表示して停止し、受付open／version0のまま維持されました。エラー解除・再読み込み後は準備済み状態へ復帰します。受付・運営・登録写真Previewへのリンクが同じrunを維持すること、390px幅で入口を開けることも確認しています。記録は `.wrangler/through-rehearsal-e2e/manual.json`、手動結果とスマホ幅のスクリーンショットに保存しました。

最終公開versionは専用Worker `3e43f1b5-7bdd-445b-9ae6-078c469f10ee`、通常Worker `7e70a5e6-cce5-4128-81f0-de49029c5779`。`npm run build:checkin`／`npm run build`成功。通常大会の4名・session `fc819566-8c6a-4d6b-8f6a-08bfaeb3224a`・vs_card／version3・current match0・完了試合0を維持しました。通常DisplayをPC・SP・1920×1080で読み取り確認し、実データPreviewと独立Animation Previewの6シーンも確認しました。この読取確認中の更新リクエストは0件です。

`scripts/verify-through-rehearsal.cjs` は公開`/rehearsal`のボタンから実行し、別ブラウザの既存Displayを観察します。D1直接照合・状態列・API送信・スクリーンショットは非追跡の `.wrangler/through-rehearsal-e2e/` に保存します。

`npm run test:rehearsal -- --reporter=dot`：176 tests／24ファイル成功。専用Worker以外では無効、認証・Origin制約、イベントID隔離、初期化再送、元大会保持、通常登録・受付終了・Drawの共用、D1不整合検出、元写真への読取専用アクセスを検証しています。既存勝敗・決勝リセットの回帰テストも含みます。

## 変更ファイル

- `cloudflare/checkin/src/rehearsal.ts`、`rehearsal.test.ts`：検証大会作成・状態照合・sourceの読取専用アクセス・隔離検証。
- `cloudflare/checkin/src/index.ts`、`domain.ts`：専用flag、認証後のrun選択、`/rehearsal` route。
- `cloudflare/checkin/src/draw.ts`：既存状態読取のexport。進行ロジックは共用。
- `cloudflare/checkin/src/flow.ts`、`flow.test.ts`：次候補ステータス、優勝後の候補除去、保存済み2チーム決勝からの終了復帰。
- `src/features/progression/progression.ts`、`progression.test.ts`：最少2チーム構成で既存最終順位APIが失敗する場合の共通優勝判定と回帰テスト。
- `src/checkin/RehearsalPage.tsx`：入口・参加者準備・手動操作・通常API runner・停止再開・状態表示。
- `src/checkin/main.tsx`、`api.ts`、`DrawControl.tsx`、`CheckinWorkspace.tsx`、`DisplayPage.tsx`、`LiveShowPreviewPage.tsx`：run付きAPI／画面リンクの維持、既存運営・Displayの共用。
- `src/checkin/presentationAdapter.ts`：検証大会IDに対する既存portrait検証。
- `src/checkin/checkin.css`：入口の最低限の配置。
- `cloudflare/checkin/wrangler.through-rehearsal.jsonc`、`scripts/verify-through-rehearsal.cjs`、`scripts/verify-through-manual.cjs`：専用公開設定・自動／手動の公開E2E。
- `scripts/verify-pair-gates-deployment.cjs`：既存画面の読取確認、失敗時のログ表示を調整。
- 本書・PLAN・関連運用資料。

依存追加・インストール、DB migration、既存データ削除、R2公開、ブラウザへのAPI Token埋込みはありません。`依頼.md` は変更していません。
# 最新の試合結果→次試合の演出確認

専用 `/match-transition` と同じ実Displayでの読み取り専用再生、今回の更新時間・公開検証は [MATCH_RESULT_PRESENTATION.md](MATCH_RESULT_PRESENTATION.md) を参照。以下は通しリハーサルの既存記録。
