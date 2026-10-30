# 第1試合開始から第2試合VS待機まで

2026-10-25の `依頼.md` に対応する実装・公開検証記録です。通常大会の勝敗を試験で入力せず、専用の隔離大会を使います。演出デザインやスコア入力は追加していません。

## 操作と実装した遷移

```text
vs_card（NEXT MATCH / VS完了後も待機）
  └ 運営「試合開始」
match_live（試合中、勝者確定を待機）
  └ 運営「○○ の勝利を確定」＋確認ダイアログ
result（D1へ勝者・Bracketを保存してから既存WINNER演出）
  └ 既存演出6秒後に自動
bracket（phase=bracket_update、更新済みの実Bracketを2秒表示）
  └ 自動getNextMatch
vs_card（次のNEXT MATCH / VS、運営の試合開始待ち）
```

`winner`という独立sceneは追加していません。WINNERは既存`result`内の演出です。更新後のBracketも既存`bracket` sceneを利用し、`lastMatchId`を持つ場合だけ自動進行します。初回Draw直後のBracketは引き続き「ゲームスタート」待ちで、勝手に第1試合へ進みません。決勝結果にchampionがある場合は、従来通りresult→award→finishedへ進みます。

次試合を選ぶUIや「次の試合を表示」ボタンはありません。開始と勝者確定だけを運営が操作します。WINNER／Bracket更新中は勝者・開始ボタンを出しません。DisplayはD1のscene/versionを読み、保存済みsnapshotと実登録データを描画します。自動進行は既存の画面ポーリングから `/api/tournament/advance` を呼ぶ方式です。全端末が閉じている間は自動遷移リクエストが発生せず、再接続時に期限を確認して再開します。

## 既存処理の調査・再利用

- `src/features/progression/progression.ts`: `applyResult`、`getNextMatch`、`getChampionTeamId`、チームUUID・Roundの変換。重複する勝敗判定や次試合選択は作っていません。
- `src/features/bracket/manager.ts`: snapshotからmanagerを復元し、既存brackets-managerで勝ち上がりを更新・snapshot化。
- `cloudflare/checkin/src/flow.ts`: 既存start／winner／advanceのCASとreceiptを維持。今回resultの後に更新済みBracketを表示する自動段階を追加。
- `src/checkin/FlowPresentation.tsx`: 既存PostMatchStageへD1の勝者team・参加者名・portrait API URLを渡してWINNER、次対戦の2teamでVSを再生。Animation Previewのサンプル参加者は渡していません。
- `SavedBracket`／既存`BracketView`: 更新済みsnapshotを描画。演出側で次試合・勝者を決定しません。

## D1保存と二重操作

`matches`のwinner／loser／status、`events.bracket_snapshot`／`bm_current_match_id`、`event_state`のscene／current_match_id／version／scene_seq、`command_receipts`、`operation_log`を同じD1 batchで保存します。今回、既存operation_logへの記録を追加しました。

同じrequestId・内容の再送は成功済みコマンドを再利用します。同じrequestIdで別winnerを送った場合はREQUEST_CONFLICT、古いexpectedVersionで別操作を送った場合はVERSION_CONFLICTとなります。receiptを取得できたbatchだけが書込みを行い、開始や勝者確定の二重反映を防ぎます。勝者確定後は現在試合を一旦nullにし、次試合をresolveしたbatchで新しいIDを保存します。

## 公開URLとデータの区別

| 用途 | URL |
|---|---|
| 今回の隔離大会・運営 | https://tournament-match-loop-e2e.pine-shaken.workers.dev/admin |
| 今回の隔離大会・Display | https://tournament-match-loop-e2e.pine-shaken.workers.dev/display |
| 通常大会・運営 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/admin |
| 通常大会・Display | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display |
| 独立Animation Preview | https://tournament-animation-preview.pine-shaken.workers.dev/ |

確認コードは従来と同じ。[ローカル保存先](../.checkin-access.local)。運営とDisplayは別のブラウザ／端末で開けます。公開運営画面にはRound・Match番号・Team A/B・各参加者の写真と名前を表示します。

通常大会の4名は2チームで初戦が決勝になるため、第2試合への遷移確認には使っていません。隔離大会 `cf-match-loop-e2e-20261025` に、既存4名の保存写真・ratingを各2回使用し、名前に「進行検証A／B」と明示して8件を登録しました。D1・非公開R2への通常登録APIを利用しています。8人の実参加者や新たな実機撮影を確認した試験ではありません。元大会の参加者・写真・ペア・勝敗は変更しません。

## テスト・記録

公開環境で基本ループを1回完了しました。実際の遷移は以下の通りです。

| 操作／表示 | scene | version／scene_seq | current match |
|---|---|---|---|
| 第1試合VS・開始待ち | vs_card | 4／4 | 0 |
| 運営が試合開始 | match_live | 5／5 | 0 |
| 運営が勝者確定・WINNER表示 | result | 6／6 | null |
| 自動で更新済みBracket表示 | bracket（phase=bracket_update） | 7／7 | null |
| 自動で第2試合VS・開始待ち | vs_card | 8／8 | 1 |

大会session：`7bd699c0-abfa-42e1-b6e8-7cdb4649f4c6`。試験データのA／Bは登録名の検証用接尾辞です。

| 項目 | 第1試合 | 第2試合 |
|---|---|---|
| manager match ID | 0（画面Match #1） | 1（画面Match #2） |
| D1 matches.id | cf-match-loop-e2e-20261025-bm-0 | cf-match-loop-e2e-20261025-bm-1 |
| Round | 1 | 1 |
| Team A | けんけん（進行検証A） & テスト2（進行検証B） | テスト（進行検証B） & にゃー（進行検証B） |
| Team A ID | 35e95318-7ab9-4db9-ba6a-f1274547e93a | f1d4ba75-3007-435e-a628-081d6c3f139d |
| Team B | けんけん（進行検証B） & テスト2（進行検証A） | テスト（進行検証A） & にゃー（進行検証A） |
| Team B ID | d183ee38-92e3-4eb4-9238-fd99c1cc5996 | d424643c-f0d6-46bb-ac58-e30b40884584 |
| 勝者／状態 | Team A勝利、done | 未開始、ready、勝者なし |

第1試合の勝者は勝者側の次Roundへ、敗者は敗者側Bracketへ保存され、既存Bracket表示でも勝ち上がりを確認しました。直後の第2試合は残る準決勝です。次試合は `flow.ts` 内の `nextMatch()` →既存 `progression.ts:getNextMatch()` が決定し、D1の実施可能な試合の先頭ID・両チームと一致しました。

最終D1照合：`events.bm_current_match_id=1`、`event_state.current_match_id=cf-match-loop-e2e-20261025-bm-1`、scene=vs_card、version=8、scene_seq=8。完了試合は1件、`flow.start`と`flow.winner`のoperation_logも各1件です。二重送信や異なるwinnerの送信後も、第1試合のwinnerは変更されませんでした。

| 依頼の確認項目 | 公開試験結果 |
|---|---|
| 第1試合を手動START、正しいmatch ID | 成功。開始前は4秒待っても自動開始しない |
| 勝者選択・D1 winner保存・Bracket更新 | 成功。Team Aの勝利と次Roundへの進出を直接照合 |
| WINNERに実保存写真と名前 | 成功。勝者2名の写真をdecodeし、名前・WINNER文字を確認 |
| WINNER後のBracket表示・次match自動resolve | 成功。運営の追加操作なし |
| 次matchを手動選択しない | 成功。操作UIに試合選択なし、リクエストにmatchId指定なし |
| 第2試合の正しい2teamのVS | 成功。D1 ready先頭と表示が一致、4枚の写真を確認 |
| 次試合の開始待機 | 成功。5秒待機してもversion=8、未開始のまま |
| 勝者確定の二重送信 | 成功。同じコマンド再送は200、異なるwinner／古いversionは409 |
| Display reloadからD1状態へ復帰 | 成功。match_liveと第2試合VSで確認 |
| Animation Previewを維持 | 成功。独立Previewの6シーンと実データshow-previewを読取確認 |

公開試験のブラウザ実行エラー0、予期しないHTTPエラー0。試験が実行した運営操作は受付終了、ペア発表開始、ゲームスタート、第1試合開始、第1試合勝者確定だけです。第2試合は開始していません。

通常Workerへも反映済み（version `36ba4275-71de-4244-bc56-0a6397922255`）。通常大会は元の4名・session `fc819566-8c6a-4d6b-8f6a-08bfaeb3224a`・vs_card／version=3・current match=0・完了試合0を維持しました。PC・390pxスマホ幅・1920×1080での読取確認中、更新リクエストは0件でした。

`npm run test:rehearsal` は170 tests／23ファイル成功。実SQLiteで、試合開始競合、同一winner再送、異なるwinner競合、batch部分失敗のrollback、応答消失後の再送、更新済みBracketの表示段階、次試合自動選択、敗者復活と決勝リセットを含むChampion終了を検証しました。

`npm run build:checkin`、`npm run build`も成功しています。今回は第1試合→第2試合の公開ループまで完了とし、8人の実参加者を使った実戦、実機撮影、会場モニターでの確認まで完了したとは扱いません。

通常の `npm test -- --run` は既存node_modules junction経由のGSAP解決で1 suiteが失敗しました（166 testsは成功）。依存追加・更新はせず、この環境向けに既存のpreserveSymlinks設定を持つ `test:rehearsal` で全170件を実行しています。

公開試験：`scripts/verify-match-loop.cjs`。D1直接照合、操作リクエスト、実写真のSHA-256、スクリーンショットは `.wrangler/match-loop-e2e/` に保存します（非追跡）。通常大会への読取確認は `scripts/verify-pair-gates-deployment.cjs` を使います。

## 今回の変更ファイル

- `cloudflare/checkin/src/flow.ts`: result→更新済みBracket→次VSの自動段階、既存operation_logへの同一batch記録。
- `cloudflare/checkin/src/flow.test.ts`: 開始・勝者再送と競合、更新済みBracket段階、既存Champion回帰。
- `src/checkin/DrawControl.tsx`: 現在試合のRound・チーム・実写真・名前、状態に応じた操作表示。
- `src/checkin/FlowPresentation.tsx`: WINNER後に独立して更新済みBracketを表示。
- `src/checkin/checkin.css`: 対戦参加者一覧の最小限の配置。
- `src/checkin/presentationAdapter.ts`: 隔離大会IDを許可。
- `cloudflare/checkin/wrangler.match-loop-e2e.jsonc`、`scripts/verify-match-loop.cjs`: 隔離公開検証。
- 本書、`PLAN.md`、`docs/README.md`、`docs/CLOUDFLARE_REQUIRED_ACTIONS.md`、関連運営資料。

新規依存、DB migration、R2公開、ブラウザへのAPI Token追加はありません。`依頼.md` は変更していません。実際の試合・撮影・会場実機での確認は運営者によるリハーサルが残ります。
# 最新の観客向け試合結果演出

WINNER保持・更新前Bracket・実進出ライン／写真移動・更新後・次VS待機の実装と公開検証は [MATCH_RESULT_PRESENTATION.md](MATCH_RESULT_PRESENTATION.md) を参照。以下は前段階の記録。
