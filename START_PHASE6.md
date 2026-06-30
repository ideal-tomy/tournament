# Phase 6 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 6 を開始してください。

---

```
@phase6.md @HANDOFF_TO_PHASE6.md @03_CURSOR_PROJECT_RULES.md

Phase 6（仕上げ・本番準備）を実装してください。

## 前提
- Phase 0–5 完了済み（進行ロジック + 静的表 + 演出レイヤー）
- Display で match:confirmed → 線伸長 → 衝突 → 爆発 → VS が再生される
- Admin「演出スキップ」で effect:skip が動作する

## 実装範囲（phase6.md 順）
1. lib/media.ts — MediaPreloader 本格化
2. /rehearsal — ダミーデータ通し（RehearsalPage + features/rehearsal）
3. lib/realtime.ts — 切断検知・自動再接続
4. Admin — 大会終了・肖像データ削除
5. docs/KIOSK_SETUP.md / docs/RUNBOOK.md / README.md
6. Vercel デプロイ手順（環境変数確認）

## Done 条件（phase6.md）
- [ ] 全素材プリロード完了後に演出開始
- [ ] Chrome キオスクで表示端末運用可能
- [ ] /rehearsal でダミーデータ通し成功
- [ ] Realtime 切断 → 自動復帰
- [ ] 肖像データ削除導線あり
- [ ] Vercel デプロイ済み、会場ネットワークで疎通確認

## やらないこと
- 進行ロジック変更
- 抽選演出（将来拡張）
- 3D フル演出

完了後は phase6.md Done 更新、IMPLEMENTATION_PLAN.md の完成定義を確認してください。
```

---

## 事前確認

Phase 6 着手前に:

1. Admin「試合進行」で勝敗確定 → Display で演出が再生されること
2. Admin「演出スキップ」→ Display が即座に表に復帰すること
3. `npm test` / `npm run build` が PASS であること
4. `.env.local` に Supabase URL / anon key / admin passcode が設定されていること
