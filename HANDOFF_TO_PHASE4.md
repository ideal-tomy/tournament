# Phase 3 → Phase 4 引継ぎ書

> Phase 3 完了時点の状態・Phase 4 の前提をまとめる。

---

## Phase 3 完了内容

### 実装済み

| 項目 | パス |
|---|---|
| 進行ロジック（純粋関数） | `src/features/progression/progression.ts` |
| 進行 API（DB + broadcast） | `src/features/progression/progressionApi.ts` |
| Admin フック | `src/features/progression/useProgression.ts` |
| Admin 進行 UI | `src/features/progression/MatchControl.tsx` |
| Admin タブ統合 | `src/routes/AdminPage.tsx` — 「試合進行」 |
| Display 同期強化 | `src/routes/DisplayPage.tsx` — `match:confirmed` 等ログ |
| Vitest | `src/features/progression/progression.test.ts` |
| スナップショット形式 | `src/features/bracket/manager.ts` — 完全 `Database` 保存 |

### Done チェックリスト

- [x] 演出ナシで Admin ボタン操作だけで大会完走
- [x] WB 勝者前進 / LB 落とし / GF リセット（brackets-manager 委譲）
- [x] undo 1 手（Admin メモリ保持 → snapshot 復元）
- [x] `events.status` / `current_match_id` 更新
- [x] Realtime: `match:confirmed` + `bracket:updated` + `event:finished`
- [x] Vitest: 4/8/7(BYE) チーム、GF リセット、undo 再入力
- [x] Display: `bracket:updated` → 再取得 → BracketView 更新

---

## データフロー（Phase 3 確定版）

```
勝敗確定 (Admin)
  → validateMatchApply（冪等チェック）
  → manager.update.match
  → exportSnapshot（完全 Database）
  → events.bracket_snapshot 更新
  → events.current_match_id = getNextMatch(...)
  → events.status = setup | running | finished
  → broadcast match:confirmed
  → broadcast bracket:updated（+ event:finished）

Display
  → bracket:updated → fetchBracketSnapshot → BracketView
  → match:confirmed → console ログのみ（Phase 5 で演出トリガ）

undo
  → 直前 snapshot を Admin が 1 手保持
  → DB 復元 + bracket:updated
```

---

## 重要な変更点

### bracket_snapshot は完全 Database

Phase 2 までの **部分 JSON**（group/round/match/participant のみ）では `update.match` が動きません。

- 新規生成: `buildDoubleElimination` → 完全 `Database` を保存
- 表示: `toStageData(snapshot)` で layout / BracketView に渡す
- **既存イベント**（Phase 2 以前の snapshot）: 抽選タブで **ブラケット再生成** が必要

### 大会終了判定

`isTournamentFinished` = `manager.get.finalStandings(0)` 成功。

WB が GF 第 1 試合で勝利した場合、第 2 GF match が Ready のまま残ることがあるが、`finalStandings` が成立すれば終了扱い。

---

## Phase 4 で実装すること

- WB/LB/GF 配色 + ラベル本格化（`src/styles/bracketTheme.ts`）
- 現在試合ノードのハイライト
- 確定済み勝ち上がり経路の視覚区別
- 長い名前 / 3 名チーム / BYE のレイアウト耐性

詳細: [phase4.md](./phase4.md)

---

## やらないこと（Phase 4 でも）

- GSAP 演出（Phase 5）
- 多段 undo
- 棄権 UI

---

## 次フェーズ開始

[START_PHASE4.md](./START_PHASE4.md) を Cursor に貼り付ける。
