# Codex指示書：勝者演出 → NEXT MATCH → 手動試合開始フローの実装

## 目的

現在のトーナメント進行演出を改善し、

**試合終了 → 勝者演出 → 次の対戦カード表示 → 手動で試合開始**

というゲームらしい進行フローにしてください。

今回の重要ポイントは、**次の試合そのものは自動開始しないこと**です。

前試合の勝敗確定後、次の対戦カードまでは自動で表示し、運営者が内容を確認したうえで「試合開始」ボタンを押して次の試合へ進む仕様にしてください。

---

# 1. 現在の課題

- 勝者側が暗く見えてしまい、勝者が目立たない
- 紙吹雪 / パーティクルが途中で止まり、静止画のように見える
- 勝敗確定後に次の対戦カードへ自然に進む演出がない
- 次試合を確認する中間画面がない
- 大会進行と演出の切り替えが十分に整理されていない

---

# 2. 最終的に実現したい進行フロー

```text
試合中
↓
勝敗確定
↓
WINNER演出
↓
勝者を4〜6秒程度表示
↓
自動トランジション
↓
NEXT MATCH表示
↓
次の対戦チーム / プレイヤーを表示
↓
この画面で停止
↓
運営者が「試合開始」ボタンを押す
↓
次の試合画面へ
↓
試合開始
```

重要：

```text
WINNER → NEXT MATCH
```

までは自動。

```text
NEXT MATCH → 実際の試合開始
```

は必ず手動。

---

# 3. 勝者演出

## Must

勝敗確定後、勝者を明確に認識できる画面にしてください。

### 勝者側

- 明るく表示
- opacity: 1
- brightnessを上げる
- saturationを少し上げてもよい
- 名前を明確に表示
- WIN / WINNER表示
- 前面に表示

例：

```css
filter: brightness(1.15) saturate(1.1);
opacity: 1;
```

値は既存デザインに合わせて調整してください。

### 敗者側

勝者との視覚的な差を明確にしてください。

```css
filter: brightness(0.45) grayscale(0.3);
opacity: 0.4;
```

ただし完全に見えなくする必要はありません。

---

# 4. 紙吹雪・背景エフェクト

勝者表示中に演出が完全停止しないようにしてください。

基本ルール：

**主役は読みやすく静止させ、周辺演出だけ継続して動かす。**

### 静止またはほぼ静止

- 勝者写真
- プレイヤー名
- チーム名
- WINNER文字

### 継続して動かす

- 紙吹雪
- パーティクル
- 星 / Spark
- 背景ライト
- 小さなglow
- 光の流れ

---

# 5. 紙吹雪のループ

現在、紙吹雪が途中で止まっている場合は原因を調査してください。

以下を確認してください。

```text
・CSS animation-fill-mode
・animation iteration count
・GSAP repeat設定
・コンポーネントmount後にanimationが終了していないか
・phase切替時にtimelineがkillされていないか
・背景画像1枚を静止表示しているだけではないか
```

紙吹雪はWINNER画面の表示中、継続して動いている状態にしてください。

既存実装方式を優先し、必要ならGSAP等で `repeat: -1` を利用してください。

---

# 6. 過剰に動かさない

```text
写真・名前
→ 静止

WINNER
→ ごく弱いpulse

紙吹雪
→ 常時落下 / 回転

Spark
→ opacity変化

背景ライト
→ 非常にゆっくり移動

画面切替
→ 大きなtransition
```

ゲーム演出として「常に何か少し動いている」状態を作りつつ、プレイヤー名や勝者情報の可読性を最優先してください。

---

# 7. WINNER表示時間

勝者確定直後に次画面へ飛ばさないでください。

初期値の目安：

```ts
const TOURNAMENT_PRESENTATION_TIMING = {
  winnerReveal: 1000,
  winnerHold: 5000,
  winnerExit: 800,
  nextMatchReveal: 1000,
}
```

合計5〜7秒程度。

可能であればtiming constantsとして一元管理してください。

---

# 8. WINNER → NEXT MATCHは自動

勝者表示時間が終了したら、自動的に次の試合を取得し、

```text
WINNER
↓
fade / transition
↓
NEXT MATCH
```

へ進んでください。

運営者が毎回「次へ」を押す必要はありません。

---

# 9. NEXT MATCH画面

次の試合が存在する場合、中間演出画面を表示してください。

```text
          NEXT MATCH

PLAYER / TEAM A

       VS

PLAYER / TEAM B
```

ダブルスの場合：

```text
PLAYER A1 + PLAYER A2

         VS

PLAYER B1 + PLAYER B2
```

---

# 10. NEXT MATCH画面で表示するもの

最低限：

- NEXT MATCH
- Round情報
- Match番号
- 左側チーム
- 右側チーム
- プレイヤー写真
- プレイヤー名
- VS
- 「試合開始」ボタン

既存データに存在する場合、Seed / Team番号 / Rating / 所属などを追加しても構いませんが、情報過多にしないでください。

---

# 11. NEXT MATCHは自動で消さない

重要仕様です。

**運営者が「試合開始」ボタンを押すまで表示し続けてください。**

```text
NEXT MATCH
↓
waiting
↓
START MATCH button
```

という状態が必要です。

---

# 12. 「試合開始」ボタン

NEXT MATCH画面に明確なPrimary CTAを用意してください。

例：

```text
試合開始
START MATCH
```

このボタンを押した時だけ、

```text
NEXT MATCH
↓
transition
↓
match screen
```

へ進んでください。

---

# 13. ボタン連打対策

「試合開始」を連打しても二重遷移しないようにしてください。

例：

```ts
isStartingMatch
```

または現在のstate管理方式に合わせたlockを使用。

押下後は、button disabled → transition → match start としてください。

---

# 14. 推奨Presentation Phase

現在の実装を確認した上で、必要であれば以下のような状態管理を検討してください。

```ts
type TournamentPresentationPhase =
  | "match"
  | "winnerReveal"
  | "winnerHold"
  | "winnerExit"
  | "nextMatchReveal"
  | "nextMatchWaiting"
  | "startingMatch";
```

ただし、既存実装が単純で安全に変更できる場合は、無理に大規模なState Machineへリファクタリングしないでください。

---

# 15. 大会ロジックと演出を分離

## Tournament Logic

```text
・試合終了
・勝者決定
・Bracket更新
・次試合決定
・Round進行
```

## Presentation

```text
・WINNER表示
・紙吹雪
・fade
・NEXT MATCH
・VS
・試合開始transition
```

演出のために大会ロジックを書き換えすぎないでください。

---

# 16. Bracket更新タイミング

現在のBracket更新処理を確認してください。

基本的には、

```text
試合終了
↓
winner確定
↓
Bracketへ結果保存
↓
WINNER演出
↓
next match resolve
↓
NEXT MATCH
```

が安全です。

ただし現在のアーキテクチャにより、より適切なタイミングがある場合は理由を説明してください。

重要なのはNEXT MATCHに表示される対戦相手が確定済みの正しいデータであることです。

---

# 17. 次試合が存在しない場合

決勝戦などで次試合が存在しないケースを必ず考慮してください。

```text
FINAL終了
↓
WINNER
↓
CHAMPION
```

とし、NEXT MATCHを表示しないでください。

CHAMPION演出がまだ実装されていない場合は、今回無理に作り込まず、既存終了画面へ安全に遷移してください。

---

# 18. 自動進行と手動進行の境界

## 自動

```text
試合終了
↓
勝者判定
↓
WINNER演出
↓
Bracket更新
↓
NEXT MATCH表示
```

## 手動

```text
NEXT MATCH
↓
「試合開始」押下
↓
次試合開始
```

この境界を崩さないでください。

---

# 19. 現在コードの調査項目

実装前に以下を確認してください。

```text
・match終了処理
・winner state
・currentMatch
・nextMatch
・Bracket更新処理
・現在の画面遷移
・WINNER component
・confetti component
・particle animation
・setTimeout
・GSAP timeline
・CSS animation
・画面unmount時のcleanup
```

特に、**紙吹雪が止まる原因**を特定してから修正してください。

---

# 20. 実装前の報告

変更前に簡潔に以下を整理してください。

## 現状

```text
試合終了
↓
現在何が起きているか
```

## 原因

```text
・勝者が暗い原因
・紙吹雪が止まる原因
・次試合へ自動遷移できない原因
```

## 変更対象

| File | 内容 |
|---|---|
| xxx | WINNER表示 |
| xxx | animation |
| xxx | tournament progression |

その後、実装に進んでください。

---

# 21. 推奨実装Phase

## Phase 1：Winner表示改善

- 勝者を明るく
- 敗者を暗く
- 名前の可読性改善
- WINNER表示調整

## Phase 2：継続エフェクト

- 紙吹雪ループ
- Spark
- Background motion
- cleanup確認

## Phase 3：自動NEXT MATCH遷移

- winnerHold追加
- nextMatch resolve
- 自動transition

## Phase 4：NEXT MATCH画面

- 対戦カード
- 写真
- 名前
- VS
- Round / Match情報

## Phase 5：手動START MATCH

- 試合開始ボタン
- 二重押下防止
- 試合画面へのtransition

## Phase 6：テスト

- 通常試合
- Round切替
- 準決勝
- 決勝
- nextMatchなし
- button連打
- animation cleanup

---

# 22. テスト要件

## Winner

- 勝者が明るく表示される
- 敗者との違いが一目で分かる
- 名前が読める
- 紙吹雪が表示中ずっと動く
- Spark / 背景が不自然に停止しない
- 5秒前後勝者を確認できる

## Transition

- WINNER終了後に自動でNEXT MATCHへ進む
- 不自然な一瞬の空白がない
- 前試合のデータが残らない

## Next Match

- 正しい2チームが表示
- 写真と名前が正しい
- Round / Match情報が正しい
- 自動的に試合開始しない
- 何分放置してもNEXT MATCH画面に留まる

## Start Match

- 「試合開始」を押した時のみ進行
- 連打で二重開始しない
- 正しいmatch idが開始される
- 前試合のanimation / timerが残らない

## Final

- 次試合が存在しない場合NEXT MATCHを出さない
- 大会終了処理が壊れない

---

# 23. UX方針

今回の演出では、

> 主役は静かに見せ、周辺だけ動かす

ことを基本とします。

```text
プレイヤー写真
名前
対戦情報
↓
読みやすさ優先

紙吹雪
光
Spark
背景
↓
継続的なmotion
```

画面全体を常時激しく動かす必要はありません。

「静止画が表示されている」のではなく、**ゲーム画面が待機しているように見える程度のmotion**を目指してください。

---

# 24. 最終ゴール

```text
MATCH
↓
試合終了
↓
WINNER
（勝者を明るく表示）
（紙吹雪・背景は動き続ける）
↓
約5秒
↓
自動transition
↓
NEXT MATCH

TEAM A
VS
TEAM B

↓
この状態で待機
背景・光などは軽く動き続ける
↓
運営者
「試合開始」
↓
transition
↓
MATCH
```

**次の対戦カードまでは自動進行、試合開始だけ手動。**

この仕様を最優先してください。
