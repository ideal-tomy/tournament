# ダーツ大会 — ライブ進行＆VS演出システム

Vite + React + Supabase のダブルイリミネーション大会管理アプリ。

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピー:

```bash
copy .env.example .env.local   # Windows
```

| 変数 | 説明 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_ADMIN_PASSCODE` | `/admin` 簡易ガード |

### 3. Supabase マイグレーション

SQL Editor で順に実行:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_add_rating.sql`

**Realtime:** Dashboard → Project Settings → API → Realtime を有効化。

### 4. 開発サーバー

```bash
npm run dev
```

| URL | 用途 |
|---|---|
| http://localhost:5173/admin | 操作端末 |
| http://localhost:5173/display | 表示端末（トーナメント表 + 演出） |
| http://localhost:5173/rehearsal | リハーサル（ダミー 8 名通し） |

### 5. ビルド・テスト

```bash
npm test
npm run build
npm run preview   # 本番ビルド確認
```

## Vercel デプロイ

1. リポジトリを Vercel に接続
2. 環境変数を設定（上記 3 つ）
3. デプロイ:

```bash
npx vercel --prod
```

4. 表示端末 URL 例:

```
https://your-app.vercel.app/display?eventId=<UUID>&kiosk=1
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/KIOSK_SETUP.md](./docs/KIOSK_SETUP.md) | 表示端末キオスク手順 |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | 当日運営フロー |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | 全体計画 |
| [phase0.md](./phase0.md) 〜 [phase6.md](./phase6.md) | フェーズ別手順 |

## 主要機能

- 参加者登録（カメラ + 顔トリミング）
- レーティング均等抽選 → ダブルイリミ bracket
- Admin 試合進行 + Display リアルタイム同期
- 試合確定演出（線伸長 → 衝突 → 爆発 → VS、スキップ可）
- 大会終了時の肖像データ削除
- Realtime 切断時の自動再接続
