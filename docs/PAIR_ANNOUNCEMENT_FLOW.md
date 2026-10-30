# 受付終了から第1試合VSまで（2026-10-25）

後続の第1試合開始から第2試合VSまでは [MATCH_PROGRESS_LOOP.md](MATCH_PROGRESS_LOOP.md) に記録。以下は受付・発表ゲートの確認記録です。

`大会フロー再確認.md` に合わせ、受付終了・ペア発表・ゲーム開始を分離しました。今回の対象は第1試合の「試合開始」待ちまでです。従来資料の「Draw開始でペア保存」「Bracketから自動で第1試合」は、この手順で置き換えます。

## 操作と状態

| 運営の操作／自動処理 | D1の正本 | 会場Display |
|---|---|---|
| 名前・写真・ratingを登録 | participants／非公開R2 | 大会開始待機 |
| **受付終了** | closed_roster固定、既存ロジックでteams／team_members／公開順／Bracket snapshot／matches保存 | 大会開始待機のまま |
| **ペア発表開始** | 確定済みsessionを保持しsceneをdrawへ変更 | 既存Draw、全員の名前・保存写真、各PAIR CONFIRMED、全ペア一覧 |
| 全ペア発表完了 | scene=bracket、current matchは未選択 | Bracketで待機 |
| **ゲームスタート** | getNextMatchで第1試合を選択、現在試合とsceneを保存 | 既存NEXT MATCH／VS |
| VS完了 | scene=vs_cardのまま | **試合開始待ち** |

通常運営に試合選択リストはありません。「ゲームスタート」は大会進行の開始、「試合開始」は表示中の対戦を実際に開始する別の操作です。Displayに演出選択・更新ボタンは置いていません。現在状態はD1から復元します。

Bracket／matchesは受付終了時に事前生成し、Draw後に同じBracketを表示します。演出側ではペア・試合・勝者を決めません。受付終了の固定とペア準備は別batchのため、準備で障害が起きた場合は受付を閉じたままエラーを返し、「ペア確定を再試行」で回復します。確定済みsessionがあれば再生成しません。

## 調査して再利用した既存実装

- `src/features/draw/draw.ts`: `makeBalancedTeams`（rating降順で上位と下位を組ませる）、`buildRevealOrder`、`teamRatingSum`。新しい組合せアルゴリズムは追加していません。全組合せの最適解を探索する仕様ではありません。未入力ratingは計算時のみ0として扱い、登録値nullを変更しません。
- `src/features/bracket/manager.ts`: `buildDoubleElimination`、既存snapshot生成・復元。
- `src/features/progression/progression.ts`: `getNextMatch`。実施可能な試合から既存順序で選択。
- `DrawStage.tsx`／`PairConfirmed.tsx`: 既存Drawの描画・GSAPタイミング・写真表示を共用。今回変更なし。
- `FlowPresentation.tsx`／既存`PostMatchStage.tsx`／`BracketView.tsx`: 既存Bracket・NEXT MATCH・VS表示を共用。今回変更なし。

既存Supabase向けAdmin／Displayや独立Animation Previewの処理は変更していません。Cloudflare専用の受付・運営・Displayの状態接続を変更しています。ブラウザへAdmin／Display API Tokenを埋め込まず、確認コードによるHttpOnly Cookieで認証します。R2の公開設定は不要です。

## 公開URL

| 用途 | URL |
|---|---|
| 通常大会の受付 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin |
| 通常大会の運営 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/admin |
| 通常大会のDisplay | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display |
| 今回の隔離検証大会・運営 | https://tournament-pair-gates-e2e.pine-shaken.workers.dev/admin |
| 今回の隔離検証大会・Display | https://tournament-pair-gates-e2e.pine-shaken.workers.dev/display |
| 独立Animation Preview | https://tournament-animation-preview.pine-shaken.workers.dev/ |

確認コードは従来と同じ。[ローカル保存先](../.checkin-access.local)。既に開いている端末は再読み込みしてください。検証大会もコードが必要です。通常大会は既に第1試合VSへ進んでいたため、受付やDrawへ巻き戻していません。検証大会も終了済みDrawを再生し直すリセット機能は設けていません。任意演出の繰り返し確認はAnimation Previewを利用します。

## 検証に使う実登録データ

通常大会`cf-rehearsal-001`の固定済み4名を、隔離大会`cf-pair-gates-e2e-20261025`へ再登録しました。元の写真をbyte単位でコピーし、元とコピーのportrait APIのSHA-256一致を確認しています。新たなスマホ撮影をした試験ではありません。元大会の参加者・写真・ペア・勝敗を試験用に書き換えていません。

| 参加者 | rating | 保存写真サイズ |
|---|---:|---:|
| にゃー | 9 | 62,466 bytes |
| けんけん | 13 | 78,964 bytes |
| テスト | 10 | 59,706 bytes |
| テスト2 | 5 | 62,191 bytes |

既存ロジックの結果は「けんけん & テスト2」合計18と「テスト & にゃー」合計19です。両名の写真と名前を、同じD1確定ペアに対応させて発表します。

## 検証と変更範囲

公開試験は成功しました。確認した状態遷移は次の通りです。

| 段階 | scene／version | 現在試合 | 結果 |
|---|---|---|---|
| 受付終了・ペア保存 | idle／1 | null | 4秒待ってもDrawは始まらない |
| 運営がペア発表開始 | draw／2 | null | 4名全員の名前・保存写真、2組のPAIR CONFIRMED、全ペア一覧を確認 |
| 発表完了 | bracket／3 | null | 6秒以上待ってもVSは始まらない |
| 運営がゲームスタート | vs_card／4 | 0 | 試合IDを送らずにサーバーが自動選択 |
| VS完了・再読み込み | vs_card／4 | 0 | 試合開始待ちのまま、勝者未入力、完了試合0 |

D1直接照合：session `c3e5deed-09ea-4186-9e05-b9144034881e`、2 teams／4 team_members、rating合計18／19。第1試合選択後は `events.bm_current_match_id=0`、`event_state.current_match_id=cf-pair-gates-e2e-20261025-bm-0`。対応するmatchesの両チームIDも確定ペアと一致し、winnerはnullでした。2チーム大会のため、既存表示仕様で初戦にFINALと表示されます。

通常Workerも更新済み（version `7482c5dd-7f9f-411b-b835-e64b9d0b6de0`）。更新後の通常大会は従来のsession `fc819566-8c6a-4d6b-8f6a-08bfaeb3224a`、scene=vs_card／version=3、current match=0、完了試合0を維持しています。通常大会で「試合開始」や勝者入力は実行していません。

通常Displayを1365×900、390×844、1920×1080で開き、4枚の保存写真の読み込みと操作ボタンがないことを確認しました。実データ `/show-preview` と独立Animation Previewの6シーンも読み取り確認しました。ブラウザ実行エラー0、公開フローで予期しないHTTPエラー0。検証用Nodeクライアントの一時的な接続切断は、保存済みBracketから再開して確認を完了しました。画面表示サイズの確認はブラウザ試験であり、実機試験ではありません。

`npm run build:checkin`、`npm run build`、168 tests（23ファイル）が成功しています。通常URLへの反映後の確認は、`scripts/verify-pair-gates-deployment.cjs` で実施し、参加者更新・試合開始・結果入力のリクエストが0件であることも確認しました。

公開検証スクリプトは `scripts/verify-pair-gates.cjs`。同じ隔離大会に対する新規試験用で、進行済み大会を自動リセットしません。記録・保存写真のハッシュ・スクリーンショットは非追跡の `.wrangler/pair-gates-e2e/` に保存します。

今回の主な変更ファイル：

- `cloudflare/checkin/src/index.ts`、`draw.ts`、`flow.ts`：受付終了時の事前確定、発表・ゲーム開始コマンド、Bracketでの待機。
- `cloudflare/checkin/src/draw.test.ts`、`flow.test.ts`：新しい操作順、二重操作・再送・障害回復、既存後半戦の回帰確認。
- `src/checkin/DrawControl.tsx`、`DisplayPage.tsx`、`api.ts`：現在状態に必要な操作だけ表示、Display操作ボタン除去、エラー文言。
- `src/checkin/presentationAdapter.ts`：隔離検証event IDの許可。
- `cloudflare/checkin/wrangler.pair-gates-e2e.jsonc`、`scripts/verify-pair-gates.cjs`、`scripts/verify-pair-gates-deployment.cjs`：公開試験。
- `scripts/verify-tournament-flow.cjs`：旧完走スクリプトも明示的なゲームスタートに対応。今回、このスクリプトで後半戦の公開試験は行っていません。
- `PLAN.md`、`docs/README.md`、`TOURNAMENT_FLOW.md`、`CLOUDFLARE_REQUIRED_ACTIONS.md`、本書：最新手順へ更新。

依存追加、DB migration、既存データ削除はありません。依頼元の `大会フロー再確認.md` は変更していません。

既存の勝者入力からChampionまでの処理は保持し、今回新しい演出や後半戦の機能は追加していません。後半戦の回帰は単体テストで確認し、今回の公開操作は最初の「試合開始」ボタンを押す前で止めます。新たなスマホ撮影、実際の試合、会場モニター実機での見え方は運営者による確認が残ります。
