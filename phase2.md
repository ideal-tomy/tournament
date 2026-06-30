# Phase 2 — 抽選・ブラケット生成・静的トーナメント表

> **見積もり:** 2〜3 日  
> **前提:** [phase1.md](./phase1.md) Done（参加者 4 名以上でテスト推奨）  
> **参照:** `INSTRUCTIONS.md` §10–11、`layout.ts`、`01_TECH_REQUIREMENTS.md` §4–5

---

## ゴール（Done の定義）

- [x] 「抽選」でランダムペアが組まれ、奇数も `odd_strategy` どおり処理される
- [x] ダブルイリミのブラケットが生成され `bracket_snapshot` に保存される
- [x] `computeBracketLayout` が WB/LB/GF を含む座標を返す（**Vitest 単体テスト**）
- [x] `/display` に顔写真付きの **静的**トーナメント表（演出ナシ）が描画される
- [x] 表示端末リロードで `bracket_snapshot` から同じ表が復元される

---

## タスク一覧

### 2.1 依存パッケージ

```bash
npm i brackets-manager brackets-memory-db
```

> ⚠ 導入後 `package.json` のバージョンを固定。API は README で確認（`create.stage` / `get.stageData`）。

### 2.2 抽選ロジック (`draw/draw.ts`)

`INSTRUCTIONS.md` §10.1:

```ts
export type DrawStrategy = 'trio' | 'bye';
export function makeTeams(participantIds: string[], strategy?: DrawStrategy): string[][]
```

- シャッフル → 2 名ずつペア
- 奇数: `trio` = 末尾チーム 3 名 / `bye` = 1 名チーム（不戦勝）

**テスト:** `src/features/draw/draw.test.ts`

### 2.3 チーム永続化 (`draw/drawApi.ts`)

| ステップ | 処理 |
|---|---|
| 1 | `makeTeams` 実行 |
| 2 | `teams` INSERT（seed = 配列順） |
| 3 | `team_members` INSERT |
| 4 | `events.odd_strategy` 保存 |
| 5 | brackets-manager で stage 作成 |
| 6 | `events.bracket_snapshot` = `get.stageData(0)` |
| 7 | `teams.manager_participant_id` 更新 |

**重要:** seeding には **`team.id`（UUID）を name として渡す**。顔写真解決のキー。

### 2.4 brackets-manager ラッパ (`bracket/manager.ts`)

`INSTRUCTIONS.md` §10.2:

```ts
export async function buildDoubleElimination(teamIds: string[]): Promise<StageData>
```

- 2 のべき乗に `null` パディング（BYE）
- `type: 'double_elimination'`
- `settings: { grandFinal: 'double', seedOrdering: ['natural'] }`

追加関数（Phase 3 でも使用）:

```ts
export function createManagerFromSnapshot(snapshot: StageData): BracketsManager
export function exportSnapshot(manager: BracketsManager): Promise<StageData>
```

### 2.5 座標計算 (`bracket/layout.ts`)

同梱 `layout.ts` を `src/features/bracket/layout.ts` に配置。

- `computeBracketLayout(data)` — 純粋関数
- `resolveTeamId(teamRef, participants)` — UUID 解決
- `DEFAULT_LAYOUT` — 定数（ハードコード座標ではなく **設定値**）

**テスト:** `src/features/bracket/layout.test.ts`

| テストケース | 検証内容 |
|---|---|
| 4 / 8 / 16 チーム | WB/LB/GF すべての match が返る |
| y 座標 | 同一 (bracket, round) 内で重ならない |
| viewBox | width/height が全ボックスを内包 |
| center | slot.center / match.center が box 内 |

### 2.6 顔 URL 解決 (`bracket/teamFaces.ts`)

```ts
export async function buildFaceUrlMap(eventId: string): Promise<Record<string, string[]>>
// team.id → [faceUrl, faceUrl, ...]（2 or 3 名）
```

`team_members` → `participants.face_crop_path` → `faceUrl()`

### 2.7 静的トーナメント表 (`bracket/BracketView.tsx`)

`INSTRUCTIONS.md` §10.3:

- SVG + `viewBox`
- コネクタ線（advance のみ。drop 線は Phase 4 TODO）
- 試合ボックス + スロット
- 顔写真（foreignObject or `<image>`）
- BYE/未確定 → プレースホルダ（シルエット + "?"）

### 2.8 顔写真プリロード (`lib/media.ts`)

```ts
export function preloadImages(urls: string[]): Promise<void>
```

BracketView 表示前に `buildFaceUrlMap` の URL を先読み。

### 2.9 Admin UI — 抽選セクション

- 参加者数表示
- `odd_strategy` 選択（trio / bye）
- 「抽選実行」ボタン（確定前やり直し可）
- 「抽選確定 → ブラケット生成」
- 完了後 `broadcast(eventId, { type: 'bracket:updated', eventId })`

### 2.10 DisplayPage — トーナメント表示

- マウント: `bracket_snapshot` + teams/participants 取得
- `BracketView` 描画
- Realtime `bracket:updated` 購読 → 再描画
- **演出なし**（線の衝突・爆発・VS は Phase 5）

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/features/draw/draw.ts` | 新規 |
| `src/features/draw/draw.test.ts` | 新規 |
| `src/features/draw/drawApi.ts` | 新規 |
| `src/features/bracket/manager.ts` | 新規 |
| `src/features/bracket/layout.ts` | `layout.ts` から配置 |
| `src/features/bracket/layout.test.ts` | 新規 |
| `src/features/bracket/BracketView.tsx` | 新規 |
| `src/features/bracket/teamFaces.ts` | 新規 |
| `src/lib/media.ts` | プリロード実装 |
| `src/routes/AdminPage.tsx` | 抽選 UI 追加 |
| `src/routes/DisplayPage.tsx` | BracketView 統合 |

---

## 検証手順

1. 参加者 8 名登録 → 抽選 → ブラケット生成
2. `/display` に WB/LB/GF 付きトーナメント表 + 顔写真
3. DevTools で各 `match.center` / `slot.center` が DOM に存在（data 属性等）
4. `npx vitest run` — draw + layout テスト PASS
5. Display リロード → 同じ表が復元
6. 奇数 7 名 → trio/bye それぞれ期待どおり

---

## やらないこと

- 勝敗入力・進行（Phase 3）
- WB/LB 配色・ハイライト本格化（Phase 4）
- drop コネクタ完全実装（Phase 4、`layout.ts` TODO）
- GSAP / 演出（Phase 5）

---

## 次フェーズ

Done 完了後 → [phase3.md](./phase3.md)
