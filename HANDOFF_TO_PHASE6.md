# Phase 5 → Phase 6 引継ぎ書

> Phase 5 完了時点の状態・Phase 6 の前提をまとめる。

---

## Phase 5 完了内容

### 実装済み

| 項目 | パス |
|---|---|
| 演出尺・イージング定数 | `src/features/presentation/effectConstants.ts` |
| 座標解決（layout 駆動） | `src/features/presentation/resolveEffectLayout.ts` |
| GSAP タイムライン | `src/features/presentation/timeline.ts` |
| 線伸長 + 衝突フラッシュ | `src/features/presentation/LineCollision.tsx` |
| 爆発レイヤー（CSS フォールバック） | `src/features/presentation/ExplosionLayer.tsx` |
| 全画面 VS | `src/features/presentation/VsScreen.tsx` |
| 演出オーケストレーション | `src/features/presentation/EffectOrchestrator.tsx` |
| 演出状態フック | `src/features/presentation/useMatchEffect.ts` |
| 素材プリロード | `src/features/presentation/preloadPresentation.ts` |
| 動画プリロード拡張 | `src/lib/media.ts` — `preloadVideo`, `preloadVideosOptional` |
| Display 統合 | `src/routes/DisplayPage.tsx` |
| CSS アニメ（shake / flash / explosion） | `src/index.css` |
| Vitest | `src/features/presentation/timeline.test.ts`（3 tests） |

### 依存パッケージ

```bash
npm i gsap pixi.js lottie-web  # 導入済み。現状 GSAP + CSS で演出実装
```

### Done チェックリスト

- [x] 線伸長 → 衝突 → 爆発 → 全画面 VS（合計 ≈ 4.5s、`effectConstants.ts` で調整可）
- [x] Admin「演出スキップ」→ `effect:skip` → timeline `totalProgress(1)` で即終了
- [x] 演出は表示のみ（Phase 3 で DB 更新済み）。失敗時も BracketView 継続
- [x] 顔写真 + 任意 WebM をプリロード後に演出開始

---

## 演出フロー

```
Admin 勝敗確定
  → progressionApi: DB 更新 + broadcast match:confirmed
Display 受信
  → ensurePresentationPreloaded（顔 + 任意 WebM）
  → resolveMatchEffectLayout（slot.center のみ参照）
  → buildMatchTimeline（dim → lines → flash → explosion → vs → close）
  → 完了後 bracket:updated 分の reload を実行
```

Realtime イベント:

| イベント | 方向 | 用途 |
|---|---|---|
| `match:confirmed` | Admin → Display | 演出開始 |
| `effect:skip` | Admin → Display | 演出スキップ |
| `bracket:updated` | Admin → Display | 表更新（演出中は延期） |

---

## 座標・レイアウト（維持すること）

- 真実源: `computeBracketLayout` の `MatchLayout.center` / `SlotLayout.center`
- `resolveEffectLayout.ts` が viewBox → パーセント変換
- **座標ハードコード禁止**（Phase 4 の下→上レイアウト変更にも追従）

---

## 未配置素材（任意・Phase 6 で対応可）

| ファイル | 状態 |
|---|---|
| `src/assets/bg_main.webm` | 未配置 → 背景は CSS 減光のみ |
| `src/assets/explosion_alpha.webm` | 未配置 → `ExplosionLayer` は CSS バースト |
| `src/assets/placeholder_face.svg` | 配置済み（Phase 4） |

WebM 配置後は `preloadPresentation.ts` が自動で読み込む。

---

## Phase 6 で実装すること

- プリロード本格化（`MediaPreloader` クラス）
- `/rehearsal` リハーサルモード
- Realtime 切断 → 自動復帰
- キオスク手順書（`docs/KIOSK_SETUP.md`）
- 肖像データ削除導線
- Vercel デプロイ + 本番リハ

詳細: [phase6.md](./phase6.md)

---

## やらないこと（Phase 6 でも）

- 進行ロジック変更
- 3D フル演出
- 抽選演出（将来拡張）

---

## 次フェーズ開始

[START_PHASE6.md](./START_PHASE6.md) を Cursor に貼り付ける。
