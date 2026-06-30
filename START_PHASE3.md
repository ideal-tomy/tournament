# Phase 3 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 3 を開始してください。

---

```
@phase3.md @HANDOFF_TO_PHASE3.md @03_CURSOR_PROJECT_RULES.md @INSTRUCTIONS.md

Phase 3（試合進行ロジック）を実装してください。

## 前提
- Phase 0–2 完了済み（参加者登録・抽選・bracket_snapshot・Display 静的表）
- Admin で抽選確定済み、Display にトーナメント表が表示できる状態

## 実装範囲（phase3.md 順）
1. src/features/progression/progression.ts + progression.test.ts
2. progressionApi.ts（DB 更新 + broadcast）
3. MatchControl.tsx（Admin 進行 UI: 現在試合・勝敗・undo）
4. Display: bracket:updated 同期（既存 reload 活用）
5. match:confirmed broadcast ペイロード
6. events.status / current_match_id 更新

## Done 条件（phase3.md）
- [ ] 演出ナシで大会完走
- [ ] GF リセット正しい
- [ ] undo 1 手
- [ ] Vitest（4/8 チーム、GF リセット、undo）
- [ ] 両端末リロード復元

## やらないこと
- GSAP 演出（Phase 5）
- WB/LB 配色本格化（Phase 4）

完了後は phase3.md Done 更新、HANDOFF_TO_PHASE4.md と Phase 4 開始指示文を作成してください。
```

---

## 事前確認

Phase 3 着手前に Admin で **抽選確定**し、Display にトーナメント表が出ていることを確認してください。
