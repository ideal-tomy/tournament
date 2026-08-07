# トーナメント演出 現状調査・改善実装PLAN

- 調査日: 2026-08-07
- 指示元: `docs/codex_tournament_animation_review_and_plan.md`
- 調査対象: ダブルスペア抽選、試合結果、ブラケット反映、次試合案内
- この版の範囲: 現状調査、原因特定、改善設計、Phase計画。大規模な実装変更は行わない

## 0. 結論

大会ロジックと演出データの分離はすでにできているため、ブラケット生成や勝敗計算を作り直す必要はない。主な問題は `DrawScene.tsx` のDOM階層とGSAPタイムライン、および `result → bracket → vs_card` のシーン遷移設計にある。

優先順位は次のとおり。

1. カード反転前にダーツ・穴・裏面専用エフェクトを必ず消す
2. 参加者単位の連続再生を、ペア単位の再生へ変更する
3. ペアごとに2枚の表面カードを並べ、7秒保持する
4. Winner表示後の進行を「ブラケット更新確認 → Next Match」へ接続する
5. 最終試合だけはNext Matchへ進まず、将来のChampion演出へ分岐できるようにする

大規模なState Machine導入は現段階では不要。既存のGSAPマスタータイムラインを維持し、タイミング定数、DOMレイヤー、ペア単位のタイムライン組み立てを追加する最小変更が安全である。

---

# 1. 現在の実装構造

## 1.1 ペア抽選

| File | 役割 |
|---|---|
| `src/features/draw/DrawPanel.tsx` | Adminの編成プレビュー、確定操作、多重操作を `busy` で抑止 |
| `src/features/draw/draw.ts` | レーティング均等編成と `buildRevealOrder()`。演出処理は持たない |
| `src/features/draw/drawApi.ts` | `teams`、`team_members`、ブラケット、`draw_sessions` を保存し、`scene = draw` へ遷移 |
| `src/features/presentation/scenes/DrawScene.tsx` | 確定済み公開順を取得し、full / short / liteのGSAP演出を再生 |
| `src/lib/tournamentEffects.ts` | カード、ダーツ、衝撃、フレーム、音声のURL定義 |
| `src/lib/media.ts` | Display開始時の画像・動画・音声プリロード |
| `src/routes/DisplayPage.tsx` | `event_state.scene === draw` のとき `DrawScene` を表示 |
| `src/features/scene/sceneActions.ts` | `event_state` と `scene_seq` を更新しDisplayへ同期 |

### データ取得・保存

```text
DrawPanelで確定
↓
drawApiがteams / team_membersを保存
↓
ブラケットを生成・eventsへ保存
↓
確定チームを崩さずreveal_orderへ変換
↓
draw_sessionsへcommitted_at付きで保存
↓
event_state.scene = draw
↓
DrawSceneがdrawSessionIdを使って参加者情報を取得
```

この経路では演出コンポーネント内で抽選していない。大会ロジックとPresentation Layerの分離は維持できている。

## 1.2 カード・ダーツ・impact

`DrawScene.tsx` 内の `RevealCard` がカード表裏、ダーツ、軌跡、impact画像、穴をまとめて描画している。独立したDartコンポーネントやCardコンポーネントはまだ存在しない。

DOMの概略:

```text
.draw-reveal-card
├─ .draw-card-shell           ← Y軸回転するのはここだけ
│  ├─ カード裏面
│  └─ カード表面 + 顔写真 + 名前
├─ .draw-dart-streak          ← shellの外
├─ .draw-dart                 ← shellの外
├─ .draw-impact-layer         ← shellの外
└─ .draw-impact-mark          ← shellの外
```

## 1.3 タイマー・animation state

- full抽選演出は `DrawScene.tsx` の単一GSAPタイムライン
- `currentPlayer`、`cardSide`、`impactVisible` などのReact stateは持たない
- 表示状態はGSAPの `autoAlpha`、`rotationY`、`scale` でDOMへ直接反映
- 次の参加者への進行は `cards.forEach()` でタイムラインを直列連結
- 全員終了後に `.draw-team-summary` を一度だけ表示
- cleanupは `gsap.context().revert()` で実行
- `forceComplete` または復帰時間超過時は `bracket` へ遷移

抽選演出について `setTimeout` の連鎖は存在しない。新しいReact stateを多数追加するより、GSAPタイムライン内へラベルと明示的な表示・非表示を追加する方が既存構造に合う。

## 1.4 試合進行

| File | 役割 |
|---|---|
| `src/features/progression/MatchControl.tsx` | Adminの勝者選択、勝敗確定、VS表示、VSクローズ、undo、スキップ |
| `src/features/progression/useProgression.ts` | `busy`、進行状態、undo用snapshotを管理 |
| `src/features/progression/progression.ts` | 現在試合の検証、次試合、勝敗適用、終了判定 |
| `src/features/progression/progressionApi.ts` | ブラケット更新、matches同期、`scene = result` への遷移 |
| `src/features/presentation/scenes/ResultScene.tsx` | 勝者150%、敗者75%、花吹雪、3.5秒後のブラケット復帰 |
| `src/features/presentation/scenes/VsCardScene.tsx` | NEXT MATCH相当の2チーム表示。Adminが閉じるまで保持 |
| `src/features/scene/sceneMachine.ts` | `match_live → result → bracket → vs_card → match_live` の遷移定義 |

---

# 2. 現在の演出フロー

## 2.1 full抽選

現在の一人分の流れ:

```text
カード表示・scale in（0.35秒）
↓
ダーツ飛来（0.55秒）
↓
穴を表示
↓
impact画像を拡大（0.42秒）
↓ 0.12秒重ねて開始
impact画像fade、ダーツfade（約0.38秒）
↓
カード反転（0.62秒）
↓
顔写真を表示したまま0.55秒
↓
カード全体をfade（0.25秒）
↓
次の参加者
```

全員終了後:

```text
TEAM CONFIRM SE
↓
全チーム一覧scale in（0.65秒）
↓
2.2秒保持
↓
bracketへ自動遷移
```

現状は「1人目 → 2人目 → ペア確定 → 次ペア」ではなく、「全参加者を1人ずつ公開 → 全チーム一覧」である。

## 2.2 short / lite

- short: 全参加者一覧を表示 → 1.5秒 → 全チーム一覧を2.2秒
- lite: 全チーム一覧を2.5秒

## 2.3 試合終了から次試合

```text
Adminが勝敗確定
↓
brackets-managerへ勝敗適用
↓
events.bracket_snapshotとbm_current_match_idを更新
↓
matchesを同期
↓
event_state.scene = result
↓
ResultScene: 勝者拡大・敗者縮小・花吹雪
↓ 約3.5秒
event_state.scene = bracket
↓
更新済みブラケット表示
↓
Adminが「対戦カードを表示」を押す
↓
event_state.scene = vs_card
↓
次の2チームを表示し、Admin操作まで保持
↓
Adminが「対戦カードを閉じる」
↓
match_live
```

Winner演出とVS画面は存在する。ただし、ブラケット復帰後にVS画面へ自動または半自動でつなぐ中間制御はなく、Adminの手動操作が必要。

---

# 3. 問題の原因

## 3.1 穴が残る原因

原因は明確で、`DrawScene.tsx` のDOM配置とタイムラインの非表示漏れ。

1. `.draw-impact-mark` は回転する `.draw-card-shell` の外側にある
2. 着弾時に `.set(impactMark, { autoAlpha: 1 })` で表示する
3. その後、カード反転前に `autoAlpha: 0` へ戻す処理がない
4. `.draw-card-shell` だけが `rotationY: 180` になるため、穴は回転せず前面に残る
5. 最後に親カード全体が消えるまで、顔写真の上へ穴が重なる

z-indexだけの問題ではない。cleanup漏れでもなく、通常再生中の明示的なvisibility reset不足である。

安全な修正は次の両方を行うこと。

- `impactMark` をカード裏面DOMの内側へ移す
- 反転開始直前にも `.set([dart, streak, impactMark, impactLayers], { autoAlpha: 0 })` を入れる

DOM階層とタイムラインの二重防御により、表面・player reveal・pair confirmedでは絶対に表示されなくなる。

## 3.2 切り替えが速すぎる原因

- impactの実質尺が約0.8秒で、指定の2秒holdがない
- 反転直後の顔写真保持が0.55秒しかない
- 一人のカード終了から次の参加者まで専用のtransition時間がない
- タイミング値がタイムラインへ直接記述され、調整単位が分散している

## 3.3 ペア確定表示がない原因

- `cards.forEach()` が参加者単位で一直線にタイムラインへ追加される
- `teamSize` は最後のチーム一覧を作るためにしか使われていない
- 2名公開後を検知してPAIR CONFIRMEDを挿入する処理がない
- 2枚の公開済みカードを同時に保持するDOMがない
- 現在の全チーム一覧保持は2.2秒のみで、推奨5〜10秒を満たさない

## 3.4 試合間演出がないように見える原因

完全に存在しないわけではない。

- Winner相当: `ResultScene` が実装済み
- Next Match相当: `VsCardScene` が実装済み

不足しているのは両者をつなぐ進行設計。

- ResultSceneは約3.5秒で必ずbracketへ戻る
- bracketからvs_cardへの遷移はAdminの手動ボタンのみ
- Next Match画面自体に導入アニメーションや推奨5秒の確認尺はない
- 最終試合でもResultSceneはbracketへ戻り、`finished` シーンへ自動分岐しない

## 3.5 多重操作

現在の保護:

- 抽選確定: `DrawPanel.busy` で確定ボタンを無効化
- 勝敗確定: `useProgression.busy` と確認ダイアログで抑止
- VS操作: `sceneBusy` で二重操作を抑止
- 同一結果の再適用: progressionロジックで検証

残る注意点:

- Adminの演出モード切替はscene_seqを上げるため、抽選演出が先頭から再マウントされる
- ResultSceneのcleanupは再生途中なら `finish()` を呼ぶ。シーン変更とunmountが重なると、古いResultSceneがbracket遷移を書き込む競合余地がある
- DisplayがDrawScene / ResultScene内からDBのsceneを更新している。設計原則上はAdminのみを変更元にする方が安全だが、既存構造を一度に変更すると影響が大きい

## 3.6 prefers-reduced-motion

現在、`prefers-reduced-motion` の検出はない。`lite` モードは存在するが、OS設定とは連動していない。

---

# 4. 改善後フロー

## 4.1 ペア抽選full版

```text
TEAM 01 / 1人目カード裏面
↓
ダーツ飛来 0.6秒
↓
着弾 + カードshake + flash / sparks / ring
↓
impact hold 2.0秒
↓
ダーツ・穴・裏面エフェクトを非表示
↓
カード反転 0.7秒
↓
1人目の顔・名前Reveal 0.8秒
↓
1人目をペア確定ステージ左へ保持
↓
TEAM 01 / 2人目を同じ流れで公開
↓
2人目を右へ保持
↓
2枚を中央へ少し寄せる
↓
TEAM 01 / PAIR CONFIRMED 1.0秒
↓
ペア確認hold 7.0秒
↓
両カードtransition out 0.8秒
↓
TEAM 02の1人目へ
```

奇数人数で3名チームの場合は、`teamSize` または実際のchunk人数を使い、全メンバー公開後にTEAM CONFIRMEDへ進む。

## 4.2 推奨タイミング定数

```ts
export const DRAW_ANIMATION_TIMING = {
  cardEnter: 350,
  dartFlight: 600,
  impactBurst: 450,
  impactHold: 2000,
  impactClear: 200,
  cardFlip: 700,
  playerReveal: 800,
  moveToPairStage: 500,
  pairReveal: 1000,
  pairConfirmHold: 7000,
  transitionToNext: 800,
} as const;
```

GSAPへ渡すときだけ `/ 1000` して秒へ変換する。テストではミリ秒の定数を直接検証する。

## 4.3 試合終了から次試合

推奨する安全な初期版:

```text
勝敗確定とブラケット保存
↓
result: WINNER表示 4秒
↓
bracket: 更新箇所を2秒強調
↓
次試合あり?
├─ Yes: Adminの「次試合案内」操作でvs_card
│        ↓
│        NEXT MATCHを5秒以上確認
│        ↓
│        Adminが閉じてmatch_live
└─ No: finished（将来Championへ）
```

初期実装ではvs_cardを自動開始せず、現在の手動クローズ方針を維持する。まずResultScene終了後、Admin側に「次試合案内へ」ボタンを明確に出す。現場運用を確認後に自動遷移を検討する。

---

# 5. 変更対象ファイル

| File | 変更内容 | 影響度 |
|---|---|---:|
| `src/features/presentation/drawAnimationTiming.ts` | 抽選タイミング定数と総尺計算を新設 | 小 |
| `src/features/presentation/scenes/DrawScene.tsx` | 裏面限定impact、ペア単位timeline、PAIR CONFIRMEDを追加 | 中 |
| `src/features/presentation/scenes/PairConfirmed.tsx` | 2名以上の同時表示を小さな表示コンポーネントとして分離 | 小〜中 |
| `src/features/draw/drawApi.ts` | durationSecを新しい総尺計算に合わせる | 小 |
| `src/routes/DisplayPage.tsx` | draw復帰時間を新しいdurationSecに追従 | 小 |
| `src/features/presentation/scenes/ResultScene.tsx` | Winner保持尺、cleanup競合、終了時分岐を整理 | 中 |
| `src/features/presentation/scenes/VsCardScene.tsx` | NEXT MATCH導入と最低確認時間の表示設計 | 小〜中 |
| `src/features/progression/MatchControl.tsx` | result後の次操作を明確化、操作可否をsceneで制御 | 中 |
| `src/features/progression/progressionApi.ts` | 次試合有無・大会終了情報をscene payloadへ明示 | 小〜中 |
| `src/features/scene/sceneMachine.ts` | 必要ならfinished分岐と演出尺を更新 | 小 |
| `src/index.css` | reduced-motion時のshake・particle抑制 | 小 |

新しい大規模ディレクトリへの移動は不要。Presentation関連は現在の `src/features/presentation/` 配下を維持する。

---

# 6. 実装PLAN

## Phase 1: 穴・ダーツ・impactの表示条件修正

目的: 顔写真に穴が重なる不具合を最小変更で直す。

1. impact markをカード裏面レイヤーへ移す
2. 反転直前にダーツ、軌跡、穴、impact画像を明示的に非表示
3. 次カード開始時に全transform / autoAlphaを初期化
4. `showImpactMark = back && impact` と同等の不変条件をテスト可能な形にする
5. 反転中・表面・pair confirmedのスクリーンショット確認

完了条件:

- カード裏面の着弾中だけ穴が見える
- 表面、顔写真、ペア確定画面では穴・ダーツ・亀裂が見えない
- 10回連続再生して状態が残らない

## Phase 2: タイミング定数化と余韻追加

1. `DRAW_ANIMATION_TIMING` を新設
2. impact holdを2000msへ変更
3. player revealを800ms以上確保
4. 次参加者へのtransitionを800ms確保
5. payloadの `durationSec` を定数から計算

完了条件:

- タイムライン内に主要なmagic numberが残らない
- 復帰判定の総尺と実際の演出尺が一致する

## Phase 3: ペア単位のPAIR CONFIRMED

1. `participants` を `teamSize` 単位でchunkする
2. `cards.forEach` を `teams.forEach → members.forEach` へ変更
3. 公開済みカードを左右のペア確定ステージへ移す
4. TEAM番号、2名の名前、PAIR CONFIRMEDを表示
5. 7000ms保持
6. transition out後に次チームへ進む
7. 3名チームと最終チームも同じロジックで処理

完了条件:

- 各ペアを7秒確認できる
- 次のダーツ飛来前に前ペアが明確に退場する
- 最終ペア終了後だけ全チーム一覧へ進む

## Phase 4: Winner・Next Match進行整理

1. Winner表示を4秒基準へ調整
2. ResultScene cleanupからの古いDB書き込み競合を防ぐ
3. result後に更新済みブラケットを一定時間表示
4. 次試合ありの場合、Adminへ「次試合案内」操作を明示
5. VsCardSceneへNEXT MATCH導入アニメーションを追加
6. VSは最低5秒表示後も、Adminが閉じるまで保持
7. 最終試合はVSを出さずfinishedへ分岐

完了条件:

- 勝者・ブラケット更新・次試合の順が観客に理解できる
- 次試合のチームが更新済みsnapshotと一致する
- 最終試合でNEXT MATCHを表示しない

## Phase 5: 安全性・reduced motion・回帰テスト

1. mode切替、スキップ、unmount、StrictModeでtimeline cleanupを確認
2. `prefers-reduced-motion` をlite相当へ寄せる
3. particle、shake、flashをreduced motion時に抑制
4. 16名・32名・奇数人数を確認
5. Display再読込・Realtime再接続を確認
6. 全テストと本番ビルド

---

# 7. リスク

| リスク | 現状 | 対策 |
|---|---|---|
| GSAP cleanup | DrawSceneは`context.revert`済み | ペア化後もtimelineを1本に維持する |
| ResultSceneのrace | cleanup時にDB遷移を実行し得る | scene_seqを完了条件へ含め、古いインスタンスから更新しない |
| React StrictMode | effectが開発時に再実行される | timeline生成・破棄をcontext内へ限定し、完了処理を冪等化 |
| mode切替 | scene_seq変更で先頭から再生 | short切替は確定チーム一覧へ直接移る仕様として明文化 |
| 復帰時間ずれ | payloadは現在 `人数×4+4` の概算 | 定数から総尺を計算する純粋関数へ変更 |
| 長時間化 | 1ペア7秒で全体が長くなる | Adminへ総時間表示、short切替を常設 |
| 3名チーム | ダブルス固定UIだと欠ける | `teamSize` ではなくchunk実体の人数で描画 |
| 最終試合 | result後もbracketへ戻る | nextMatch有無をpayloadで固定しfinishedへ分岐 |
| DisplayからDB更新 | 現在Draw/Resultがscene更新 | 今回は維持。将来Admin/サーバー主導化を別Phaseで検討 |
| reduced motion | 未対応 | OS設定を検出し、lite相当の描画へ落とす |

---

# 8. テスト項目

## 8.1 Pair Draw

- [ ] ダーツが0.5〜0.8秒で正常に飛ぶ
- [ ] impact演出を約2秒確認できる
- [ ] 穴がカード裏面の着弾中だけ表示される
- [ ] カード反転開始時にダーツ・穴・impact markが消える
- [ ] 顔写真に穴が重ならない
- [ ] 1人目と2人目の名前が同時に読める
- [ ] TEAM番号とPAIR CONFIRMEDが表示される
- [ ] ペアを約7秒確認できる
- [ ] transition out後に次ペアへ進む
- [ ] 最終ペア後だけ全チーム一覧へ進む
- [ ] 3名チームでも全員表示される
- [ ] short / lite / 演出スキップで結果が変わらない
- [ ] 途中リロードで別の組み合わせにならない

## 8.2 Tournament

- [ ] 試合終了後にWinner演出が表示される
- [ ] 正しい勝者名・顔写真・チーム名が表示される
- [ ] 更新済みブラケットへ正しい結果が反映される
- [ ] 次試合案内に正しい2チームが表示される
- [ ] NEXT MATCHを最低5秒確認できる
- [ ] Adminが閉じるまでVS画面が保持される
- [ ] 最終試合ではNEXT MATCHを表示しない
- [ ] 最終試合後はfinishedまたは将来のChampionへ進む
- [ ] undo後にブラケットとsceneが一致する

## 8.3 Race・cleanup

- [ ] ボタン連打で抽選・勝敗確定が二重実行されない
- [ ] 演出途中のmode切替で古いtimelineが残らない
- [ ] scene切替後に古いResultSceneがbracketへ上書きしない
- [ ] React StrictModeでSEや完了処理が二重発火しない
- [ ] Display再接続後にscene_seqが巻き戻らない
- [ ] prefers-reduced-motionでshakeとparticleが抑制される

---

# 9. 実装開始時の判断

次回の実装はPhase 1から開始する。Phase 1〜3は抽選Presentation Layer内の変更であり、大会ロジックを変更しない。Phase 4はシーン遷移へ関わるため、抽選側の回帰確認後に着手する。

実装順を入れ替えず、各Phaseごとにテスト・ビルド・目視確認を完了してから次へ進む。

---

# 10. 実装進捗

## Phase 1 — 完了（2026-08-07）

実施内容:

- `impact-mark` を回転要素の外側からカード裏面DOM内へ移動
- 各カード開始時にダーツ、軌跡、穴、impact画像を非表示へ初期化
- 各カード開始時にカード回転角を裏面の0度へ初期化
- カード反転直前にダーツ、軌跡、穴、impact画像を一括で強制非表示
- `shouldShowBackOnlyEffect()` を追加し、「裏面かつimpact中だけ表示可能」を明文化
- 表面、flipping、playerRevealed、pairConfirmedでは必ずfalseになる単体テストを追加

検証結果:

- TypeScript型チェック: 成功
- Vitest: 10ファイル、43テスト成功
- Vite本番ビルド: 成功
- 既知の警告: メインJSチャンクが500kB超。Phase 1の機能には影響しない

未実施:

- 実データを使ったブラウザ目視確認
- 10回連続再生時の残像・表示残り確認

次はPhase 2「タイミング定数化と余韻追加」へ進む。

## Phase 2 — 完了（2026-08-07）

実施内容:

- `DRAW_ANIMATION_TIMING` を新設し、すべてミリ秒で一元管理
- GSAPへ渡す箇所だけ `drawSeconds()` で秒へ変換
- ダーツ飛来を600msへ調整
- impact burstを450ms、着弾後の余韻を2000msへ調整
- ダーツ・穴・impactのclearを200msへ調整
- カード反転を700msへ調整
- 顔写真と名前のRevealを独立レイヤー化し、800msで表示
- 次の参加者へのtransitionを800msへ調整
- intro、short、lite、最終一覧の主要尺も同じ定数へ集約
- `estimateDrawDurationMs()` / `estimateDrawDurationSec()` を追加
- `drawApi` の `scene_payload.durationSec` を人数×固定値から総尺計算へ変更

設定値:

```ts
const DRAW_ANIMATION_TIMING = {
  dartFlight: 600,
  impactBurst: 450,
  impactHold: 2000,
  impactClear: 200,
  cardFlip: 700,
  playerReveal: 800,
  transitionToNext: 800,
}
```

検証結果:

- TypeScript型チェック: 成功
- Vitest: 11ファイル、47テスト成功
- Vite本番ビルド: 成功
- `DrawScene.tsx` の主要なGSAP durationに数値直書きがないことを確認
- 総尺が参加人数に対して同じ一人分ずつ増えることを単体テストで確認
- 既知の警告: メインJSチャンクが500kB超。Phase 2の機能には影響しない

未実施:

- 実データによる2秒のimpact余韻とSE同期の目視確認
- 会場PCでの速度・音量調整

次はPhase 3「ペア単位のPAIR CONFIRMED」へ進む。

## Phase 3 — 完了（2026-08-07）

実施内容:

- `groupDrawParticipants()` を追加し、確定済み公開順を崩さずチーム単位へ分割
- fullタイムラインを `参加者全員の直列処理` から `チーム → メンバー` の二重構造へ変更
- `PairConfirmed.tsx` を新設
- 各チームの全メンバー公開後、表面カード・顔写真・名前を同時表示
- ダブルスは `PAIR CONFIRMED`、3名チーム等は `TEAM CONFIRMED` と表示
- TEAM番号を2桁形式で表示
- 確定画面を1000msで表示し、7000ms保持
- 800msで退場してから次チームのダーツ演出へ進行
- 確定画面にはダーツ・穴・impact markを描画しない
- 全チーム終了後の一覧表示は維持
- `durationSec` に参加者数だけでなく実チーム数を反映

タイムライン:

```text
TEAM 01 / 1人目公開
↓
TEAM 01 / 2人目公開
↓
PAIR CONFIRMED表示 1秒
↓
2人を同時表示 7秒
↓
退場 0.8秒
↓
TEAM 02 / 1人目のダーツ飛来
```

検証結果:

- TypeScript型チェック: 成功
- Vitest: 12ファイル、53テスト成功
- Vite本番ビルド: 成功
- ダブルスの隣接順が維持されることを単体テストで確認
- 3名チームと端数チームが欠落しないことを単体テストで確認
- PairConfirmedに2名の名前とTEAM番号が含まれることをレンダリングテストで確認
- PairConfirmedに穴・ダーツ用クラスが含まれないことをレンダリングテストで確認
- 1チームごとに `pairReveal + pairConfirmHold + transitionToNext` が総尺へ追加されることを確認
- 既知の警告: メインJSチャンクが500kB超。Phase 3の機能には影響しない

未実施:

- 実データによる7秒保持と次チームへの切り替わりの目視確認
- 画面解像度ごとの2名・3名カードの収まり確認

次はPhase 4「Winner・Next Match進行整理」へ進む。

## Phase 4 — 完了（2026-08-07）

実施内容:

- Winner演出の総尺を4000msへ統一
- Result終了時は、表示開始時の`scene_seq`と一致する場合だけ次シーンへ進む条件付き更新を追加
- ResultコンポーネントのcleanupからDB遷移を行わないようにし、古い画面による上書きを防止
- 次試合がある場合は更新済みブラケットへ戻し、2000msの確認時間後にAdminの「次試合案内」を有効化
- 対戦カード表示時に最低表示期限を保存し、Admin UIとDB更新処理の両方で5000ms未満のクローズを防止
- VSカードへ左右チームのスライドイン、ラウンド表示、VSマークの導入アニメーションを追加
- 最終試合ではブラケットへ戻さず、Winner演出後に`finished`へ遷移
- Result payloadへ次試合ID、大会終了フラグ、優勝チームIDを追加
- 大会計算ロジックとSupabaseスキーマは変更なし

進行フロー:

```text
勝敗確定
↓
WINNER表示 4秒
↓
次試合あり: 更新済みブラケット表示 2秒
↓
Adminが「次試合案内を表示」
↓
VS導入アニメーション + 最低5秒表示
↓
Adminが閉じる → match_live

最終試合のみ:
WINNER表示 4秒 → finished
```

検証結果:

- TypeScript型チェック: 成功
- Vitest: 13ファイル、56テスト成功
- Vite本番ビルド: 成功
- 4000ms / 2000ms / 5000msの定数と期限判定を単体テストで確認
- 既知の警告: メインJSチャンクが500kB超。Phase 4の機能には影響しない

未実施:

- 実際のDisplayとAdminを2画面で開いた手動進行確認
- 会場環境でのVS導入アニメーションと5秒保持の体感調整
