# Display 演出 — 理想像・現状・修正履歴・未解決分析

最終更新: 2026-07-02  
対象: `/display` の試合確定演出（勝利 → 次試合 VS → 表復帰）

---

## 1. 理想の完成イメージ（ずっと伝えてきた UX）

Speak のような **「一 breath で流れる」** 連続体験。  
遅く感じないが、各場面を **ゆっくり味わえる** 尺。  
顔写真が **消えて再登場しない**（同一主体が途切れない）。

### 1.1 フル演出フロー（2 試合目確定 = advance あり）

```
┌─────────────────────────────────────────────────────────────┐
│ ① WIN 表示                                                  │
│    勝者の顔 + WIN! ポップアップ（約 3.5〜4 秒）              │
│    ↓ dissolve（黒一色にせず、裏のトーナメント表が見え始める）  │
├─────────────────────────────────────────────────────────────┤
│ ② 短い間 + 棒上昇                                           │
│    暗い表の上で、勝者の位置から棒が **上に伸びる**（アニメ）   │
│    表は更新前の状態のまま（到達済みに見えない）               │
│    ↓ 終盤から次幕と重ねる                                    │
├─────────────────────────────────────────────────────────────┤
│ ③ 左右から接近（対戦者はここで初登場）                        │
│    A / B の顔が **左右からゆっくり** 中央へ                   │
│    常時画面に残さない（接近の「動き」が主役）                 │
│    ↓ 接近完了＝衝突タイミング                                 │
├─────────────────────────────────────────────────────────────┤
│ ④ 衝突 + 爆発（1 回）                                       │
│    ぶつかった瞬間に hit_explosion.webm（中央・主役）          │
│    ブラケット接合点は控えめなスパーク程度                     │
│    ↓ 余韻の中で VS がにじむ                                   │
├─────────────────────────────────────────────────────────────┤
│ ⑤ VS ホールド                                               │
│    **同じ対戦者** が中央に残ったまま VS 文字が浮かぶ          │
│    再 scale-in / 再接近 / 再マウント 禁止                     │
│    ↓ 約 3.5 秒ホールド                                       │
├─────────────────────────────────────────────────────────────┤
│ ⑥ 光 + 表復帰（同期）                                       │
│    白フラッシュ + オーバーレイ fade + 表 opacity 1.0         │
│    更新済みブラケットが **同時に** 見える                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 勝利のみ（advance なし）

```
WIN 表示 → dissolve → 表に自然復帰（フル advance なし）
```

### 1.3 トーナメント表 UI（演出以外の理想）

| 項目 | 理想 |
|------|------|
| 縦の棒（ラウンド間隔） | 横幅は維持、**縦方向を半分** に圧縮 |
| チーム表示 | **参加者の顔写真のみ**（枠線・縦書き名前なし） |
| 棒上昇演出 | 勝者確定時点で **未到達**。伸びるアニメが見える |
| 爆発 WebM | 短尺でも OK。衝突の **1 回** が主役 |

### 1.4 UX の判断基準（Speak 的）

- 場面切替は `return null` の **硬い入れ替え** ではなく **クロスフェード**
- 同じ顔が 3 回登場しない
- 爆発・VS・光の **タイミングが因果関係** として理解できる
- 「せわしない」「空白が長い」「順番が逆」は NG

---

## 2. 現状（2026-07-02 時点）

### 2.1 設計上のフロー（コードが意図している順序）

| # | フェーズ | 秒数（目安） | 画面上の主役 |
|---|---------|-------------|-------------|
| 1 | winner | 3.8s | WIN! + 勝者 |
| 2 | winnerDissolve | 0.6s | 勝者 fade → 表が見える |
| 3 | lines | 0.5 + 0.2 + 2.8s | 棒上昇 SVG |
| 4 | clash | 3.0s | 左右接近（TeamPairLayer） |
| 5 | impact | 1.0s | 衝突 + 爆発 WebM |
| 6 | vsHold | 3.5s（衝突終盤 0.6s オーバーラップ） | VS + 対戦者 |
| 7 | bracketReturn | 1.6s | 白フラッシュ + 表復帰 |

合計: 約 **15〜16 秒**（advance あり）

### 2.2 実際のユーザー体験（報告されている症状の変遷）

| 時期 | 症状 |
|------|------|
| 初期 | 顔が一瞬消えて再登場、せわしない、爆発 3 連発 |
| UX 改善後 | 順序は改善方向だが、まだ「空白 → 爆発 → 接近 → VS」の逆転感 |
| 根本原因修正後（animCue） | **ほぼ何も映らず、突然光だけ → VS も消え、表の光る演出も消えた** |

### 2.3 現状アーキテクチャ

```
DisplayPage
  └─ EffectOrchestrator
       ├─ BracketView（displaySnapshot = 凍結 / layoutSnapshot = 最新）
       ├─ LineCollision SVG
       ├─ ExplosionLayer（ブラケット接合点・CSS のみ）
       └─ PresentationStage
            ├─ WinnerLayer
            ├─ TeamPairLayer（clash 以降のみ mount、imperative API）
            └─ ReturnFlashLayer
```

**制御の二重構造（問題の温床）:**

1. **GSAP マスタータイムライン**（`timeline.ts`）→ `setPhase` + `animCue`
2. **TeamPairLayer 内 GSAP**（`playApproach` 等）→ imperative 呼び出し
3. **React 再レンダー**（`lineProgress` 等）→ レイヤー mount/unmount

### 2.4 コード上の既知バグ候補（最新症状「光だけ」）

`PresentationStage.tsx` の `animCue` ハンドラ:

```tsx
useEffect(() => {
  if (animCue === 0 || !layers.teamPairActive) return;  // ← bracketReturn 時は false
  const handle = teamPairRef.current;
  if (!handle) return;  // ← ref 未接続時は **リトライなし**
  // playApproach / playImpact / ...
}, [animCue, layers.teamPairActive, ...]);
```

| 問題 | 結果 |
|------|------|
| `onClashStart` で `animCue++` したが **ref がまだ null** | `playApproach` が一度も走らない → 対戦者 **完全非表示** |
| `onBracketReturn` 時 `teamPairActive === false` | `fadeOut` が **呼ばれない** → オーバーレイが残る/光だけ目立つ |
| `playApproach` 内で `reset()` が `opacity: 0` に戻す | タイミング次第で **一瞬消える** |
| 旧コンポーネント 7 ファイルが repo に残存 | import はされていないが、調査時の混乱要因 |

---

## 3. これまで行った修正作業の一覧

### Phase A — 爆発 WebM 組み込み

| 内容 | ファイル |
|------|---------|
| `hit_explosion.webm` を `/images/` に配置 | `public/images/hit_explosion.webm` |
| プリロード対象に追加 | `src/lib/media.ts` |
| `ExplosionVideo` コンポーネント新規 | `src/features/presentation/ExplosionVideo.tsx` |
| Clash / FlameBurst / ExplosionLayer に組み込み | 当時の各 Popup |

### Phase B — UX スムーズ化（PresentationStage 再設計）

| 内容 | ファイル |
|------|---------|
| フェーズモデル整理（winnerDissolve, impactAfterglow 等） | `deriveLayerState.ts`, `useMatchEffect.ts` |
| `PresentationStage` 単一舞台 | `PresentationStage.tsx` |
| `WinnerLayer`（旧 WinnerCelebratePopup 置換） | `WinnerLayer.tsx` |
| `TeamPairLayer`（旧 ClashPopup + VsScreen 統合） | `TeamPairLayer.tsx` |
| `FlameVsLayer`, `ReturnFlashLayer` | 各新規ファイル |
| 秒数変更（WIN 3.8s, dissolve 等） | `effectConstants.ts`, `timeline.ts` |
| 旧 Popup 5 件削除（のちに repo に残骸として復活？） | ClashPopup, VsScreen 等 |

### Phase C — ユーザー追加要望（5 点）

| # | 要望 | 対応内容 | ファイル |
|---|------|---------|---------|
| ① | 接近時のみ表示、常時表示 NG | `teamPairVisible` を clash/impact/vsHold のみに | `deriveLayerState.ts` |
| ② | 爆発時間 2 倍 | collisionFlash 1.0s, afterglow 1.6s | `effectConstants.ts` |
| ③ | 最終光 2 倍 | bracketReturn 1.6s | `ReturnFlashLayer.tsx` |
| ④ | 棒上昇が動かない | snapshot 凍結（reload 前）、highlight 抑制、起点を box 下端に | `DisplayPage.tsx`, `resolveEffectLayout.ts`, `BracketView.tsx` |
| ⑤ | 縦棒半分・顔のみ・枠削除 | roundGap 26, boxH 72, facesOnly | `layout.ts`, `BracketView.tsx` |

### Phase D — タイミング順序修正

| 内容 | ファイル |
|------|---------|
| impactAfterglow / flameVs フェーズ削除 | `timeline.ts`, `deriveLayerState.ts` |
| 爆発を impact のみに | `deriveLayerState.ts` |
| VS を衝突終盤から重ね | `timeline.ts` |

### Phase E — 接近アニメ未実行バグ修正（最新）

| 内容 | ファイル |
|------|---------|
| **原因**: WIN 中に mount → 非表示のうち approach 完了 | 調査 |
| TeamPairLayer を clash 以降のみ mount | `deriveLayerState.ts` |
| imperative API（playApproach 等） | `TeamPairLayer.tsx` |
| animCue + ref 経由で mount 後に実行 | `useMatchEffect.ts`, `PresentationStage.tsx` |
| 移動量を vw に変更 | `TeamPairLayer.tsx` |

**→ この Phase E 以降、「光だけ」症状に悪化**

---

## 4. 修正が安定しない原因分析

### 4.1 構造的原因（根本）

```
┌──────────────────┐     ┌──────────────────┐
│ GSAP Timeline    │     │ React State      │
│ (時間の真実)     │ ──► │ (画面の真実)     │
└──────────────────┘     └──────────────────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
           ┌──────────────────┐
           │ TeamPairLayer    │
           │ GSAP (3本目)     │
           └──────────────────┘
```

**3 つの時間軸が非同期** のため、秒数を直しても「見た目の順序」が保証されない。

| 層 | 問題 |
|----|------|
| React phase | `setState` は非同期。タイムライン callback と DOM がずれる |
| mount 条件 | phase 変化 → mount → ref 接続 → effect の **1 フレーム遅延** |
| GSAP × React | `lineProgress` 更新で毎フレーム re-render（clash 中も overlap 時） |
| imperative ref | ref null 時 **リトライなし** → approach 永久スキップ |

### 4.2 症状別の因果

| 症状 | 最も有力な原因 |
|------|---------------|
| NEXT MATCH だけ見えて顔が出ない | approach が WIN/lines 中に先行実行済み（Phase E 前） |
| 空白 → 爆発 → 接近 → VS | afterglow/flameVs 中は teamPair 非表示 + 爆発のみ（Phase D 前） |
| 棒が最初から到達済み | reload 後 snapshot 表示 + connector highlight（Phase C-④ で部分修正） |
| 光だけ表示 | animCue + ref  race + bracketReturn 時 teamPairActive false |
| VS シーン消失 | playApproach 未実行 → playImpact/playVs も意味なし / mount 直後 reset |

### 4.3 パッチ累積による技術的負債

| 項目 | 状態 |
|------|------|
| 旧 Popup 7 ファイル | repo に残存、未 import（混乱要因） |
| `FlameVsLayer`, `ImpactAfterglowLayer` | 未使用だがファイル存在 |
| フェーズ名の変更履歴 | winnerClosing → winnerDissolve → … テストと実装の乖離リスク |
| DisplayPage snapshot 二重管理 | displaySnapshot / layoutSnapshot — 整合性デバッグが難しい |

### 4.4 なぜ「秒数調整」だけでは直らないか

理想フローは **因果順序** の問題:

```
接近完了 → 爆発 → VS → 光
```

現実装は **phase フラグ** の問題:

```
phase === 'impact' → 爆発 ON
phase === 'clash'  → 接近 ON
```

この 2 つが **別コンポーネント・別 GSAP・別 effect** で動くため、  
秒数を合わせても **「接近アニメが実際に走ったか」** は保証されない。

---

## 5. 関わるファイル一覧

### 5.1 現行パイプライン（使用中）

| ファイル | 役割 |
|---------|------|
| `src/routes/DisplayPage.tsx` | 演出トリガ、snapshot 凍結 |
| `src/features/presentation/EffectOrchestrator.tsx` | 統合オーケストレータ |
| `src/features/presentation/useMatchEffect.ts` | フェーズ + タイムライン + animCue |
| `src/features/presentation/timeline.ts` | GSAP マスタータイムライン |
| `src/features/presentation/effectConstants.ts` | 秒数定義 |
| `src/features/presentation/deriveLayerState.ts` | phase → レイヤー導出 |
| `src/features/presentation/PresentationStage.tsx` | オーバーレイ統合 |
| `src/features/presentation/WinnerLayer.tsx` | WIN 表示 |
| `src/features/presentation/TeamPairLayer.tsx` | 接近・衝突・VS |
| `src/features/presentation/ReturnFlashLayer.tsx` | 白フラッシュ |
| `src/features/presentation/ExplosionVideo.tsx` | WebM 爆発 |
| `src/features/presentation/ExplosionLayer.tsx` | ブラケット火花 |
| `src/features/presentation/LineCollision.tsx` | 棒上昇 SVG |
| `src/features/presentation/resolveEffectLayout.ts` | 棒の座標 |
| `src/features/presentation/advanceEffect.ts` | 2 試合目判定 |
| `src/features/presentation/TeamShowcase.tsx` | 顔 UI |
| `src/features/presentation/preloadPresentation.ts` | プリロード |
| `src/lib/media.ts` | 素材 URL |
| `src/features/bracket/BracketView.tsx` | トーナメント表 |
| `src/features/bracket/layout.ts` | レイアウト定数 |
| `src/index.css` | effect-* CSS |

### 5.2 未使用（repo に残存）

- `ClashPopup.tsx`
- `VsScreen.tsx`
- `FlameBurstOverlay.tsx`
- `WinnerCelebratePopup.tsx`
- `VsAnticipationOverlay.tsx`
- `FlameVsLayer.tsx`
- `ImpactAfterglowLayer.tsx`

---

## 6. 推奨する次の一手（参考）

パッチを重ねるより **1 本の GSAP タイムラインに DOM アニメを統合** する方が確実。

### 方針案

1. **Single Timeline Controller**  
   `timeline.ts` 内で Winner / TeamPair / Explosion / Flash の DOM ref を直接 tween  
   React state は **ラベル表示用のみ**（phase は debug 用）

2. **TeamPairLayer は常時 mount**（opacity 0 待機）  
   mount/unmount をやめ、ref race を根絶

3. **animCue パターン廃止**  
   callback → 直接 `tl.to(leftRef, { x: 0, duration: 3 })`

4. **旧ファイル 7 件削除**  
   調査ノイズ除去

5. **E2E 手動チェックリスト**（リハーサル）  
   - [ ] WIN 3.8s 見える  
   - [ ] 棒が下から伸びる（到達済みでない）  
   - [ ] 顔が左右から 3s かけて見える  
   - [ ] 中央合流と同時に爆発  
   - [ ] VS が同じ顔の上に浮かぶ  
   - [ ] 光と同時に表復帰  

---

## 7. まとめ

| | 理想 | 現状 |
|---|------|------|
| 流れ | 接近 → 爆発 → VS → 光 | コード上は正しい順だが **実行が担保されていない** |
| 顔写真 | 1 インスタンスで連続 | mount/ref/animCue の race で **非表示のまま** になりうる |
| 棒上昇 | アニメで伸びる | 凍結 snapshot で **部分改善**、環境により未確認 |
| 表 UI | コンパクト・顔のみ | **反映済み**（layout.ts / BracketView.tsx） |
| 安定性 | 毎回同じ | **パッチ累積 + 3 層 GSAP** で退行を繰り返している |

**修正が安定しない最大の理由:**  
「秒数と phase フラグ」は直しているが、**「アニメーションが DOM 上で実際に走ったか」** を保証する単一の制御点がないこと。

---

*このドキュメントは Display 演出の設計・デバッグ用。実装変更時は本ファイルも更新すること。*
