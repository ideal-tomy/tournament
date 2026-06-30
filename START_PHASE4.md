# Phase 4 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 4 を開始してください。

---

```
@phase4.md @HANDOFF_TO_PHASE4.md @03_CURSOR_PROJECT_RULES.md

Phase 4（静的トーナメント表示の作り込み）を実装してください。

## 前提
- Phase 0–3 完了済み（参加者登録・抽選・進行・Display 静的表）
- Admin「試合進行」タブで勝敗入力 → Display が Realtime 同期

## 実装範囲（phase4.md 順）
1. src/styles/bracketTheme.ts — WB/LB/GF 配色固定
2. BracketView.tsx — 配色・ラベル・現在試合ハイライト
3. 確定済み経路の視覚区別
4. 長い名前 / 3 名 / BYE のレイアウト耐性

## Done 条件（phase4.md）
- [ ] WB/LB/GF が配色 + ラベルで区別
- [ ] 現在進行ノードがハイライト
- [ ] 確定済み勝ち上がり経路が視覚的に区別
- [ ] 名前が長い・3 名・BYE でも崩れない

## やらないこと
- GSAP 演出（Phase 5）
- 進行ロジック変更

完了後は phase4.md Done 更新、HANDOFF_TO_PHASE5.md と Phase 5 開始指示文を作成してください。
```

---

## 事前確認

Phase 4 着手前に:

1. **既存イベント**の snapshot が古い形式の場合、抽選タブでブラケット再生成
2. Admin「試合進行」で 1 試合以上進め、Display の表が更新されること
3. `npm test` / `npm run build` が PASS であること
