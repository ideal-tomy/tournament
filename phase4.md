# Phase 4 — 静的トーナメント表示の作り込み

> **見積もり:** 1〜2 日  
> **前提:** [phase3.md](./phase3.md) Done  
> **参照:** `02_DESIGN_REQUIREMENTS.md` §5・§10、`layout.ts` の drop TODO

---

## ゴール（Done の定義）

- [ ] 表示端末で **進行状況が一目で分かる**静的トーナメント表が完成
- [ ] WB / LB / GF が配色 + ラベルで明確に区別される
- [ ] 現在進行ノードがハイライト（パルス/点滅）
- [ ] 確定済み勝ち上がり経路が視覚的に区別される
- [ ] 名前が長い・3 名チーム・BYE でもレイアウトが崩れない

---

## タスク一覧

### 4.1 デザイントーン確定

`02_DESIGN` §2: A 案（レッド×ブラック）or B 案（シアン×マゼンタ）を **1 つに固定**。

`src/styles/bracketTheme.ts`（新規）:

```ts
export const bracketTheme = {
  wb: { stroke: '...', glow: '...', label: 'WINNERS' },
  lb: { stroke: '...', glow: '...', label: 'LOSERS' },
  gf: { stroke: '...', glow: '...', label: 'GRAND FINAL' },
  current: { pulse: '...' },
  completed: { stroke: '...', opacity: 0.8 },
};
```

### 4.2 BracketView ビジュアル強化

| 要素 | 実装 |
|---|---|
| コネクタ線 | 発光（SVG filter: feGaussianBlur + stroke） |
| WB/LB/GF | `data-bracket` に応じた色 |
| 確定経路 | 勝者側の線を明るく / 太く |
| 現在試合 | `current_match_id` の match をパルス CSS/SVG animate |
| ノード | 顔 2 枚横並び + 名前（影/縁取りで可読性） |
| BYE | プレースホルダ `placeholder_face.png` |

### 4.3 drop コネクタ（WB → LB 落下線）

`layout.ts` TODO を実装:

- brackets-manager の match 構造から WB 敗者 → LB 試合の対応を導出
- `Connector.kind: 'drop'` を追加描画
- 表示上の装飾（進行ロジックには影響しない）

### 4.4 3 名チーム対応

- スロット内で顔 3 枚を縮小横並び
- 名前は短縮 or 2 行表示（`truncate` + title 属性）

### 4.5 DisplayPage レイアウト

- ダーク背景（`02_DESIGN` §2）
- トーナメント表を viewport にフィット（SVG `preserveAspectRatio`）
- 1080p 想定の `viewBox` スケーリング確認

### 4.6 Admin 俯瞰 UI（軽量）

- 残り試合数 / 現在ラウンド
- ミニ BracketView or テキストサマリ

### 4.7 レイアウトテスト追加

- drop コネクタが存在するケース
- テーマ定数が BracketView に渡されること（スナップショットテスト任意）

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/styles/bracketTheme.ts` | 新規 |
| `src/features/bracket/layout.ts` | drop コネクタ |
| `src/features/bracket/layout.test.ts` | drop テスト追加 |
| `src/features/bracket/BracketView.tsx` | ビジュアル強化 |
| `src/assets/placeholder_face.png` | 新規 |
| `src/routes/DisplayPage.tsx` | 背景・レイアウト |
| `src/index.css` | パルスアニメ等 |

---

## 検証手順

1. `/display` で WB（寒色）/ LB（暖色）/ GF（特別色）が区別できる
2. 試合進行中、現在 match がパルス表示
3. 勝ち上がり済みの線が明るく表示
4. 7 名（3 名チーム）でも崩れない
5. 1080p 画面で全体が見渡せる

---

## やらないこと

- GSAP タイムライン（Phase 5）
- 背景動画ループ（Phase 5）
- サウンド（任意・Phase 5–6）

---

## 次フェーズ

Done 完了後 → [phase5.md](./phase5.md)
