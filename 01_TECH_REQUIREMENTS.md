# 01. 技術要件定義書

> 前提: `00_REQUIREMENTS.md` のフェーズ分割・業務ルールに従う。

---

## 1. 技術スタック（確定）

| 領域 | 採用 | 理由 |
|---|---|---|
| フレームワーク | React 18 + Vite + TypeScript(strict) | 既存の慣れたスタック／高速HMR |
| スタイル | Tailwind CSS | 既存運用と統一 |
| DB / 認証 / Storage / Realtime | Supabase | 既存運用、Realtimeで端末間同期が容易 |
| トーナメント進行ロジック | **brackets-manager (Drarig29)** | ダブルイリミの勝敗/敗者落とし/GFリセットを自作しない |
| 演出の振り付け | **GSAP (timeline)** | 「線伸長→衝突→爆発→VS」の順序連鎖に最適 |
| パーティクル/2D演出 | **PixiJS** | 軽量・GPU描画 |
| 既製モーション素材 | **lottie-web** | 爆発などのアニメを差し替え可能に |
| 透過リッチ動画 | アルファ付き **WebM (VP9)** | Chrome固定なので採用可能 |
| 顔キャプチャ | `getUserMedia` | 標準API |
| 顔検出/トリミング | **face-api.js** または **@mediapipe/face_detection** | 顔枠を揃えて見栄えを安定 |
| デプロイ | Vercel | 既存運用 |

> バージョンは初期セットアップ時にロックし、`03_CURSOR_PROJECT_RULES.md` の指示に従い勝手に変更しない。

---

## 2. アーキテクチャ

### 2.1 画面（ルート）構成
- `/admin` … 操作端末（運営UI）：登録・抽選・進行・勝敗入力
- `/display` … 表示端末（演出フロント）：トーナメント表・VS・爆発
- `/rehearsal` … デモ/リハーサル（ダミーデータで全演出確認）

操作端末と表示端末は **同一アプリの別ルート**。役割でUIを分離する。

### 2.2 同期モデル
```
[/admin] --状態更新--> [Supabase DB(真実源)] <--購読-- [/display]
        \--即時通知(broadcast)--> [Realtime channel] --演出トリガ--> [/display]
```
- **真実源はSupabase DB**（ブラケット状態を含む）。
- 演出の即時発火は **Realtime broadcast**（低遅延のイベント送信）。
- DB変更検知(`postgres_changes`)は状態同期の保険として併用可。
- いずれの端末もマウント時にDBから最新状態を読み込み、画面を復元する。

---

## 3. データモデル（Supabase）

ブラケットの内部構造は brackets-manager に任せ、**そのDBスナップショットをJSONBで保持**する方式を基本とする（自前でWB/LBの遷移SQLを書かない）。

```sql
-- 開催単位
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  held_on date not null default current_date,
  status text not null default 'setup',      -- setup | running | finished
  bracket_snapshot jsonb,                     -- brackets-manager のDBダンプ(真実源)
  current_match_id int,                       -- 進行中/次の試合(manager内ID)
  created_at timestamptz default now()
);

-- 参加者
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  photo_path text,        -- Storage: 原画像
  face_crop_path text,    -- Storage: 顔トリミング済み(表示用)
  created_at timestamptz default now()
);

-- チーム(ペア)。トーナメントの「枠」
create table teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  seed int,               -- brackets-manager へ渡すシード順
  manager_participant_id int, -- brackets-manager 内のparticipant ID と対応付け
  display_name text,      -- 任意のチーム名
  created_at timestamptz default now()
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  primary key (team_id, participant_id)
);
```

- `bracket_snapshot` が状態の真実源。勝敗入力のたびにここを更新する。
- `teams.manager_participant_id` で「manager内の対戦相手ID」⇔「顔写真付きチーム」を引けるようにする（VS画面の顔差し込みに必須）。
- マルチイベント拡張に備え、すべて `event_id` を持たせておく（今回は単一運用でも）。

### Storage バケット
- `participant-photos`（原画像）/ `participant-faces`（トリミング済み）。
- 命名規則: `{event_id}/{participant_id}.jpg`。
- 肖像データはイベント終了後に一括削除できる導線を用意（要件§7）。

---

## 4. ダブルイリミネーション進行ロジック

### 4.1 方針
**brackets-manager を唯一の進行エンジンとする。WB/LBの遷移・bye・GFリセットを手書きしない。**

- ストレージは `InMemoryDatabase` を使用し、操作のたびに `manager.export()` → `events.bracket_snapshot` へ保存。
- 起動/リロード時は `bracket_snapshot` → `manager.import()` で復元。
- GFは double elimination で `grandFinal: 'double'` 相当の設定とし、**ブラケットリセット（GF第2試合）に対応**させる。

### 4.2 基本フロー
1. チーム確定 → seed配列を作成 → `manager.create.stage({ type: 'double_elimination', seeding, settings:{ grandFinal:'double' } })`
2. 「次の試合」= 未確定matchのうち両者確定済みの先頭。
3. 勝敗入力 → `manager.update.match({ id, opponent1/2: { result:'win'|'loss' } })`
4. export → DB保存 → Realtime通知。
5. すべてのmatch確定 → 優勝確定。

### 4.3 undo
- 操作前スナップショットを1手分保持し、undo時に `import()` で巻き戻す。
- 最低1手のundoを必須とする。

### 4.4 テスト（必須）
- ブラケットロジックはUIと独立して **単体テスト**する（Vitest）。
  - 例: 4/8/16チーム、奇数→bye、GFでLB勝者が勝った場合のリセット、undo後の再入力。
- ロジックのバグは本番進行を破壊するため、ここは最優先でテストを書く。

---

## 5. 座標駆動レイアウト（演出の核心）

### 5.1 考え方
トーナメント表は**データ駆動でレイアウトを自動計算**し、各ノードの画面座標 `{x, y, w, h}` を確定させる。演出はこの座標を **パラメータとして受け取って動く**。座標をハードコードしない。

```ts
type NodeLayout = {
  matchId: number;
  bracket: 'winner' | 'loser' | 'grand_final';
  round: number;
  slot: 0 | 1;                 // 上段/下段
  teamId: string | null;
  rect: { x: number; y: number; w: number; h: number };
  center: { x: number; y: number };
  connectorTo?: number;        // 次に繋がるノード
};
```

### 5.2 演出への供給
- 線の伸長 → `from.center` から `to.center` へ描画。
- 衝突点 → 2線の合流座標から算出。
- 爆発の発生位置 → 衝突点。
- VS画面の顔 → 当該ノードの `teamId` → `team_members` → 顔写真。

**結論: レイアウト計算さえ座標を返せば、当日配置が変わっても演出は自動追従する。** これが「その場で決まった配置に演出を当てはめられるか？」への技術的な答え。

### 5.3 描画手段
- トーナメントの線・ノード枠は **SVG**（座標計算と相性が良い）。
- レスポンシブはSVG viewBox基準。表示端末は固定解像度想定なので過度に作り込まない。

---

## 6. レイヤー構成（z順）

| z | レイヤー | 技術 |
|---|---|---|
| 0 | 背景動画（ループ） | `<video>` / WebM |
| 1 | トーナメント表（線・ノード枠） | SVG |
| 2 | 顔写真＋名前 | DOM/CSS（SVG foreignObject可） |
| 3 | 線の衝突アニメ | SVG + GSAP |
| 4 | 爆発エフェクト | アルファWebM or PixiJS |
| 5 | 全画面VS演出 | DOM/CSS + GSAP（必要に応じPixiJS） |

- レイヤーはCSS `position` と `z-index` または単一PixiJS Stageの子で管理。
- 重い合成（背景動画＋パーティクル＋DOM）が同時に走るので、各レイヤーの表示/非表示で負荷を制御する。

---

## 7. 演出技術

### 7.1 振り付け（GSAP timeline）
1つのtimelineに「線伸長 → 衝突 → 爆発トリガ → VS表示 → 余韻 → クローズ」を並べる。
- 各ステップは尺・イージングを `02_DESIGN_REQUIREMENTS.md` の指定に合わせる。
- `timeline.totalProgress(1)` で **スキップ**可能にする。

### 7.2 爆発
- 第1候補: アルファ付きWebMを衝突点に重ねて再生（質感が出しやすい）。
- 第2候補: PixiJSのパーティクル（素材調達なしで実装可能）。
- どちらも **事前プリロード必須**（未ロード再生は禁止）。

### 7.3 VS画面
- テンプレは素体（顔・名前なし）として固定。実行時に顔写真と名前を流し込む。
- 2v2レイアウト（`⭕️⭕️ vs ◯◯`）。欠員時はプレースホルダ。

---

## 8. カメラ／顔トリミング

- `navigator.mediaDevices.getUserMedia({ video:true })` で撮影。
- 撮影後、face-api.js / MediaPipe で顔バウンディングボックスを取得し、**統一アスペクト比（例 1:1）でクロップ**。
- クロップ後画像をStorageへアップロード。原画像も保持（再トリミング用）。
- 顔検出失敗時は手動トリミング or ガイド枠中央クロップにフォールバック。

---

## 9. メディア管理・プリロード

- 演出開始前に **全素材（背景動画/爆発/Lottie/当該試合の顔写真）をプリロード**。
- ロード完了をPromiseで待ってから演出を発火（要件§7 非機能のライブ性）。
- 素材命名規則・配置は `03_CURSOR_PROJECT_RULES.md` に従う。
- 顔写真はチーム確定時点で先読みキャッシュしておく。

---

## 10. パフォーマンス要件

- 表示端末: 1080p / 60fpsを目標（演出ピーク時は最低30fps維持）。
- 同時に動かす重い要素を絞る（VS表示中は背景動画を停止/減光する等）。
- 画像は表示サイズに最適化（顔写真は過大解像度を持ち込まない）。
- 計測: ChromeのPerformanceで本番リハ時にフレーム落ちを確認。

---

## 11. エラーハンドリング・復帰

- 両端末ともリロードで `bracket_snapshot` から状態復元（必須）。
- Realtime切断時は自動再接続し、再接続後にDBから最新を再読込。
- 勝敗入力は **冪等(idempotent)** に。二重送信で状態が壊れないよう、適用前に対象matchの状態を検証。
- 演出再生失敗時も進行データは壊さない（演出と状態更新を分離）。

---

## 12. セキュリティ・権限

- 運営者限定の簡易運用前提。`/admin` への簡易ガード（環境変数のパスコード等）でMVPは十分。
- Supabase RLSは最低限（イベント単位の読み書き）を設定。
- 肖像データは当日限り。終了後削除導線を用意。公開URLは表示端末からの参照に限定する設計を意識。

---

## 13. 環境変数・デプロイ

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 等を `.env` 管理（コミット禁止）。
- Vercelデプロイ。表示端末はデプロイURLをChromeキオスクで開く。
- 本番前に必ず会場ネットワークで疎通・遅延を確認。

---

## 14. テスト方針

| 対象 | 種別 | 重要度 |
|---|---|---|
| ブラケット進行ロジック | 単体(Vitest) | 最高（バグ＝進行崩壊） |
| 座標レイアウト計算 | 単体 | 高 |
| Realtime同期 | 結合/手動 | 高 |
| 演出タイムライン | 手動/リハ | 中 |
| 顔トリミング | 手動 | 中 |
