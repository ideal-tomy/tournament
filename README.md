# README — ダーツ大会 ライブ進行＆VS演出システム

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

| 変数 | 説明 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_ADMIN_PASSCODE` | `/admin` 簡易ガード（既定: changeme） |

### 3. Supabase マイグレーション

Supabase Dashboard → SQL Editor で `supabase/migrations/0001_init.sql` を実行。

**Realtime:** Dashboard → Project Settings → API → Realtime を有効化。

### 4. 開発サーバー

```bash
npm run dev
```

| URL | 用途 |
|---|---|
| http://localhost:5173/admin | 操作端末 |
| http://localhost:5173/display | 表示端末 |

## Phase 0 疎通確認

1. `/admin` でパスコード入力 → 「Ping 送信」
2. `/display?eventId=<同一ID>` で受信カウントが増える
3. 両方リロード → イベント ID が復元される

## ドキュメント

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — 全体計画
- [phase0.md](./phase0.md) 〜 [phase6.md](./phase6.md) — フェーズ別手順
- [HANDOFF_TO_PHASE1.md](./HANDOFF_TO_PHASE1.md) — Phase 0→1 引継ぎ
- [HANDOFF_TO_PHASE2.md](./HANDOFF_TO_PHASE2.md) — Phase 1→2 引継ぎ
