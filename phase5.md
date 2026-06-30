# Phase 5 — 演出レイヤー

> **見積もり:** 3〜4 日  
> **前提:** [phase3.md](./phase3.md) Done、[phase4.md](./phase4.md) 推奨  
> **参照:** `01_TECH_REQUIREMENTS.md` §6–7、`02_DESIGN_REQUIREMENTS.md` §6–8、`03_CURSOR_PROJECT_RULES.md` §1–3

---

## ゴール（Done の定義）

- [x] 試合確定で **線伸長 → 衝突 → 爆発 → 全画面 VS** が座標駆動で再生される
- [x] 合計 4〜7 秒（定数で調整可能）
- [x] **スキップ**で最終状態に即遷移できる
- [x] 演出失敗しても進行データは壊れない
- [x] 全素材はプリロード後に再生

---

## タスク一覧

### 5.1 依存パッケージ

```bash
npm i gsap pixi.js lottie-web
```

### 5.2 フォルダ構成

```
src/features/presentation/
  EffectOrchestrator.tsx   # 演出の親。DisplayPage から mount
  useMatchEffect.ts        # match:confirmed → タイムライン起動
  timeline.ts              # GSAP timeline 定義
  LineCollision.tsx        # SVG 線伸長 + 衝突
  ExplosionLayer.tsx       # WebM or PixiJS
  VsScreen.tsx             # 全画面 VS
  effectConstants.ts       # 尺・イージング（02_DESIGN §6）
src/assets/
  bg_main.webm
  explosion_alpha.webm
  vs_template.*            # 背景モーション（任意）
  placeholder_face.png
```

### 5.3 演出定数 (`effectConstants.ts`)

`02_DESIGN` §6:

| ステップ | 目安 |
|---|---|
| フォーカス/減光 | 0.4s |
| 線伸長 | 0.6s |
| 衝突フラッシュ | 0.1s |
| 爆発 | 0.8s |
| VS 表示 | 2.0s〜 |
| クローズ | 0.6s |

### 5.4 GSAP タイムライン (`timeline.ts`)

```ts
export function buildMatchTimeline(params: {
  fromA: Point; fromB: Point; collision: Point;
  onExplosion: () => void;
  onVsShow: () => void;
  onComplete: () => void;
}): gsap.core.Timeline
```

- `timeline.totalProgress(1)` でスキップ
- 座標は **すべて** `computeBracketLayout` の `slot.center` から取得

### 5.5 線衝突 (`LineCollision.tsx`)

- 2 スロット中心 → 中央へ SVG line を GSAP で伸長
- 衝突: 白フラッシュ + 軽い screen shake（CSS transform）
- z-index: トーナメント表の上（`01_TECH` §6 レイヤー 3）

### 5.6 爆発 (`ExplosionLayer.tsx`)

第 1 候補: アルファ WebM（VP9）を衝突点に `<video>` 配置  
第 2 候補: PixiJS パーティクル

- **プリロード必須**（`lib/media.ts` 拡張）
- 未ロード時は演出を開始しない

### 5.7 VS 画面 (`VsScreen.tsx`)

`02_DESIGN` §7:

- 中央巨大「VS」
- 左右: 顔 2 枚 + 名前 + チーム名
- 上部: 「WINNERS BRACKET」「GRAND FINAL」等
- 実行時差し込み（テンプレ素体 + データ）
- GSAP: スライドイン + VS「ドン」

顔解決: `winnerTeamId` / `loserTeamId` → `buildFaceUrlMap`

### 5.8 EffectOrchestrator

DisplayPage 内:

```
レイヤー 0: 背景動画（ループ、VS 中は停止/減光）
レイヤー 1: BracketView
レイヤー 2–5: 演出コンポーネント
```

フロー:

1. `match:confirmed` 受信
2. layout から該当 match の slot centers 取得
3. プリロード確認
4. timeline 開始
5. 完了 → BracketView に復帰

### 5.9 スキップ

- Admin: 「演出スキップ」→ `broadcast({ type: 'effect:skip' })`
- Display: timeline を `totalProgress(1)` + 即クローズ

### 5.10 状態更新との分離

- 勝敗確定は Phase 3 で **既に DB 更新済み**
- 演出は **表示のみ**。演出中に DB を書かない
- 演出失敗 → ログ + BracketView 表示継続

### 5.11 サウンド（任意）

- SE プリロード + timeline 同期
- 無音でも成立（必須化しない）

### 5.12 Admin 連携

- 勝敗確定後、演出中は次操作をブロック or 警告（誤操作防止）
- 「演出スキップ」ボタン

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/features/presentation/*` | 新規一式 |
| `src/lib/media.ts` | 動画・画像プリロード拡張 |
| `src/routes/DisplayPage.tsx` | EffectOrchestrator 統合 |
| `src/routes/AdminPage.tsx` | スキップボタン |
| `src/assets/*` | 演出素材 |

---

## 検証手順

1. 試合確定 → Display で一連の演出が再生
2. 衝突点が 2 スロットの幾何学的中央付近（座標駆動確認）
3. VS に正しい顔・名前
4. スキップ → 即 VS 終了状態 → 表に復帰
5. 演出中に Admin リロード → 進行状態は維持
6. Network  throttling 下でも未プリロード再生が起きない
7. Chrome 1080p で 30fps 以上（Performance タブ確認）

---

## やらないこと

- キオスク設定・本番リハ（Phase 6）
- 抽選演出（任意・Phase 6 or 将来）
- 3D フル演出（スコープ外）

---

## 次フェーズ

Done 完了後 → [phase6.md](./phase6.md)
