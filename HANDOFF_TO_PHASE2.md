# Phase 1 → Phase 2 引継ぎ書

> Phase 1 完了時点の状態・Phase 2 の前提をまとめる。

---

## Phase 1 完了内容

### 実装済み

| 項目 | パス |
|---|---|
| MediaPipe 顔検出 | `@mediapipe/face_detection` |
| 顔クロップ | `src/features/registration/faceCrop.ts` |
| Storage / DB API | `src/features/registration/registrationApi.ts` |
| 撮影 UI | `src/features/registration/CameraCapture.tsx` |
| 一覧 UI | `src/features/registration/ParticipantList.tsx` |
| 統合パネル | `src/features/registration/RegistrationPanel.tsx` |
| 一覧 Hook | `src/features/registration/useParticipants.ts` |
| Admin タブ | `src/routes/AdminPage.tsx` — 参加者登録 / 疎通テスト |
| 型 | `src/types/index.ts` — `ParticipantRow` |

### Done チェックリスト

- [x] カメラ撮影 → 1:1 正方形サムネで登録（コード実装済み）
- [x] 一覧・削除・撮り直し
- [x] 顔検出失敗 → 中央クロップフォールバック
- [x] Storage（`participant-photos` / `participant-faces`）+ `participants` テーブル
- [ ] 実機カメラでの動作確認（要: ローカル `npm run dev` + HTTPS/localhost）

---

## Storage パス規約（Phase 2 以降も同じ）

```
participant-photos/{eventId}/{participantId}.jpg  … 原画像
participant-faces/{eventId}/{participantId}.jpg   … 1:1 クロップ（表示用）
```

公開 URL: `faceUrl(face_crop_path)` → `registrationApi.ts`

---

## Phase 2 で使うデータ

| 用途 | ソース |
|---|---|
| 抽選入力 | `participants.id` の配列 |
| 顔表示 | `participants.face_crop_path` → `faceUrl()` |
| チーム UUID | `teams.id` を brackets-manager seeding の `name` に渡す |
| ブラケット真実源 | `events.bracket_snapshot` |

Phase 2 新規:

```
src/features/draw/draw.ts, drawApi.ts, draw.test.ts
src/features/bracket/manager.ts, layout.ts, BracketView.tsx, teamFaces.ts
```

同梱 `layout.ts` → `src/features/bracket/layout.ts` に配置。

---

## 注意事項

1. **seeding キー:** `team.id`（UUID）を brackets-manager participant name に渡す（`INSTRUCTIONS.md` §10.2）
2. **brackets-manager** は Phase 2 で初導入
3. **演出は Phase 2 では作らない**（静的トーナメント表のみ）
4. **Vitest** で `draw.test.ts` / `layout.test.ts` 必須

---

## 次フェーズ開始

[START_PHASE2.md](./START_PHASE2.md) の指示文を Cursor に貼り付ける。
