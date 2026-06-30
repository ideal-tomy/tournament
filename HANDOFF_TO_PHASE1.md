# Phase 0 → Phase 1 引継ぎ書

> Phase 0 完了時点の状態・次フェーズの前提・未完了の手動作業をまとめる。

---

## Phase 0 完了内容

### 実装済み

| 項目 | パス / 内容 |
|---|---|
| Vite + React 18 + TS(strict) + Tailwind | プロジェクトルート |
| ルーティング | `/admin`, `/display`, `/rehearsal` |
| Supabase クライアント | `src/lib/supabase.ts` |
| Realtime | `src/lib/realtime.ts` — channel `event:{eventId}` |
| イベントブートストラップ | `src/lib/event.ts` — `getOrCreateActiveEvent()` |
| アクティブイベント Hook | `src/hooks/useActiveEvent.ts` |
| Admin パスコードガード | `src/hooks/useAdminPasscode.ts` |
| Admin Ping UI | `src/routes/AdminPage.tsx` |
| Display 受信 UI | `src/routes/DisplayPage.tsx` |
| Realtime 型 | `src/types/index.ts` — `RealtimeEvent` |
| DB マイグレーション | `supabase/migrations/0001_init.sql` |
| Cursor ルール | `.cursor/rules/project.mdc` |
| 環境変数テンプレ | `.env.example` |

### Done チェックリスト

- [x] Vite + React + TS + Tailwind + Supabase クライアントが動作（`npm run build` 成功）
- [ ] `/admin` Ping → `/display` 1 秒以内（**要: .env + SQL 適用 + Realtime 有効化**）
- [ ] リロードで eventId 復元（**要: 上記 Supabase 接続**）

> コード実装は完了。Supabase 側のセットアップはローカル環境で手動確認が必要。

---

## 手動セットアップ（Phase 0 検証前に必須）

1. **Supabase プロジェクト作成**（未作成の場合）
2. **SQL 実行:** `supabase/migrations/0001_init.sql`
3. **Realtime 有効化:** Dashboard → Settings → API
4. **`.env` 作成:** `.env.example` をコピーし URL / anon key を設定
5. **`npm run dev`** → Admin / Display で Ping 疎通

---

## 既存ファイル構成（Phase 1 が触る場所）

```
src/
  lib/
    supabase.ts      ← そのまま利用
    realtime.ts      ← そのまま利用
    event.ts         ← そのまま利用
    media.ts         ← Phase 1 では未使用、Phase 2 で拡張
  hooks/
    useActiveEvent.ts ← AdminPage で eventId 取得に利用
  routes/
    AdminPage.tsx    ← Phase 1 で「参加者登録」セクションを追加
  types/
    index.ts         ← 必要に応じて Participant 型追加
```

Phase 1 で **新規作成**:

```
src/features/registration/
  CameraCapture.tsx
  faceCrop.ts
  registrationApi.ts
  ParticipantList.tsx
```

---

## Phase 1 で実装すること（概要）

| # | 内容 |
|---|---|
| 1 | `@mediapipe/face_detection` 導入 |
| 2 | カメラ撮影 UI + 顔ガイド枠 |
| 3 | 1:1 顔クロップ → Storage 保存 |
| 4 | `participants` CRUD + 一覧 |
| 5 | AdminPage に登録タブ統合 |

詳細: [phase1.md](./phase1.md)、コード雛形: [INSTRUCTIONS.md](./INSTRUCTIONS.md) §9

---

## 注意事項（Phase 1 向け）

1. **seeding キー:** Phase 2 以降、チーム UUID を brackets-manager の name に渡す設計。参加者 ID は `participants.id`。
2. **Storage パス:** `{eventId}/{participantId}.jpg`（バケット `participant-photos` / `participant-faces`）
3. **操作端末 UI:** 派手な演出は入れない（`02_DESIGN` §4.1）
4. **brackets-manager は Phase 1 では導入しない**

---

## 既知の制限（Phase 0 時点）

- `/rehearsal` はプレースホルダ（Phase 6）
- Supabase 型生成は未導入（手書き `EventRow` のみ）
- Vitest 設定は Phase 2 で本格化
- RLS は anon 全許可（MVP）。本番公開前に要見直し

---

## 次フェーズ開始

[START_PHASE1.md](./START_PHASE1.md) の指示文を Cursor に貼り付けて Phase 1 を開始する。
