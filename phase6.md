# Phase 6 — 仕上げ・本番準備

> **見積もり:** 1〜2 日  
> **前提:** [phase5.md](./phase5.md) Done  
> **参照:** `00_REQUIREMENTS.md` §6.6・§7、`01_TECH_REQUIREMENTS.md` §9–13

---

## ゴール（Done の定義）

- [x] 全素材プリロードが本番フローで完了してから演出開始
- [x] Chrome キオスクで表示端末運用可能（`?kiosk=1` + [KIOSK_SETUP.md](./docs/KIOSK_SETUP.md)）
- [x] `/rehearsal` でダミーデータ通しが成功
- [x] Realtime 切断 → 自動復帰
- [x] 肖像データ削除導線あり
- [ ] Vercel デプロイ済み、会場ネットワークで疎通確認（[README.md](./README.md) 手順。実環境で要確認）

---

## タスク一覧

### 6.1 プリロード統合 (`lib/media.ts`)

| タイミング | プリロード対象 |
|---|---|
| Display マウント | 背景動画、爆発 WebM、Lottie、placeholder |
| ブラケット生成後 | 全参加者顔写真 |
| 試合確定前 | 当該 2 チームの顔（キャッシュ命中ならスキップ） |

```ts
export class MediaPreloader {
  preloadAll(urls: string[]): Promise<void>
  isReady(): boolean
}
```

- ロード完了 Promise を `EffectOrchestrator` が await
- ローディング UI（任意）

### 6.2 リハーサルモード (`/rehearsal`)

```
src/routes/RehearsalPage.tsx
src/features/rehearsal/
  dummyData.ts           # 8 名分のダミー参加者・顔
  runRehearsal.ts        # 自動で数試合進行 + 演出
```

- ダミー event 作成 or 専用 `rehearsal` フラグ
- ボタン 1 つで「登録 → 抽選 → 数試合 → 演出」を通し
- 本番 event を汚さない

### 6.3 キオスク設定

表示端末 Chrome:

- `--kiosk --app=https://xxx.vercel.app/display?eventId=xxx`
- フルスクリーン（F11 手順書に記載）
- スリープ無効（OS 設定）
- マウスカーソル非表示（CSS `cursor: none` 任意）

`docs/KIOSK_SETUP.md`（簡易手順書）を作成。

### 6.4 エラー復帰

| シナリオ | 対応 |
|---|---|
| Realtime 切断 | 自動再接続 + DB 再読込 |
| Display クラッシュ | リロード → snapshot 復元 |
| 演出失敗 | ログ + BracketView 継続 |
| Admin 二重送信 | 冪等ガード（Phase 3 確認） |

`src/lib/realtime.ts`: `channel.on('system', ...)` で接続状態監視

### 6.5 肖像データ削除

Admin に「大会終了・データ削除」:

1. `events.status = 'finished'`
2. Storage: `participant-photos` / `participant-faces` の `{eventId}/*` 削除
3. `participants` / `teams` / `team_members` 削除（cascade）
4. 確認ダイアログ（不可逆）

### 6.6 デプロイ

```bash
# Vercel
vercel --prod
```

環境変数（Vercel Dashboard）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_PASSCODE`

### 6.7 本番リハチェックリスト

| # | 項目 |
|---|---|
| 1 | 会場 Wi-Fi で Admin / Display 疎通 |
| 2 | Realtime 遅延 < 1 秒 |
| 3 | カメラ撮影 → 8 名登録 |
| 4 | 抽選 → ブラケット表示 |
| 5 | 全試合完走 + undo 1 回 |
| 6 | 演出 3 回 + スキップ 1 回 |
| 7 | Display リロード復帰 |
| 8 | 1080p 30fps 以上 |
| 9 | キオスク 30 分連続稼働 |
| 10 | データ削除 |

### 6.8 ドキュメント整備

| ファイル | 内容 |
|---|---|
| `docs/KIOSK_SETUP.md` | キオスク手順 |
| `docs/RUNBOOK.md` | 当日運営フロー（登録→抽選→進行） |
| `README.md` | セットアップ・env・起動方法 |

---

## 作成・変更ファイル

| ファイル | 操作 |
|---|---|
| `src/lib/media.ts` | プリロード本格化 |
| `src/lib/realtime.ts` | 再接続 |
| `src/routes/RehearsalPage.tsx` | 本実装 |
| `src/features/rehearsal/*` | 新規 |
| `src/routes/AdminPage.tsx` | データ削除 |
| `docs/KIOSK_SETUP.md` | 新規 |
| `docs/RUNBOOK.md` | 新規 |
| `README.md` | 新規 |

---

## 検証手順

1. `/rehearsal` で通し成功
2. Vercel URL をキオスク起動 → 演出 OK
3. Wi-Fi 瞬断 → 自動復帰
4. データ削除 → Storage/DB 空
5. 本番リハチェックリスト 10/10

---

## プロジェクト完成

すべて Done → `IMPLEMENTATION_PLAN.md` §9 の完成定義を満たす。

---

## 将来拡張（スコープ外・参考）

- 抽選演出（Display で顔が回転）
- 棄権・不戦勝 UI
- 認証 / RLS 強化
- マルチイベント同時進行
- サウンド本格化
