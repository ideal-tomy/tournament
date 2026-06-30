# Phase 3 — 試合進行ロジック

> **見積もり:** 2〜3 日  
> **前提:** [phase2.md](./phase2.md) Done  
> **参照:** `01_TECH_REQUIREMENTS.md` §4、`02_DESIGN_REQUIREMENTS.md` §4.3、`03_CURSOR_PROJECT_RULES.md` §4–5

---

## ゴール（Done の定義）

- [ ] **演出ナシ**で、ボタン操作だけで大会を最初から最後まで完走できる
- [ ] ブラケットが常に正しい（WB 勝者前進、LB 落とし、GF リセット）
- [ ] 直前 1 手の **undo** が機能する
- [ ] 操作端末 ↔ 表示端末が Realtime + DB で同期（リロード復元含む）
- [ ] Vitest: 4/8/16 チーム、GF リセット、undo 再入力テスト PASS

---

## タスク一覧

### 3.1 進行ロジックモジュール (`progression/`)

```
src/features/progression/
  progression.ts       # 純粋関数: 次試合取得、勝敗適用、undo
  progression.test.ts
  progressionApi.ts    # DB 読み書き + broadcast
  useProgression.ts    # Admin 用フック
```

### 3.2 コア関数 (`progression.ts`)

| 関数 | 役割 |
|---|---|
| `hydrateManager(snapshot)` | `InMemoryDatabase.setData` → BracketsManager |
| `getNextMatch(manager)` | 両者確定済み・未確定の先頭 match |
| `applyResult(manager, matchId, winnerSlot)` | `update.match` + export |
| `isTournamentFinished(manager)` | 優勝確定判定 |
| `getChampionTeamId(data)` | 優勝 team UUID |

**勝敗適用:**

```ts
await manager.update.match({
  id: matchId,
  opponent1: { result: slot === 0 ? 'win' : 'loss' },
  opponent2: { result: slot === 1 ? 'win' : 'loss' },
});
```

**GF リセット:** `grandFinal: 'double'` 設定済みなら brackets-manager が自動処理。

### 3.3 undo 実装

- 勝敗入力 **直前**の `bracket_snapshot` を 1 手分メモリ保持（Admin 側）
- undo: スナップショットを `import()` → DB 保存 → broadcast
- 多段 undo は任意（MVP は 1 手のみ）

### 3.4 冪等性

`applyResult` 前に検証:

- 対象 match が `current_match_id` と一致（または next match）
- match.status が未確定
- 二重送信で状態が壊れない

### 3.5 DB 更新フロー

```
勝敗入力
  → progression.applyResult
  → exportSnapshot
  → events.bracket_snapshot 更新
  → events.current_match_id 更新
  → events.status = 'running' | 'finished'
  → broadcast match:confirmed（演出用ペイロード）
  → broadcast bracket:updated
```

**重要:** 状態更新と演出再生を分離。DB 更新は演出成功に依存しない。

### 3.6 Realtime ペイロード拡張

`src/types/index.ts`:

```ts
export type MatchConfirmedPayload = {
  type: 'match:confirmed';
  eventId: string;
  matchId: number;
  winnerTeamId: string;
  loserTeamId: string;
  // Phase 5 用: slot centers は Display 側で layout から解決
};
```

### 3.7 Admin 進行 UI (`routes/AdminPage.tsx`)

`02_DESIGN` §4.3:

| 要素 | 仕様 |
|---|---|
| 現在の試合 | 大きく表示（誰 vs 誰 / WB or LB / ラウンド） |
| 勝敗ボタン | 左右に分離・大きい |
| 確定 | 1 タップ + 確認ダイアログ |
| undo | 常設 |
| 残り試合数 | 表示 |
| 演出スキップ | ボタン（Phase 5 で Display 連動。今は broadcast のみ） |

### 3.8 Display 同期

- `bracket:updated` → snapshot 再取得 → BracketView 更新
- `match:confirmed` → Phase 3 では **ログのみ**（Phase 5 で演出トリガ）
- マウント時: snapshot から完全復元

### 3.9 イベント状態遷移

| status | 条件 |
|---|---|
| `setup` | 参加者登録・抽選前 |
| `running` | 1 試合目以降 |
| `finished` | 優勝確定 |

### 3.10 単体テスト (`progression.test.ts`)

| ケース | 検証 |
|---|---|
| 4 チーム DE | 全 match 完走・優勝 1 チーム |
| 8 チーム + BYE | bye 自動勝ち上がり |
| GF 第 1 試合 LB 勝利 | 第 2 試合（リセット）が生成される |
| GF 第 1 試合 WB 勝利 | 即優勝 |
| undo → 別勝者入力 | ブラケット整合 |

```bash
npx vitest run
```

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/features/progression/progression.ts` | 新規 |
| `src/features/progression/progression.test.ts` | 新規 |
| `src/features/progression/progressionApi.ts` | 新規 |
| `src/features/progression/MatchControl.tsx` | 新規（Admin UI） |
| `src/types/index.ts` | ペイロード拡張 |
| `src/routes/AdminPage.tsx` | 進行 UI |
| `src/routes/DisplayPage.tsx` | 同期強化 |

---

## 検証手順

1. 8 チームでブラケット生成 → Admin で全試合を手動完走
2. 各段階で Display の表が正しく更新される
3. GF で LB 勝者が先に勝つ → 第 2 試合が発生 → 正しい優勝者
4. undo → 直前の match が未確定に戻る → 再入力可能
5. Admin / Display 両方リロード → 途中状態から再開
6. Vitest 全 PASS

---

## やらないこと

- GSAP 演出（Phase 5）
- WB/LB 配色本格化（Phase 4）
- 棄権・不戦勝 UI（拡張。必要なら Phase 3 末尾で追加可）
- リハーサルモード本実装（Phase 6）

---

## 次フェーズ

Done 完了後:

- 見た目 → [phase4.md](./phase4.md)
- 演出 → [phase5.md](./phase5.md)（Phase 4 と並行可だが Phase 4 推奨）
