# Phase 4 → Phase 5 引継ぎ書

> Phase 4 完了時点の状態・Phase 5 の前提をまとめる。

---

## Phase 4 完了内容

### 実装済み

| 項目 | パス |
|---|---|
| テーマ定数（B案: シアン×マゼンタ） | `src/styles/bracketTheme.ts` |
| BracketView ビジュアル強化 | `src/features/bracket/BracketView.tsx` |
| drop コネクタ（WB→LB） | `src/features/bracket/layout.ts` |
| 確定経路ハイライト | `layout.ts` — `isConnectorHighlighted` |
| 現在試合パルス | `index.css` — `.bracket-match-current` |
| プレースホルダ顔 | `src/assets/placeholder_face.svg` |
| Display 1080p フィット | `src/routes/DisplayPage.tsx` |
| current_match_id 連動 | `useBracketDisplay` + BracketView |
| Admin 俯瞰 | `MatchControl.tsx` — compact BracketView |
| Vitest | drop コネクタ + theme テスト |

### Done チェックリスト

- [x] WB/LB/GF 配色 + ラベル（WINNERS / LOSERS / GRAND FINAL）
- [x] 現在進行ノードのパルスハイライト
- [x] 確定済み advance/drop 線の輝度・太さ変化
- [x] 3 名チーム・長い名前・BYE 対応
- [x] Display ダーク背景 + viewport フィット

---

## 座標・演出の接続点（Phase 5 用）

BracketView の各ノードに以下の data 属性が付与済み:

```html
<g data-match-id="..." data-bracket="winner|loser|grand_final"
   data-center-x="..." data-center-y="...">
  <g data-slot="0|1" data-center-x="..." data-center-y="...">
```

`computeBracketLayout` の戻り値 `MatchLayout.center` / `SlotLayout.center` が真実源。
Phase 5 の GSAP 演出は **この座標のみ** を参照すること。

Realtime トリガ:

- `match:confirmed` — 演出開始（Phase 3 で payload 定義済み）
- `effect:skip` — 演出スキップ
- `bracket:updated` — 静的表更新（演出完了後に Display が reload）

---

## Phase 5 で実装すること

```
src/features/presentation/
  effectConstants.ts
  preloadPresentation.ts
  MatchEffectTimeline.tsx   # GSAP
  VsScreen.tsx
```

- 線伸長 → 衝突 → 爆発 → 全画面 VS（4〜7 秒）
- 素材プリロード必須
- 演出失敗しても進行データは壊さない（Phase 3 で分離済み）

詳細: [phase5.md](./phase5.md)

---

## やらないこと（Phase 5 でも）

- 進行ロジック変更
- 座標ハードコード

---

## 次フェーズ開始

[START_PHASE5.md](./START_PHASE5.md) を Cursor に貼り付ける。
