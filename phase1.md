# Phase 1 — 参加者登録

> **見積もり:** 1〜2 日  
> **前提:** [phase0.md](./phase0.md) Done  
> **参照:** `INSTRUCTIONS.md` §9、`02_DESIGN_REQUIREMENTS.md` §4.1

---

## ゴール（Done の定義）

- [x] カメラ撮影 → 顔が揃った **1:1 正方形サムネ**で登録される
- [x] 一覧表示・撮り直し・削除ができる
- [x] 顔検出失敗時も **中央クロップ**で登録でき、落ちない
- [x] 原画像・クロップ画像が Storage に保存され、`participants` にパスが記録される

---

## タスク一覧

### 1.1 依存パッケージ

```bash
npm i @mediapipe/face_detection @mediapipe/camera_utils
```

### 1.2 フォルダ・ファイル作成

```
src/features/registration/
  CameraCapture.tsx      # 撮影 UI + ガイド枠
  faceCrop.ts            # 顔検出 → 1:1 クロップ
  registrationApi.ts       # Supabase CRUD + Storage
  ParticipantList.tsx    # サムネ一覧
  useParticipants.ts     # 一覧取得フック（任意）
```

### 1.3 顔トリミング (`faceCrop.ts`)

`INSTRUCTIONS.md` §9.2 の `cropToSquare` を実装:

- MediaPipe Face Detection でバウンディングボックス取得
- 顔幅 × 1.6 の正方形クロップ
- 出力 512×512 JPEG
- **検出失敗 → 中央正方形クロップ**（必須フォールバック）

### 1.4 Storage API (`registrationApi.ts`)

`INSTRUCTIONS.md` §9.3:

| 関数 | 役割 |
|---|---|
| `addParticipant(eventId, name, photo, face)` | INSERT + Storage アップロード |
| `listParticipants(eventId)` | 一覧取得 |
| `deleteParticipant(id)` | DB 削除 + Storage 削除 |
| `updateParticipant(id, ...)` | 撮り直し用 |
| `faceUrl(path)` | 公開 URL 取得 |

Storage パス: `{eventId}/{participantId}.jpg`

### 1.5 撮影 UI (`CameraCapture.tsx`)

`02_DESIGN` §4.1 に従う:

- `getUserMedia({ video: true })` プレビュー
- **顔ガイド枠**（楕円 or 正方形）をオーバーレイ
- フロー: 撮影 → 確認プレビュー → 名前入力 → 登録
- 「撮り直し」ボタン
- 操作端末向け: 大ボタン・シンプル UI（派手な演出なし）

### 1.6 一覧 UI (`ParticipantList.tsx`)

- サムネ + 名前のグリッド
- 削除ボタン（確認ダイアログ推奨）
- 撮り直し → CameraCapture へ

### 1.7 AdminPage 統合

`/admin` にタブ or セクション:

1. **参加者登録**（Phase 1）
2. **疎通テスト**（Phase 0 の Ping — 開発中のみ残しても可）

マウント時: `getOrCreateActiveEvent()` → `eventId` を子コンポーネントへ

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/features/registration/faceCrop.ts` | 新規 |
| `src/features/registration/registrationApi.ts` | 新規 |
| `src/features/registration/CameraCapture.tsx` | 新規 |
| `src/features/registration/ParticipantList.tsx` | 新規 |
| `src/routes/AdminPage.tsx` | 参加者 UI 追加 |

---

## 検証手順

1. `/admin` でカメラ許可 → ガイド枠表示
2. 撮影 → 正方形サムネ確認 → 名前入力 → 登録
3. 一覧に表示される
4. Supabase: `participants` 行 + Storage 2 バケットにファイル
5. 削除 → DB/Storage から消える
6. 顔を外して撮影 → 中央クロップで登録（クラッシュしない）

---

## やらないこと

- 抽選・チーム編成（Phase 2）
- トーナメント表描画（Phase 2）
- 顔写真の演出用プリロード本格化（Phase 2 で `media.ts` 着手）

---

## 次フェーズ

Done 完了後 → [phase2.md](./phase2.md)
