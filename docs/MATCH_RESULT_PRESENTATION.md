# WINNER → BRACKET ADVANCE → NEXT MATCH / VS

2026-10-25の `依頼.md` に対応。対象は勝者確定から次試合開始待ちまでです。受付・pairing・Championの確定処理は変更していません。

## 調査結果

| 既存コード | 存在していた演出・処理 | 現在の公開Cloudflare Displayとの関係 |
|---|---|---|
| `src/features/presentation/scenes/ResultScene.tsx` | 勝者の写真・名前、明暗、結果から次sceneへの遷移 | Supabase側`src/routes/DisplayPage.tsx`で使用。DB遷移も含むためCloudflare側へそのまま移植しない |
| `VsCardScene.tsx` | 対戦者接近、VS、ラウンド表示 | 同じSupabase側Displayで使用。今回のCloudflare主系統では未使用 |
| `EffectOrchestrator.tsx`／`PresentationStage.tsx` | frozen／updated snapshotの重ね表示、勝者、線・接近・衝突の組立て | 現在のrouteからOrchestratorを直接importしている箇所なし。旧系統を丸ごと復活させない |
| `WinnerLayer.tsx`／`LineCollision.tsx`／旧`timeline.ts` | 勝者表示、2フィーダーからの棒上昇、接近、collision、flash、凍結→更新Bracketのcrossfade | 旧PresentationStage内に残存。2フィーダー同時の演出を現在の1勝者進出に直結すると実際の次試合と対応しない場合がある |
| `advanceEffect.ts` | 両フィーダーが完了した親試合の検出 | 片方だけ確定した時はnull。毎試合の勝者進出を表示する唯一の条件にはできない |
| `BracketView.tsx`／`layout.ts` | 実snapshotの配置・source／target・直交path・確定済み線の強調 | 現主系統でも共用。従来は更新済みデータの静止画を表示していた |
| `PostMatchStage.tsx` | WINNER保持、装飾的Bracket advance、接近、impact、VS、NEXT MATCH | 現主系統のWINNER／VS。装飾線は実Bracketのsource／targetを表していなかった |
| `src/checkin/FlowPresentation.tsx` | result→静止Bracket→次VS、実参加者の写真・名前 | 今回接続する主系統。`/display`・通しリハーサル・専用確認で同じ描画を使用 |

旧timelineの凍結／更新の分離とGSAPの制御方式を参考にし、実際の座標計算・path生成・BracketView・現在のWINNER／VS描画を共用しました。旧Orchestratorのイベント駆動・Supabase更新・仮の衝突点を現在のWorkerへ持ち込んでいません。

## 今回接続したもの

勝者確定時、既存winner commandの同じD1 batchで、勝敗・更新済みsnapshot・matches・sceneとともに、描画専用の`resultPresentation`を保存します。内容は**更新前のBracketの深いコピー・元の試合・実際の勝者team ID**です。大会の正本は従来通り更新済みsnapshotとmatchesです。

Displayはその保存値から次の順で再生します。

1. **WINNER（result、6秒）**：既存PostMatchStageで勝者の写真・名前を保持。装飾的な仮Bracketに進む手前でtimelineを保持します。
2. **Bracketへcrossfade**：同じWINNER画面を重ね、更新前Bracketへ自然に切り替えます。
3. **実際の進出（bracket、6秒）**：更新前の選手配置を残し、勝者側の実source slotから実target slotへ、線を連続伸長させ、勝者の保存写真を移動します。到着後に更新済みBracketへcrossfadeします。
4. **次VS（vs_card、3.5秒）**：既存getNextMatchが選んだ2teamを、その実Bracket上の位置から引き出します。背景も同じ実Bracketです。既存の接近・impact・VS・NEXT MATCHへ接続します。
5. **開始待ち**：NEXT MATCHで止まり、運営の「試合開始」だけでmatch_liveへ進みます。

更新前／後のSVGは共通の更新後レイアウト座標へ配置し、選手データだけを切り替えます。これにより、敗者側エリアが現れても座標のずれで勝者が飛びません。SVGの余白も考慮してVSの引き出し位置を計算します。線や移動先は実Bracketに存在する進出だけを描画し、存在しない親試合を捏造しません。

既に確定済みの旧結果に更新前snapshotがない場合、過去を推測して進出アニメーションを生成せず、従来のBracket表示を維持します。新たに勝者を確定した試合から更新前後が保存されます。

## 専用確認画面

[試合結果 → 次試合 演出確認](https://tournament-through-rehearsal.pine-shaken.workers.dev/match-transition)。従来と同じ確認コードです。[ローカル保存先](../.checkin-access.local)。

- 「確認用の1試合を準備」：既存の大会作成・参加者登録・受付終了・Draw・ゲームスタート・試合開始APIを順に使用し、専用大会を**勝者確定直前**で止めます。既存Drawを実際に通るため準備に約2分かかります。
- 下部の既存運営操作で勝者を選び、同じDisplayを観察します。外部の`/display?run=...`でも同じ演出が流れます。
- 結果確定後の「最初から再生」「一時停止」「再開」は、D1に保存された更新前後を使い、**同じFlowPresentation／AnimatedBracketAdvance／PostMatchStageを読み取り専用で再生**します。winner commandやBracket更新をもう一度送りません。
- 再生は勝者確定直前の1秒→WINNER→Bracket進出→VS→NEXT MATCH待機で止まります。「ライブ表示へ戻る」で実際の大会状態に戻れます。
- 準備は新しい`cf-through-<UUID>`を作り、既存の検証大会・通常大会を削除・リセットしません。サンプル画像の生成は通しリハーサルの既存処理を共用しています。

専用画面は独自の勝敗・次試合計算や別のDisplayを持ちません。再生中のscene指定は保存済み結果の描画時刻を確認するためのもので、大会stateは変更しません。

## 公開確認で見つかった問題

最初の公開確認では写真の移動は連続していましたが、SVGの正規化したstrokeDashoffsetがGSAPのCSS整数丸めで1→0へ飛びました。`autoRound:false`を指定し、中間の長さが連続して変化するよう修正しました。実Bracket背景を使う次VSでは、装飾用の仮Bracket線も表示しないようにしています。

## 検証・変更ファイル

### 公開Displayでの確認結果

隔離大会 `cf-through-f9d7532e-fb83-4624-916e-27671a09fb50` で、実際の勝者確定から以下を確認しました。

```text
match_live（match ID 1、Round 1）
→ result / version10（WINNER：リハーサル参加者07 & リハーサル参加者06）
→ bracket / phase=bracket_update / version11
   更新前 → source match1の勝者slotからtarget match2へ進出 → 更新後
→ vs_card / version12（次match ID 2、Round 2）
→ NEXT MATCHで停止
→ 運営が試合開始を押した後だけ match_live / version13
```

勝者team `ec110823-a47e-4c60-9701-9a18912b07fa` が、元のsnapshotでは進出先におらず、更新後はmatch2へ入っていることを照合しました。次試合は既存getNextMatchが決定し、Team Aは「リハーサル参加者01 & リハーサル参加者04」、Team Bは今回の勝者「リハーサル参加者07 & リハーサル参加者06」です。

線の中間値を公開画面から取得し、strokeDashoffsetが `0.9961 → 0.8071 → 0.3565 → 0.1131 → 0.0058 → 0` と連続して変わることを確認しました。写真の移動もSVG上の`(112,124)`付近から実進出先`(102,49)`へ連続して変化し、更新後はその進出先の選手データが表示されました。スクリーンショットを目視して、保存済みの写真・名前、更新前、線伸長中、更新後、次の2チームのVS／NEXT MATCHを確認しています。

| 完了条件 | 公開確認 |
|---|---|
| 勝者確定・WINNER・顔・名前 | 成功。既存winner APIと保存済み参加者データ |
| Bracketへの接続・更新前の表示 | 成功。WINNERからcrossfadeし、更新前レイヤーを確認 |
| 勝者ラインの実動作・次Roundへの配置 | 成功。実source／targetと中間の線長・移動座標を照合 |
| 次試合resolve・正しい2team・VS | 成功。match2の両teamがD1読取結果と一致 |
| NEXT MATCHで停止・自動開始しない | 成功。表示後4.5秒待ってもversion12のまま |
| 運営操作でのみ試合開始 | 成功。明示的なstartでのみmatch2を開始しversion13へ |
| reloadで大会データを壊さない | 成功。NEXT MATCH待機の同じversion・現在試合へ復帰 |
| 最初から再生・一時停止・再開 | 成功。同じ描画を使い、再生中の更新リクエスト0件 |

検証中のブラウザ実行エラー0、予期しないHTTPエラー0。待機までの画像と操作開始までの記録は `.wrangler/match-transition-e2e/verified-transition.json` に保持しています。通常大会へ検証用winnerは入力していません。

`npm run test:rehearsal -- --reporter=dot`：179 tests／25ファイル成功。両勝者slotから実際の親試合への座標、未完了試合・進出先がない場合、保存済みbefore／afterの分離、再送・競合、従来の大会完走を確認しています。

公開E2E：`scripts/verify-match-transition.cjs`。実Displayでの各時点の画像、strokeDashoffset、写真の移動座標、API状態列、再生中の更新リクエスト数を `.wrangler/match-transition-e2e/` へ保存します（非追跡）。

変更ファイル：

- `cloudflare/checkin/src/flow.ts`、`flow.test.ts`：winnerの同一batch内で描画用beforeを保存、更新Bracket表示を6秒へ。
- `src/checkin/DrawControl.tsx`：保存された描画用データの型。
- `src/features/bracket/BracketView.tsx`：凍結データと共通座標での表示、実team slot情報。
- `src/features/bracket/resultAdvance.ts`、`resultAdvance.test.ts`：実source／target／pathの解決とテスト。
- `src/checkin/AnimatedBracketAdvance.tsx`：現在のDisplayで使う更新前→線伸長・移動→更新後の描画。
- `src/checkin/FlowPresentation.tsx`：WINNER保持・crossfade・進出・実BracketからのVSへの接続、読み取り専用seek。
- `src/features/presentation/postMatch/PostMatchStage.tsx`：実位置からの対戦者引き出し。既存単体Previewは従来の既定動作を保持。
- `src/checkin/MatchTransitionPage.tsx`、`main.tsx`、`checkin.css`、Worker `index.ts`：専用確認routeと制御。
- `src/checkin/rehearsalSamples.ts`、`RehearsalPage.tsx`：既存サンプル生成関数を共用できる場所へ移動。受付やpairingの動作変更なし。
- `vite.checkin.config.ts`：純粋な座標helperを専用buildの許可範囲へ追加。
- 検証script、本書、PLAN・運用資料。

依存追加、DB migration、秘密情報のブラウザ埋込み、既存大会の勝敗書換えはありません。受付・ペア発表・Championの演出・確定ロジックは今回変更していません。
## 最終公開状態・すぐ確認できるURL（2026-10-25）

[準備済みの「試合結果 → 次試合 演出確認」を開く](https://tournament-through-rehearsal.pine-shaken.workers.dev/match-transition?run=cf-through-dfcd1cf1-a6b2-475b-abe4-f9ef9fd8c5d5)

既存のリハーサルアクセスコードで入場し、「最初から再生」を押してください。同じ実Displayで試合中→WINNER→更新前Bracket→実ライン伸長／写真移動→更新後→次VS／NEXT MATCH待機を再生します。「一時停止」「再開」も使えます。この再生は読み取り専用です。「ライブ表示へ戻る」で実大会へ戻ります。「試合開始」は実際に検証大会を進める操作です。

この新規大会はmatch 0の結果確定後、次match 1の `vs_card`／version 8で待機しています。実ライブのWINNER・更新前・線の途中・更新後・次VS・実進出先・待機・reloadを確認済み。通信タイムアウトで検証スクリプトが一度中断したため、同じ大会を読み取り専用で再接続し、再生・一時停止・再開・POST 0件・version不変・ブラウザエラー0件を確認しました。大会の再作成・結果再入力はしていません。

- 検証記録: `.wrangler/match-transition-e2e/showcase.json`
- 確認画像: `.wrangler/match-transition-e2e/showcase-replay.png`
- 全条件を通過した別大会の実ライブ・運営開始検証記録: `.wrangler/match-transition-e2e/verified-transition.json`
- 専用Worker最終version: `8b3eff5e-ebf0-4dbe-b8d6-37fc957b4cac`
- 通常Worker最終version: `5a6faa66-35e4-49da-8c36-ca783dc6d705`
- 再生開始時にスナップショットを固定し、ライブ側の更新で確認中の対象が切り替わらないようにしています。
- 追加した読取専用再確認スクリプト: `scripts/verify-match-transition-showcase.cjs`

以下は実装・調査・検証の詳細です。
