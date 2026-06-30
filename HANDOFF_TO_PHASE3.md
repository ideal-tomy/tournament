# Phase 2 → Phase 3 引継ぎ書

> Phase 2 完了時点の状態・Phase 3 の前提をまとめる。

---

## Phase 2 完了内容

### 実装済み

| 項目 | パス |
|---|---|
| 抽選ロジック | `src/features/draw/draw.ts` |
| 抽選 API | `src/features/draw/drawApi.ts` |
| 抽選 UI | `src/features/draw/DrawPanel.tsx` |
| brackets-manager | `src/features/bracket/manager.ts` |
| 座標計算 | `src/features/bracket/layout.ts` |
| 静的 SVG 表 | `src/features/bracket/BracketView.tsx` |
| 顔 URL 解決 | `src/features/bracket/teamFaces.ts` |
| 表示 Hook | `src/features/bracket/useBracketDisplay.ts` |
| Display 統合 | `src/routes/DisplayPage.tsx` |
| Admin 抽選タブ | `src/routes/AdminPage.tsx` |
| Vitest | `draw.test.ts`, `layout.test.ts` |

### Done チェックリスト

- [x] 抽選（trio / bye）+ プレビュー + 確定
- [x] `bracket_snapshot` 保存（`events` テーブル）
- [x] `computeBracketLayout` + Vitest（4/8/16 チーム）
- [x] Display に顔写真付き静的トーナメント表
- [x] Realtime `bracket:updated` + リロード復元

---

## データフロー（Phase 3 でも同じ）

```
抽選確定
  → teams / team_members INSERT
  → buildDoubleElimination(teamIds)
  → events.bracket_snapshot = stageData
  → teams.manager_participant_id 更新

Display
  → fetchBracketSnapshot(eventId)
  → buildTeamVisuals(eventId)
  → BracketView
```

**seeding キー:** `team.id`（UUID）= brackets-manager `participant.name`

**顔解決:** `slot.teamRef` → `participant.name`（team UUID）→ `teamFaces`

---

## Phase 3 で実装すること

```
src/features/progression/
  progression.ts       # applyResult, getNextMatch, undo
  progression.test.ts
  progressionApi.ts
  MatchControl.tsx     # Admin 進行 UI
```

- `createManagerFromSnapshot` / `exportSnapshot` は `manager.ts` 済み
- 勝敗 → `manager.update.match` → snapshot 保存 → broadcast
- undo: 1 手分スナップショット保持
- `events.current_match_id` 更新

詳細: [phase3.md](./phase3.md)

---

## 注意事項

1. 進行ロジックは **brackets-manager に委譲**（手書き禁止）
2. 演出は Phase 5。Phase 3 は **静的表の更新のみ**
3. 勝敗入力は **冪等**に
4. `match:confirmed` broadcast は Phase 3 で追加（Phase 5 演出トリガ用）

---

## 次フェーズ開始

[START_PHASE3.md](./START_PHASE3.md) を Cursor に貼り付ける。
