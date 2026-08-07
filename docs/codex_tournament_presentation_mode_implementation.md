# Codex指示書：トーナメントシステム 操作説明 Presentation Mode 実装

## 目的
既存のダーツ大会・トーナメントシステムに、初めて使う運営者でも操作の流れを理解できる「操作説明 Presentation Mode」を追加してください。

単なる静的説明ページではなく、実際のUIを使いながら、
- 対象ボタンやカードをハイライト
- 説明パネル表示
- 吹き出し表示
- 疑似カーソル移動
- クリック演出
- 自動遷移
- 戻る / 一時停止 / 次へ / 最初から / 終了

を組み合わせて、一連の大会運営フローをWebアニメーションとして見せてください。

完成したPresentation Modeは、
- アプリ内の操作ガイド
- リハーサル
- 運営者への説明
- 営業デモ
- 画面録画による1〜2分程度の説明動画
に利用できる設計にしてください。

---

## 1. 最重要方針

1. 既存の大会進行ロジックを壊さない
2. Presentation Modeは通常運営モードから分離
3. 実データは変更しない
4. 既存のサンプル / リハーサルデータがあれば再利用
5. 実際のUIを使って説明
6. UI変更時に壊れにくい構造にする
7. 16:9のPC画面で見栄え良くする
8. 過剰なリファクタリングは避ける

---

## 2. まず既存リポジトリを調査

いきなり実装せず、以下を確認してください。

- トップ / メニュー
- 参加者登録
- 抽選 / ペア決定
- ダーツ演出
- PAIR CONFIRMED
- トーナメント表
- 試合進行
- 勝者入力
- WINNER演出
- NEXT MATCH
- START MATCH
- FINAL / CHAMPION
- Display
- リハーサル
- sample data
- route構造
- state管理
- API / DB書き込み
- GSAP / Framer Motion / CSS animation
- setTimeout / setInterval

---

## 3. 実装前報告

コード変更前に以下を報告してください。

### 現在の関連ファイル
各ファイルの役割を簡潔に記載。

### Presentation Modeの最適な入口
例:
- `/presentation`
- `?presentation=1`
- `/rehearsal?guide=1`

既存構造に合わせて決定。

### 通常モードへの影響
- DB変更有無
- API実行有無
- Displayへの影響
- state共有有無

---

## 4. Presentation Mode 基本UI

第一候補は、実際の操作画面 + 右側説明パネル。

```text
┌────────────────────────────────────┬──────────────────┐
│ 実際の操作画面                     │ 説明 3 / 14      │
│                                    │                  │
│ [対象UIをハイライト]               │ 見出し           │
│       ↑                            │ 説明本文         │
│    吹き出し                        │                  │
│       ● 疑似カーソル               │ progress         │
├────────────────────────────────────┴──────────────────┤
│ 戻る | 一時停止 | 次へ | 最初から | 終了             │
└───────────────────────────────────────────────────────┘
```

---

## 5. 必須表現

### 対象UIハイライト
- outline
- glow
- 周辺暗転
- 弱いpulse

### 吹き出し
例:
- 「まず参加者登録を開きます」
- 「ここで顔写真を登録します」
- 「試合開始は運営者が手動で行います」

### 疑似カーソル
DOM/CSSで作成。
対象へ自然に移動 → 一瞬停止 → クリック演出。

### クリック演出
- ripple
- ring
- cursor縮小
- button pressed

### 説明パネル
最低限:
- 説明番号
- 見出し
- 本文
- progress

### 操作
- 戻る
- 一時停止 / 再生
- 次へ
- 最初から
- 終了

---

## 6. 自動再生 + 手動操作

Presentation Modeは両対応。

### 自動再生
各STEPを指定時間表示後に次へ。

### 一時停止
- 自動進行停止
- 次へ / 戻るは使用可能
- 可能ならGSAP timelineもpause

---

## 7. STEP定義をデータ化

説明内容を各componentへベタ書きしない。

例:

```ts
type PresentationStep = {
  id: string
  title: string
  description: string
  route?: string
  target?: string
  action?: "highlight" | "click" | "wait" | "transition"
  duration?: number
  tooltip?: string
}
```

対象DOMは可能なら専用属性で識別。

```tsx
data-guide="participant-registration"
data-guide="start-match"
data-guide="pair-confirmed"
```

CSS classやDOM階層への依存を減らしてください。

---

# 8. 推奨ストーリー：14 STEP

## STEP 1：このシステムでできること
対象: トップ画面

説明:
「参加者登録からペア抽選、トーナメント進行、試合演出までを一つの流れで運営できます。」

演出:
主要メニューを順番に軽くハイライト。

---

## STEP 2：参加者登録
対象: 「参加者登録体験（運営）」等

説明:
「大会前に参加者を登録します。名前と顔写真は抽選・対戦カード・勝者演出に利用されます。」

演出:
疑似カーソル → ハイライト → クリック → 登録画面へ。

---

## STEP 3：顔写真・名前登録
対象: 参加者入力UI

説明:
「参加者名と顔写真を登録します。」

重要:
Presentationでは本番データを変更しない。
サンプルデータまたは疑似入力を使う。

---

## STEP 4：大会開始 / ペア抽選
対象: 試合進行・抽選開始

説明:
「参加者が揃ったら、ダブルスの組み合わせ抽選を開始します。」

疑似カーソルで操作。

---

## STEP 5：ダーツ抽選演出
対象: カード + ダーツ

説明:
「カード裏面にダーツが刺さり、約2秒のインパクト演出後にカードが反転します。」

実際に:
ダーツ飛来 → impact → shake / flash / spark → 約2秒 → flip

---

## STEP 6：プレイヤーReveal
説明:
「カードが反転すると、抽選されたプレイヤーの顔写真と名前が表示されます。」

重要:
カード表面ではダーツ・穴・impact markを消す。

---

## STEP 7：PAIR CONFIRMED
対象: 2名の確定カード

説明:
「2人が決定するとペア確定演出が表示されます。実運営では5〜10秒ほど組み合わせを確認できます。」

既存Pair Confirmed演出を利用。

---

## STEP 8：トーナメント表へ反映
対象: Bracket

説明:
「確定したペアはトーナメント表へ反映され、対戦順を確認できます。」

該当する初戦をhighlight。

---

## STEP 9：NEXT MATCH
対象: 次試合案内

説明:
「次の試合はNEXT MATCH画面で表示されます。対戦する2チームを確認します。」

Team A → VS → Team B を順に強調。

---

## STEP 10：試合開始は手動
対象: START MATCH

説明:
「次の試合は自動では始まりません。運営者が対戦カードを確認し『試合開始』を押して進行します。」

疑似カーソル → START MATCHクリック。

---

## STEP 11：試合終了・勝者確定
対象: 勝者入力 / 試合結果UI

説明:
「試合終了後、勝者を確定します。結果はトーナメント表へ反映されます。」

Presentationでは実DBを書き換えない。

---

## STEP 12：WINNER演出
対象: 勝者画面

説明:
「勝者確定後はWINNER演出が表示されます。勝者を明るく表示し、紙吹雪や光は表示中も動き続けます。」

実際に:
- winner bright
- loser dim
- confetti loop
- spark / glow

4〜6秒程度。

---

## STEP 13：次の対戦カードへ自動進行
説明:
「WINNER演出が終わると、次の対戦カードまでは自動で進みます。」

実際に:
WINNER → transition → NEXT MATCH

ここでは運営者操作なし。

---

## STEP 14：次試合開始待ち / 終了
対象: 次のSTART MATCH

説明:
「次の対戦カードが表示されたら、再び運営者が『試合開始』を押します。この流れを決勝まで繰り返します。」

最後に簡潔なフローを表示:

```text
参加者登録
↓
抽選
↓
対戦
↓
勝者
↓
NEXT MATCH
↓
手動 START
```

終了ボタン:
- 最初から見る
- トップへ戻る

---

## 9. FINAL / CHAMPION

既存実装がある場合は追加STEPとして短く説明可。

```text
決勝終了
↓
WINNER
↓
CHAMPION
↓
大会終了
```

全体が長くなるなら省略してよい。

---

## 10. 実データを変更しない

Presentation Modeで以下を変更しないこと。

- 本番参加者
- 本番Bracket
- 勝敗結果
- DB
- Storage

`presentationMode === true` の場合、
- sample data
- mock action
- temporary state

を優先。

既存の「リハーサル（サンプル32名）」があるなら再利用してください。

理想:

```text
Rehearsal = 自由操作
Presentation = 同じサンプルデータで自動説明
```

---

## 11. 起動導線

トップ画面に、

```text
▶ 操作説明を見る
```

を追加する案を第一候補としてください。

必要ならサブテキスト:
「約90秒で大会運営の流れを確認」

---

## 12. 見た目

既存大会UIを維持。

推奨:
- dark navy / black
- cyan / blue accent
- gold補助
- dark translucent説明panel

説明UIだけ別アプリのように見せない。

---

## 13. Motion

待機中も完全静止にしない。

動かす:
- background light
- spark
- particle
- confetti
- subtle glow

基本静止:
- 顔写真
- 名前
- 数字
- 説明本文

---

## 14. 疑似カーソル

対象へ400〜800ms程度で自然に移動。
クリック前に150〜300ms程度停止。

瞬間移動させない。

---

## 15. Tooltip

対象要素に応じて top / bottom / left / right を選択可能にする。
画面外にはみ出さない。

---

## 16. STEP表示時間目安

| 種類 | 時間 |
|---|---:|
| 短い説明 | 3〜4秒 |
| UI操作 | 4〜5秒 |
| ダーツ | 実演出に合わせる |
| PAIR CONFIRMED | 5秒前後 |
| WINNER | 4〜6秒 |
| NEXT MATCH | 4〜5秒 |

全体:
**90秒〜2分程度**

ナレーションは今回不要。

---

## 17. Pause / Next / Back / Restart / Exit

### Pause
最低限:
- STEP自動進行停止
- timer停止

可能なら:
- GSAP timeline pause
- cursor停止

### Next
待機時間をスキップして次STEPへ。

### Back
前STEPを再構築。
巻き戻しが難しい場合はpresentation専用stateを再設定。

### Restart
Presentation state初期化 → STEP 1。

### Exit
Presentation終了 → トップへ。
通常運営モードへ勝手に進めない。

---

## 18. routeを跨ぐ場合

STEP状態を失わない方法を採用。

候補:
- Presentation Provider
- query parameterでstep保持
- presentation専用state

過剰な仕組みは避ける。

---

## 19. タイマー / Animation cleanup

特に確認:

- setTimeout
- setInterval
- GSAP timeline
- component unmount
- route change
- React StrictMode

STEP変更時に前STEPのtimer / animationを確実にcleanup。

---

## 20. 画面録画への配慮

このPresentation Modeはそのまま画面録画して説明動画にします。

そのため:
- dev情報を出さない
- layout shiftを減らす
- control位置を安定
- 説明panelのサイズを極端に変えない
- 1920x1080で確認
- 1440x900 / 1366x768でも破綻しない

---

## 21. 音

既存SEがある場合は利用可:
- dart
- impact
- card flip
- pair confirm
- winner

ナレーション/BGMはMustではない。

---

## 22. コンポーネント案

既存構造優先だが、概念として:

```text
components/
└── presentation/
    ├── PresentationController.tsx
    ├── PresentationOverlay.tsx
    ├── PresentationPanel.tsx
    ├── PresentationTooltip.tsx
    ├── PresentationCursor.tsx
    ├── PresentationControls.tsx
    └── presentationSteps.ts
```

Controllerは、
- current step
- playing / paused
- next
- prev
- restart
- exit
- timer
- target element

のみ担当。

大会ロジック自体は持たせない。

---

## 23. 実装Phase

### Phase 1
既存構造調査

### Phase 2
Presentation Mode基盤
- mode判定
- Controller
- Step定義
- Panel
- Controls

### Phase 3
Highlight / Tooltip / Cursor
- data-guide属性
- overlay
- target取得
- click animation

### Phase 4
主要フロー
トップ → 参加者登録 → 抽選 → Pair Confirmed → Bracket → Next Match

### Phase 5
試合進行
Start Match → winner input → WINNER → NEXT MATCH

### Phase 6
Playback Controls
pause / resume / next / back / restart / exit

### Phase 7
timing / layout / animation調整

### Phase 8
テスト

---

## 24. テスト要件

### 起動
- 操作説明ボタンから入れる
- 通常モードに影響しない

### STEP
- 1〜最後まで順番に進む
- target / highlight / tooltip / cursorが正しい

### Auto
- 指定時間で次へ
- animation途中に不自然に飛ばない

### Pause
- 自動進行停止
- resume可能

### Next / Back
- timer重複なし
- 前後STEPを正しく再構築

### Restart
- STEP 1へ戻る
- animation残留なし

### Exit
- topへ戻る
- 本番データ変更なし

### Winner
- 勝者が明るい
- loserが暗い
- confettiが止まらない
- その後NEXT MATCHへ自動遷移

### Next Match
- 正しい対戦カード
- START MATCHまでは自動開始しない

### Final
- nextMatchなしで異常動作しない

---

## 25. Codexの最初の作業

まずコード変更前に、以下の形式で調査結果を出してください。

```md
# Presentation Mode 実装前調査

## 1. 現在の画面構造
## 2. 再利用できる既存機能
## 3. リハーサル機能との関係
## 4. Presentation専用データの扱い
## 5. 追加予定ファイル
## 6. 変更予定ファイル
## 7. 実装PLAN
## 8. リスク
```

大きな問題がなければ、そのままPhase 1から実装してください。

---

## 26. 今回不要なもの

- 動画編集Timeline
- CMS
- ガイド編集管理画面
- AIナレーション
- 動画ファイル自動書き出し
- 大規模WebGL

まずはシンプルで壊れにくいPresentation Modeを完成させてください。

---

## 27. 完成イメージ

```text
トップ
↓
「▶ 操作説明を見る」
↓
説明 1 / 14
↓
疑似カーソル → 参加者登録
↓
参加者登録説明
↓
抽選
↓
ダーツ演出
↓
PAIR CONFIRMED
↓
Bracket
↓
NEXT MATCH
↓
START MATCH
↓
勝者確定
↓
WINNER
↓
NEXT MATCHへ自動進行
↓
次のSTART MATCHで待機
↓
説明終了
```

---

## 28. 最終ゴール

Presentation Modeを一度見るだけで、

- 最初に何をするか
- 参加者をどこで登録するか
- 抽選はどう進むか
- どこまで自動か
- どこで運営者が操作するか
- 勝者確定後どう進むか
- 次試合をどう開始するか

が理解できる状態を目指してください。

また、このPresentation Modeをブラウザ録画するだけで、
**1〜2分程度の操作説明動画として成立する品質**を目標にしてください。
