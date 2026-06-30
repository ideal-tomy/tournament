# Phase 0 — 基盤セットアップ

> **見積もり:** 0.5〜1 日  
> **前提:** Node.js 20 LTS、Supabase プロジェクト作成済み  
> **参照:** `INSTRUCTIONS.md` §2–8、`01_TECH_REQUIREMENTS.md` §2–3

---

## ゴール（Done の定義）

- [x] Vite + React + TS + Tailwind + Supabase クライアントが動作する（`npm run build` 成功）
- [ ] `/admin` で押したボタンが `/display` に Realtime で **1 秒以内**に届く（要 Supabase 接続・Realtime 有効化）
- [ ] リロードしても落ちず、アクティブイベントを取得できる（要 Supabase 接続）

---

## タスク一覧

### 0.1 リポジトリ・プロジェクト初期化

| # | 作業 | 詳細 |
|---|---|---|
| 0.1.1 | GitHub リポジトリ作成 | ideal合同会社 Org に `darts-tournament` 等を作成 |
| 0.1.2 | Vite プロジェクト作成 | `npm create vite@latest . -- --template react-ts` |
| 0.1.3 | 依存パッケージ導入 | `@supabase/supabase-js`, `react-router-dom` |
| 0.1.4 | 開発依存 | `vitest`, `@types/node`, `tailwindcss`, `postcss`, `autoprefixer` |
| 0.1.5 | Tailwind 設定 | `content: ['./index.html','./src/**/*.{ts,tsx}']` |
| 0.1.6 | フォント設定 | `index.css` に Noto Sans CJK JP（`02_DESIGN` §3） |
| 0.1.7 | `.env` / `.gitignore` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_PASSCODE` |

**この段階では入れない:** `gsap`, `pixi.js`, `lottie-web`, `brackets-manager`（Phase 2 で導入）

### 0.2 Supabase セットアップ

| # | 作業 | 詳細 |
|---|---|---|
| 0.2.1 | マイグレーション配置 | `0001_init.sql` → `supabase/migrations/0001_init.sql` |
| 0.2.2 | SQL 実行 | Dashboard SQL Editor または `supabase db push` |
| 0.2.3 | 動作確認 | `events` テーブルに手動 INSERT できること |

### 0.3 フォルダ骨格

```
src/
  main.tsx
  App.tsx
  index.css
  lib/
    supabase.ts
    realtime.ts
    media.ts          # 空ファイルで OK
  types/
    index.ts
  routes/
    AdminPage.tsx
    DisplayPage.tsx
    RehearsalPage.tsx
```

### 0.4 Supabase クライアント

`INSTRUCTIONS.md` §6 のコードをそのまま配置:

- `src/lib/supabase.ts` — `createClient`
- `src/types/index.ts` — `RealtimeEvent` 型（`any` 禁止）
- `src/lib/realtime.ts` — `eventChannel`, `broadcast`, `subscribe`

### 0.5 ルーティング

`INSTRUCTIONS.md` §7:

| ルート | 用途 |
|---|---|
| `/admin` | 操作端末 |
| `/display` | 表示端末 |
| `/rehearsal` | リハ（Phase 6 で本実装。今はプレースホルダ） |
| `*` | `/admin` へリダイレクト |

- `/admin` に `VITE_ADMIN_PASSCODE` による簡易ガード

### 0.6 イベントブートストラップ

`src/lib/event.ts`（新規）:

```ts
// アクティブイベント取得。なければ status='setup' で作成
export async function getOrCreateActiveEvent(): Promise<{ id: string; name: string }>
```

- URL クエリ `?eventId=xxx` があればそれを使用
- なければ `status != 'finished'` の最新 1 件、なければ新規作成

### 0.7 Realtime 疎通（Phase 0 の核心）

**AdminPage:**
- 「Ping 送信」ボタン
- 押下で `broadcast(eventId, { type: 'bracket:updated', eventId })`

**DisplayPage:**
- `subscribe` で受信
- 受信時刻・カウントを画面表示（デバッグ用）

両ページともマウント時に `getOrCreateActiveEvent()` で `eventId` を解決。

### 0.8 Cursor プロジェクトルール配置

`03_CURSOR_PROJECT_RULES.md` を `.cursor/rules/project.mdc` にコピー（推奨）。

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `package.json` | 新規 |
| `vite.config.ts` | Vitest 設定追加（任意・Phase 2 前でも可） |
| `tailwind.config.js` | 新規 |
| `src/lib/supabase.ts` | 新規 |
| `src/lib/realtime.ts` | 新規 |
| `src/lib/event.ts` | 新規 |
| `src/types/index.ts` | 新規 |
| `src/App.tsx` | 新規 |
| `src/routes/AdminPage.tsx` | 新規 |
| `src/routes/DisplayPage.tsx` | 新規 |
| `src/routes/RehearsalPage.tsx` | プレースホルダ |
| `supabase/migrations/0001_init.sql` | コピー |

---

## 検証手順

1. `npm run dev` で起動
2. ブラウザ 2 タブ: `http://localhost:5173/admin` と `/display`
3. Admin で Ping → Display に 1 秒以内で表示
4. 両方リロード → エラーなく eventId 復元
5. Supabase Dashboard で `events` 行が存在すること

---

## やらないこと

- カメラ・参加者登録（Phase 1）
- brackets-manager 導入（Phase 2）
- 演出関連ライブラリ（Phase 5）

---

## 次フェーズ

Done 完了後 → [phase1.md](./phase1.md)
