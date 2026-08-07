# Codex指示書：トーナメント演出の現状確認・実装PLAN作成

## 目的

既存のトーナメントシステム内にある「ダブルスのペア決定演出」と「試合終了後〜次試合開始までの進行演出」を確認し、現在の実装を壊さずに改善するための実装PLANを作成してください。

今回はまず **現状調査と実装PLAN作成を優先** してください。

いきなり大規模なコード変更を行わず、

1. 現在の実装構造を確認
2. 問題の原因を特定
3. 関連コンポーネント・state・timer・animation処理を整理
4. 改善後の演出フローを設計
5. 実装タスクをPhase分け
6. 既存機能への影響範囲を整理

した上で、実装PLANを提示してください。

---

# 1. 現在発生している問題

## 1-1. ダーツの穴が顔写真表示後も残る

現在、

- カード裏面にダーツが刺さる
- カードが反転する
- プレイヤーの顔写真が表示される

という流れになっています。

しかし、ダーツが刺さった際の「穴・impact mark」がカード反転後も残ってしまっています。

### 修正したい仕様

ダーツの穴は **裏面のカードにのみ表示** してください。

カードが反転してプレイヤーの顔写真が表示された時点で、

- ダーツ本体
- ダーツの穴
- impact mark
- 裏面専用の亀裂

などは非表示にしてください。

表面のプレイヤーカードには穴がない状態が正しいです。

---

# 2. ペア決定演出が速すぎる問題

現在、

ダーツが刺さる  
→ すぐ反転  
→ 顔写真表示  
→ すぐ次の演出

となっており、

**誰と誰がペアになったのか確認する時間がほぼありません。**

大会演出として、観客・参加者がペアを認識できる時間を設けたいです。

---

# 3. 改善後のダブルスペア決定フロー

以下を基本フローとしてください。

```text
カード裏面表示

↓

ダーツ飛来

↓

カード裏面にダーツが刺さる

↓

約2秒
impact演出
・カード振動
・フラッシュ
・火花
・光リング
・必要に応じて軽いズーム

↓

カード反転

↓

プレイヤー顔写真表示
・ダーツを消す
・穴を消す
・impact markを消す

↓

2人目も同様に決定

↓

ペア確定演出

↓

5〜10秒程度
「誰と誰がペアになったか」を確認できる表示時間

↓

次のペア抽選へ

↓

次のダーツ飛来
```

---

# 4. 推奨タイムライン

固定値にハードコードするのではなく、可能であれば設定値として管理してください。

例：

```ts
const DRAW_ANIMATION_TIMING = {
  dartFlight: 600,
  impactHold: 2000,
  cardFlip: 700,
  playerReveal: 800,
  pairReveal: 1000,
  pairConfirmHold: 7000,
  transitionToNext: 800,
}
```

目安：

| 演出 | 推奨時間 |
|---|---:|
| ダーツ飛来 | 0.5〜0.8秒 |
| 刺さった後のimpact演出 | 約2秒 |
| カード反転 | 0.5〜0.8秒 |
| 顔写真Reveal | 0.5〜1秒 |
| ペア確定演出 | 約1秒 |
| ペア確認時間 | 5〜10秒 |
| 次ペアへの遷移 | 約0.5〜1秒 |

初期値としては、

**pairConfirmHold = 7000ms**

程度を推奨します。

---

# 5. ペア確定演出を新しく追加したい

現在の「顔写真が出たらすぐ次へ」ではなく、2名が決定した後に明確な「PAIR CONFIRMED」状態を作りたいです。

## 表示イメージ

```text
PLAYER A            PLAYER B

[PHOTO]              [PHOTO]

RYOJI                 TAKUMA

        TEAM 01

      PAIR CONFIRMED
```

文字は既存UIのテイストに合わせて変更して構いません。

例：

- PAIR CONFIRMED
- TEAM CONFIRMED
- DOUBLES TEAM
- TEAM 01

など。

---

# 6. ペア確定時の演出候補

既存デザインを壊さない範囲で、以下を検討してください。

### Must

- 2人のカードを同時に見られる
- 名前が明確に読める
- 5〜10秒停止
- 次の抽選へ移ることが視覚的に分かる

### Should

- 2枚のカードが中央方向へ少し移動
- TEAM番号表示
- 中央にPAIR CONFIRMED表示
- 背景を少し暗くする
- 金色 / 青色の光
- 軽いパーティクル
- 確定時に短いSE
- 軽いscale up → settle

### Avoid

- 画面全体を覆う激しい爆発
- 名前が読めなくなるエフェクト
- 何度も激しく点滅する演出
- 長すぎるアニメーション
- ペア確認前に自動で次へ進むこと

---

# 7. 状態管理を確認してください

現在の演出が単純な `setTimeout` の連続で実装されている場合、タイミングの追加によって管理が難しくなる可能性があります。

まず現在の実装を確認してください。

特に以下を調査してください。

```text
・現在のanimation state
・current player / current pair
・card flip state
・dart visibility
・impact visibility
・impact mark visibility
・pair completed state
・next pairへの進行処理
・setTimeout / setInterval
・GSAP timeline
・Framer Motion
・CSS animation
```

---

# 8. 推奨State Machine

既存構造との相性が良ければ、演出状態を明確に分けることを検討してください。

例：

```ts
type DrawPhase =
  | "idle"
  | "cardReady"
  | "dartFlying"
  | "impact"
  | "flipping"
  | "playerRevealed"
  | "secondPlayer"
  | "pairConfirmed"
  | "pairHold"
  | "transitioning"
```

ただし、

**現在の実装がシンプルで問題なく管理できている場合、無理に大規模なState Machineへリファクタリングしないでください。**

最小変更で安全に改善できる方法を優先してください。

---

# 9. 「穴」の表示条件

特にここは明確に実装してください。

概念として、

```ts
const showImpactMark =
  cardSide === "back" &&
  phase === "impact"
```

または同等の条件にしてください。

少なくとも、

```text
表面
player photo表示中
pair confirmed状態
```

では穴・亀裂・ダーツは絶対に表示しないようにしてください。

---

# 10. ペア確定後の進行

現在の「次のダーツ演出へ進む処理」がどこにあるのか確認してください。

以下のように変更する想定です。

### 現在

```text
player reveal
↓
next player / next pair
```

### 改善後

```text
player reveal
↓
pair complete判定
↓
pair confirmed animation
↓
pair hold
↓
transition out
↓
next pair
```

---

# 11. トーナメント進行時の演出も追加したい

ペア抽選だけでなく、

**試合終了 → 次の試合**

にも現在ほぼ演出がありません。

こちらも同じ調査対象にしてください。

---

# 12. 試合終了演出

試合結果確定後、即座に次画面へ切り替えないようにしてください。

基本フロー：

```text
試合終了

↓

勝者確定

↓

WINNER演出

↓

勝者名 / チーム名表示

↓

3〜5秒程度表示

↓

トーナメント表へ結果反映

↓

次試合案内演出
```

---

# 13. 次試合案内演出

次の試合が存在する場合、

```text
NEXT MATCH

TEAM A
VS
TEAM B
```

という中間演出を追加したいです。

推奨フロー：

```text
前試合終了

↓

WINNER表示

↓

トーナメント更新

↓

画面暗転またはtransition

↓

NEXT MATCH

↓

Player / Team A

VS

Player / Team B

↓

5秒程度確認

↓

試合画面へ
```

---

# 14. 大会全体の理想的な演出構造

最終的には以下の流れを想定しています。

```text
大会開始

↓

ダブルスペア抽選

↓

PAIR CONFIRMED

↓

次ペア抽選

↓

全ペア確定

↓

トーナメント表表示

↓

NEXT MATCH

↓

試合

↓

WINNER

↓

トーナメント更新

↓

NEXT MATCH

↓

試合

↓

...

↓

FINAL

↓

CHAMPION
```

今回、FINAL / CHAMPION演出まで実装する必要がなければ、設計だけ考慮してください。

---

# 15. 共通演出コンポーネント化の検討

現在の構造を確認した上で、以下のような共通化が妥当か検討してください。

例：

```text
components/
└── tournament/
    └── animations/
        ├── DartImpactAnimation.tsx
        ├── PlayerReveal.tsx
        ├── PairConfirmed.tsx
        ├── WinnerReveal.tsx
        ├── NextMatchReveal.tsx
        └── TournamentTransition.tsx
```

ただし、

**既存プロジェクトの構造を優先してください。**

無理にディレクトリ構成を変更する必要はありません。

---

# 16. 演出と大会ロジックを分離する

重要です。

以下を混在させない設計を優先してください。

### Tournament Logic

```text
・抽選
・ペア決定
・勝敗
・トーナメント更新
・次試合決定
```

### Presentation / Animation

```text
・ダーツ飛来
・impact
・カード反転
・Pair Confirmed
・Winner
・Next Match
```

大会ロジックの状態がアニメーションの途中で破壊されないようにしてください。

---

# 17. アニメーション中の多重操作対策

以下も確認してください。

アニメーション途中に、

- ボタン連打
- 次へ
- 抽選
- 再実行

などが可能な場合、stateが壊れる可能性があります。

必要に応じて、

```ts
isAnimating
isTransitioning
```

などで操作を一時的にロックしてください。

ただし管理stateを増やしすぎないよう注意してください。

---

# 18. prefers-reduced-motion

既存実装で対応している場合は維持してください。

新規対応が簡単な場合、

`prefers-reduced-motion`

では、

- 激しいshakeを抑える
- particleを減らす
- transition時間を短くする

なども検討してください。

---

# 19. まずCodexに確認してほしい項目

コード変更前に、以下を調査してください。

## A. ペア抽選

- ペア抽選画面のentry point
- 関連component
- player dataの取得方法
- pair dataの保存方法
- card component
- dart component
- impact component
- card flip処理
- タイマー制御
- 次ペアへ進む処理

## B. 穴が残る原因

- impact markがcard component内に固定表示されているのか
- flip後もDOMが残っているのか
- z-index問題なのか
- stateのreset漏れなのか
- animation timelineのcleanup漏れなのか

原因を明示してください。

## C. トーナメント進行

- match終了判定
- winner決定
- bracket更新
- next match決定
- 画面遷移
- 現在transitionが存在するか

を確認してください。

---

# 20. 今回のCodex出力形式

調査後、以下の形式で報告してください。

# 1. 現在の実装構造

対象ファイルを一覧化してください。

例：

```text
app/...
components/...
hooks/...
lib/...
```

各ファイルの役割も簡潔に記載。

---

# 2. 現在の演出フロー

現在どういう順番でstate / animationが進んでいるか説明してください。

```text
START
↓
...
```

---

# 3. 問題の原因

以下をそれぞれ説明。

```text
・穴が残る原因
・切り替えが速すぎる原因
・ペア確定表示がない原因
・試合間演出がない原因
```

---

# 4. 改善後フロー

```text
dart
↓
impact
↓
2sec hold
↓
flip
↓
player reveal
↓
pair confirmed
↓
7sec hold
↓
next pair
```

のように具体化してください。

---

# 5. 変更対象ファイル

以下の形式。

| File | 変更内容 | 影響度 |
|---|---|---|
| xxx.tsx | animation phase追加 | 中 |
| xxx.ts | timing constants追加 | 小 |

---

# 6. 実装PLAN

Phase形式で提示してください。

例：

## Phase 1
既存ペア演出のタイミング修正

## Phase 2
Pair Confirmed演出追加

## Phase 3
試合終了 Winner演出

## Phase 4
Next Match演出

## Phase 5
全体調整・テスト

---

# 7. リスク

特に、

```text
・setTimeout競合
・state race condition
・animation cleanup
・React StrictMode
・コンポーネントunmount
・画面遷移中のtimer
```

などが存在しないか確認してください。

---

# 8. テスト項目

最低限、以下を含めてください。

### Pair Draw

- ダーツが正常に飛ぶ
- impact演出が約2秒確認できる
- カード反転後に穴が消える
- 顔写真に穴が重ならない
- 2人の名前が読める
- Pair Confirmedが表示される
- 約5〜10秒ペアを確認できる
- その後に次ペアへ進む
- 最終ペアで異常動作しない

### Tournament

- 試合終了後にWinner演出
- 勝者が正しく表示
- bracketに結果反映
- Next Matchが正しく表示
- 次試合の2名 / 2チームが正しい
- 最終試合でNext Matchを出さない

---

# 21. 実装方針

最重要方針：

> 「演出を豪華にするために大会ロジックを大きく作り直す」のではなく、
> 現在正常に動いている大会ロジックを維持しながらPresentation Layerを改善する。

優先順位：

```text
1. 正しい大会進行
2. stateの安全性
3. ペアを認識できる時間
4. 演出品質
5. コード整理
```

過剰なリファクタリングは避けてください。

---

# 22. 今回のゴール

今回の調査・PLAN作成によって、

### ダブルス抽選

```text
ダーツが刺さる
↓
余韻
↓
カード反転
↓
プレイヤー表示
↓
ペア確定
↓
ペアを確認
↓
次の抽選
```

### トーナメント進行

```text
試合終了
↓
勝者演出
↓
結果反映
↓
次試合演出
↓
次の試合
```

という「ゲームとして自然な間」を作れる構造にしたいです。

まずコードベースを調査し、現在の構造に最も適した安全な実装PLANを作成してください。

**この時点では調査とPLANを優先し、大規模な実装変更は行わないでください。**
