# Phase 1 開始指示文（Cursor 用）

> 以下をそのまま Cursor チャットに貼り付けて Phase 1 を開始してください。

---

```
@phase1.md @HANDOFF_TO_PHASE1.md @INSTRUCTIONS.md @03_CURSOR_PROJECT_RULES.md

Phase 1（参加者登録）を実装してください。

## 前提
- Phase 0 は完了済み（Vite/Supabase/Realtime/ルーティング/Admin・Display 骨格）
- Supabase マイグレーション（0001_init.sql）は適用済み想定
- .env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定済み

## 実装範囲（phase1.md 順）
1. @mediapipe/face_detection 導入
2. src/features/registration/ 一式
   - faceCrop.ts（INSTRUCTIONS.md §9.2 の cropToSquare）
   - registrationApi.ts（INSTRUCTIONS.md §9.3）
   - CameraCapture.tsx（ガイド枠・撮影→確認→名前→登録）
   - ParticipantList.tsx（サムネ一覧・削除・撮り直し）
3. AdminPage に「参加者登録」セクション統合（useActiveEvent の eventId を使用）
4. 顔検出失敗時は中央クロップフォールバック

## Done 条件（phase1.md）
- [ ] カメラ撮影 → 1:1 正方形サムネで登録
- [ ] 一覧・削除・撮り直し
- [ ] Storage + participants テーブルに保存
- [ ] 検出失敗でもクラッシュしない

## やらないこと
- 抽選・ブラケット（Phase 2）
- brackets-manager 導入
- 演出ライブラリ

完了後は phase1.md の Done を更新し、HANDOFF_TO_PHASE2.md と Phase 2 開始指示文を作成してください。
```

---

## 補足

- カメラ API は HTTPS または localhost でのみ動作
- Windows ではブラウザのカメラ権限を許可すること
- 実装後の確認: Admin で 2〜3 名登録 → Supabase Dashboard で participants / Storage を確認
