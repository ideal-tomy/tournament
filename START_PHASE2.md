# Phase 2 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 2 を開始してください。

---

```
@phase2.md @HANDOFF_TO_PHASE2.md @INSTRUCTIONS.md @layout.ts @03_CURSOR_PROJECT_RULES.md

Phase 2（抽選・ブラケット生成・静的トーナメント表）を実装してください。

## 前提
- Phase 0–1 完了済み（Realtime / 参加者登録）
- Supabase マイグレーション適用済み
- Admin で参加者が 4 名以上登録できる状態

## 実装範囲（phase2.md 順）
1. brackets-manager, brackets-memory-db 導入
2. src/features/draw/draw.ts + draw.test.ts + drawApi.ts
3. src/features/bracket/manager.ts（buildDoubleElimination）
4. layout.ts を src/features/bracket/layout.ts に配置 + layout.test.ts
5. BracketView.tsx（SVG 静的描画）
6. teamFaces.ts + media.ts プリロード
7. Admin に抽選 UI、Display に BracketView

## Done 条件（phase2.md）
- [ ] 抽選でランダムペア（奇数 trio/bye）
- [ ] bracket_snapshot 保存
- [ ] computeBracketLayout 座標 + Vitest
- [ ] Display に顔写真付き静的トーナメント表
- [ ] リロード復元

## やらないこと
- 勝敗入力（Phase 3）
- GSAP / 演出（Phase 5）

完了後は phase2.md Done 更新、HANDOFF_TO_PHASE3.md と Phase 3 開始指示文を作成してください。
```

---

## 事前確認

Phase 2 着手前に Admin で **4〜8 名**の参加者を登録しておくと、ブラケット描画の確認がしやすい。
