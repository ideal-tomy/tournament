# Phase 5 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 5 を開始してください。

---

```
@phase5.md @HANDOFF_TO_PHASE5.md @03_CURSOR_PROJECT_RULES.md

Phase 5（演出レイヤー）を実装してください。

## 前提
- Phase 0–4 完了済み（進行ロジック + 静的トーナメント表の作り込み）
- Display に WB/LB/GF 配色・現在試合ハイライト・確定経路表示あり
- `match:confirmed` broadcast が Admin から送信される

## 実装範囲（phase5.md 順）
1. gsap / pixi.js / lottie-web 導入
2. src/features/presentation/ — タイムライン・VS画面・爆発
3. DisplayPage 統合 — match:confirmed で演出、effect:skip でスキップ
4. 素材プリロード（lib/media.ts 拡張）
5. 座標は computeBracketLayout / NodeLayout のみ参照（ハードコード禁止）

## Done 条件（phase5.md）
- [ ] 線伸長 → 衝突 → 爆発 → 全画面 VS（4〜7秒）
- [ ] 演出スキップで即終了
- [ ] 演出失敗しても進行データ無傷
- [ ] 素材プリロード後に再生

## やらないこと
- 進行ロジック変更
- 座標ハードコード

完了後は phase5.md Done 更新、HANDOFF_TO_PHASE6.md と Phase 6 開始指示文を作成してください。
```

---

## 事前確認

Phase 5 着手前に:

1. `/display` でトーナメント表が WB/LB/GF 配色で表示されること
2. Admin「試合進行」で勝敗確定 → Display の表と `match:confirmed` ログが出ること
3. `npm test` / `npm run build` が PASS であること
