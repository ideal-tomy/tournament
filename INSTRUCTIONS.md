# INSTRUCTIONS.md — Phase 0–2 セットアップ＆実装指示書

> 対象: Cursor（実装AI）。本書の手順どおりに **Phase 0 → 1 → 2** を順に実装する。
> 上位ドキュメント `00_REQUIREMENTS.md` / `01_TECH_REQUIREMENTS.md` / `02_DESIGN_REQUIREMENTS.md` /
> `03_CURSOR_PROJECT_RULES.md` の原則に従う。**演出(Phase5)は本書の範囲外。先に作らない。**
>
> 同梱ファイル:
> - `0001_init.sql` … Supabaseマイグレーション（`supabase/migrations/0001_init.sql` に配置）
> - `layout.ts` … 座標計算の雛形（`src/features/bracket/layout.ts` に配置）

---

## 0. このスプリントのゴール（Phase 0–2 統合Done）

「演出ナシ」で次が動く状態にする。

1. 操作端末(`/admin`)で押した操作が表示端末(`/display`)にRealtimeで届く（Phase0）。
2. カメラで顔写真を撮り、トリミングして参加者をDB登録・一覧できる（Phase1）。
3. 「抽選」でランダムなペアが組まれ、ダブルイリミのブラケットが生成され、
   **各試合・各チーム枠の座標が取得でき、顔写真付きの静的トーナメント表が描画される**（Phase2）。

ここまで出来たら、次スプリントで進行ロジック(Phase3)→演出(Phase5)を上に乗せる。

---

## 1. 前提・事前準備

- Node.js 20 LTS。
- Supabaseプロジェクトを1つ作成（URLとanon keyを控える）。
- GitHub: `ideal合同会社` Org に新規リポジトリを作成してpush。
- パッケージは導入後にバージョンをロックする（`03_CURSOR_PROJECT_RULES.md` §2）。

---

## 2. プロジェクト初期化

```bash
npm create vite@latest darts-tournament -- --template react-ts
cd darts-tournament

# 依存
npm i @supabase/supabase-js
npm i brackets-manager brackets-memory-db
npm i react-router-dom
# 顔検出（どちらか。まずは MediaPipe を推奨）
npm i @mediapipe/face_detection @mediapipe/camera_utils
# 演出は後スプリントなので今は入れない: gsap pixi.js lottie-web

# 開発
npm i -D vitest @types/node tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- Tailwind: `tailwind.config.js` の `content` に `./index.html`,`./src/**/*.{ts,tsx}` を設定。
- `src/index.css` に Tailwind ディレクティブを追加し、日本語フォントに **Noto Sans CJK JP** を指定（`03` §9）。

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { font-family: "Noto Sans CJK JP", "Noto Sans JP", system-ui, sans-serif; }
```

---

## 3. 環境変数

`.env`（**コミット禁止**。`.gitignore`に追加）:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_PASSCODE=changeme   # /admin 簡易ガード(MVP)
```

---

## 4. フォルダ構成（この通りに作る）

```
src/
  main.tsx
  App.tsx                      # ルーティング
  index.css
  lib/
    supabase.ts
    realtime.ts
    media.ts                   # プリロード(Phase2では顔写真の先読み)
  types/
    index.ts                   # 共通型(Realtimeペイロード等)
  routes/
    AdminPage.tsx
    DisplayPage.tsx
    RehearsalPage.tsx
  features/
    registration/
      CameraCapture.tsx        # 撮影UI
      faceCrop.ts              # 顔検出→トリミング
      registrationApi.ts       # Supabase 読み書き
      ParticipantList.tsx
    draw/
      draw.ts                  # ランダムペア生成(純粋関数, テスト対象)
    bracket/
      manager.ts               # brackets-manager ラッパ
      layout.ts                # ★同梱ファイルを配置（座標計算, テスト対象）
      BracketView.tsx          # 静的トーナメント表(SVG)
supabase/
  migrations/
    0001_init.sql              # ★同梱ファイルを配置
```

---

## 5. Supabaseマイグレーション

同梱 `0001_init.sql` を `supabase/migrations/0001_init.sql` に置き、SupabaseのSQL Editorで実行（または `supabase db push`）。

作成物: `events` / `participants` / `teams` / `team_members`、Storageバケット `participant-photos`・`participant-faces`、MVP用RLS。
⚠ RLSは内部ツール前提の簡易許可。外部公開時は必ず絞る（SQL内コメント参照）。

---

## 6. Supabaseクライアント / Realtime

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

```ts
// src/types/index.ts
// Realtime ペイロード型（03 §5 の命名規則に対応）。any禁止。
export type RealtimeEvent =
  | { type: 'bracket:updated'; eventId: string }
  | { type: 'match:confirmed'; eventId: string; matchId: number; winnerTeamId: string; loserTeamId: string }
  | { type: 'effect:skip'; eventId: string }
  | { type: 'event:finished'; eventId: string };
```

```ts
// src/lib/realtime.ts
import { supabase } from './supabase';
import type { RealtimeEvent } from '../types';

export function eventChannel(eventId: string) {
  return supabase.channel(`event:${eventId}`, { config: { broadcast: { self: false } } });
}

// 送信(操作端末)
export async function broadcast(eventId: string, payload: RealtimeEvent) {
  const ch = eventChannel(eventId);
  await ch.subscribe();
  await ch.send({ type: 'broadcast', event: payload.type, payload });
}

// 購読(表示端末)
export function subscribe(eventId: string, handler: (e: RealtimeEvent) => void) {
  const ch = eventChannel(eventId);
  ch.on('broadcast', { event: '*' }, ({ payload }) => handler(payload as RealtimeEvent));
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}
```

---

## 7. ルーティング

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './routes/AdminPage';
import DisplayPage from './routes/DisplayPage';
import RehearsalPage from './routes/RehearsalPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/rehearsal" element={<RehearsalPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- `/admin` は `VITE_ADMIN_PASSCODE` による簡易ガードを入れる（MVP）。
- どの画面も **マウント時にDBから状態を復元**できるよう、`eventId` をURLクエリ or 単一アクティブイベント取得で解決する。

---

## 8. Phase 0 — 基盤＆Realtime疎通

**実装**
- `/admin` に「ping送信」ボタン、`/display` に受信表示エリアを仮置き。
- 押下で `broadcast(eventId, { type:'bracket:updated', eventId })`、表示側で `subscribe` して受信をログ表示。
- アクティブな `events` 行が無ければ作成するブートストラップ（`status='setup'`）。

**Phase 0 Done チェック**
- [ ] `/admin` と `/display` を別タブ/別端末で開ける
- [ ] `/admin` のボタン押下が `/display` に1秒以内で届く
- [ ] リロードしても落ちず、アクティブイベントを取得できる

---

## 9. Phase 1 — 参加者登録（顔撮影）

### 9.1 撮影 → トリミング → 保存の流れ
1. `getUserMedia({ video:true })` でプレビュー。顔ガイド枠を重ねる（`02` §4.1）。
2. キャプチャ → `faceCrop.ts` で顔検出し **1:1 でクロップ**（失敗時は中央クロップにフォールバック）。
3. 原画像を `participant-photos/{eventId}/{id}.jpg`、クロップを `participant-faces/{eventId}/{id}.jpg` にアップロード。
4. `participants` に name と各パスを保存。
5. 一覧（サムネ）に反映。撮り直し・削除可。

### 9.2 顔トリミング雛形

```ts
// src/features/registration/faceCrop.ts
// MediaPipe Face Detection でバウンディングボックスを取り、正方形にクロップ。
// 検出失敗時は中央正方形にフォールバック（レイアウトを崩さないことが最優先）。
export async function cropToSquare(
  source: HTMLCanvasElement | HTMLVideoElement,
  box?: { x: number; y: number; w: number; h: number }, // 顔BB(正規化前のpx)。無ければ中央
): Promise<Blob> {
  const sw = (source as HTMLVideoElement).videoWidth ?? (source as HTMLCanvasElement).width;
  const sh = (source as HTMLVideoElement).videoHeight ?? (source as HTMLCanvasElement).height;

  let cx: number, cy: number, size: number;
  if (box) {
    // 顔を中心に、顔幅の約1.6倍を正方形クロップ（髪・あごを含める）
    size = Math.min(sw, sh, Math.max(box.w, box.h) * 1.6);
    cx = box.x + box.w / 2;
    cy = box.y + box.h / 2;
  } else {
    size = Math.min(sw, sh);
    cx = sw / 2; cy = sh / 2;
  }
  const sx = Math.max(0, Math.min(sw - size, cx - size / 2));
  const sy = Math.max(0, Math.min(sh - size, cy - size / 2));

  const out = document.createElement('canvas');
  const OUT = 512;
  out.width = OUT; out.height = OUT;
  out.getContext('2d')!.drawImage(source, sx, sy, size, size, 0, 0, OUT, OUT);
  return await new Promise<Blob>((res) => out.toBlob(b => res(b!), 'image/jpeg', 0.9));
}
```

> MediaPipeのFaceDetectionから受け取る正規化座標(0..1)は `box.x*sw` 等でpxに変換して渡す。

### 9.3 保存API雛形

```ts
// src/features/registration/registrationApi.ts
import { supabase } from '../../lib/supabase';

export async function addParticipant(eventId: string, name: string, photo: Blob, face: Blob) {
  const { data: row, error } = await supabase
    .from('participants').insert({ event_id: eventId, name }).select().single();
  if (error || !row) throw error;

  const base = `${eventId}/${row.id}.jpg`;
  await supabase.storage.from('participant-photos').upload(base, photo, { upsert: true });
  await supabase.storage.from('participant-faces').upload(base, face, { upsert: true });
  await supabase.from('participants')
    .update({ photo_path: base, face_crop_path: base }).eq('id', row.id);
  return row.id as string;
}

export function faceUrl(path: string) {
  return supabase.storage.from('participant-faces').getPublicUrl(path).data.publicUrl;
}
```

**Phase 1 Done チェック**
- [ ] カメラ撮影 → 顔が揃った正方形サムネで登録される
- [ ] 一覧表示・撮り直し・削除ができる
- [ ] 検出失敗時も中央クロップで登録でき、落ちない

---

## 10. Phase 2 — 抽選＆ブラケット生成＆座標

### 10.1 ランダムペア生成（純粋関数・テスト対象）

```ts
// src/features/draw/draw.ts
export type DrawStrategy = 'trio' | 'bye'; // 奇数時の扱い

// participantIds をシャッフルしてチーム(配列)を作る。
export function makeTeams(participantIds: string[], strategy: DrawStrategy = 'trio'): string[][] {
  const ids = shuffle([...participantIds]);
  const teams: string[][] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) teams.push([ids[i], ids[i + 1]]);

  if (ids.length % 2 === 1) {
    const leftover = ids[ids.length - 1];
    if (strategy === 'trio' && teams.length > 0) teams[teams.length - 1].push(leftover); // 末尾を3名に
    else teams.push([leftover]); // bye: 1名チーム(初戦不戦勝として扱う)
  }
  return teams;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

### 10.2 チーム永続化 → ブラケット生成

手順:
1. `makeTeams` の結果を `teams` / `team_members` に保存（seedは配列順）。
2. **seeding には team.id(uuid) を name として渡す**（顔写真解決のキーになる。`layout.ts` の `resolveTeamId` がこの前提）。
3. チーム数が2のべき乗でない場合は **nullでパディング**（brackets-managerがBYE処理）。
4. `manager.get.stageData(0)` を `events.bracket_snapshot` に保存。

```ts
// src/features/bracket/manager.ts
import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';

// teamIds: teams.id(uuid) の配列（seed順）
export async function buildDoubleElimination(teamIds: string[]) {
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);

  // 2のべき乗にパディング(null=BYE)
  const size = 1 << Math.ceil(Math.log2(Math.max(2, teamIds.length)));
  const seeding: (string | null)[] = [...teamIds];
  while (seeding.length < size) seeding.push(null);

  await manager.create.stage({
    tournamentId: 0,
    name: 'Double Elimination',
    type: 'double_elimination',
    seeding,                                  // team.id(uuid) を name として格納
    settings: { grandFinal: 'double', seedOrdering: ['natural'] },
  });

  const data = await manager.get.stageData(0); // ← bracket_snapshot に保存する真実源
  return data;
}
```

> ⚠ brackets-manager はバージョンで API 差がある（create / seeding / snapshot）。
> 導入版の README で `create.stage` の引数・`get.stageData` の戻り値・GFリセット設定を必ず確認し、
> 食い違う場合は本書のコメント箇所を合わせて調整する（`03` §14: 推測で埋めない）。

### 10.3 座標計算 → 静的トーナメント表

- 同梱 `layout.ts` を `src/features/bracket/layout.ts` に配置。
- `computeBracketLayout(stageData)` の戻り値を使い、`BracketView.tsx` で **SVG** 描画する。

```tsx
// src/features/bracket/BracketView.tsx（描画の骨子）
import { computeBracketLayout, resolveTeamId, type StageData } from './layout';

export function BracketView({ data, faceUrlByTeamId }:{
  data: StageData;
  faceUrlByTeamId: Record<string, string[]>; // team.id -> 顔URL配列(2 or 3名)
}) {
  const L = computeBracketLayout(data);
  return (
    <svg viewBox={`0 0 ${L.width} ${L.height}`} className="w-full h-full">
      {/* コネクタ線 */}
      {L.connectors.map((c, i) => (
        <line key={i} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
              stroke="currentColor" strokeOpacity={0.5} />
      ))}
      {/* 試合ボックス */}
      {L.matches.map(m => (
        <g key={m.matchId}
           data-bracket={m.bracket} /* winner/loser/grand_final で配色分け(02 §5) */>
          {m.slots.map(s => {
            const teamId = resolveTeamId(s.teamRef, data.participant);
            const faces = teamId ? faceUrlByTeamId[teamId] ?? [] : [];
            return (
              <g key={s.slot}>
                <rect x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h}
                      fill="none" stroke="currentColor" />
                {/* 顔写真(顔URL)と名前を foreignObject/CSS で描画。
                    teamId が null の枠は placeholder_face を表示(欠員/未確定/BYE) */}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
```

- 各試合ボックスの `m.center` / 各 `slot.center` の座標は、後の演出（線の衝突・爆発・VS）が参照する。**Phase2の時点で座標が正しく取れていることが最重要**。
- 顔URLは `faceUrlByTeamId` に `team.id → 顔URL[]` を用意して渡す（`team_members` → `participants.face_crop_path` → `faceUrl()`）。
- 顔写真は事前先読み（`lib/media.ts`）してから表示するとちらつかない。

**Phase 2 Done チェック**
- [ ] 「抽選」でランダムなペアが組まれ、奇数も `odd_strategy` どおり処理される
- [ ] ダブルイリミのブラケットが生成され `bracket_snapshot` に保存される
- [ ] `computeBracketLayout` が WB/LB/GF を含む座標を返す（**Vitestで単体テスト**）
- [ ] `/display` に顔写真付きの静的トーナメント表（演出ナシ）が描画される
- [ ] 表示端末をリロードしても `bracket_snapshot` から同じ表が復元される

---

## 11. テスト（Phase 2 必須・`03` §12）

`vitest` で純粋ロジックを担保する。最低限:

- `draw.test.ts`: 偶数/奇数(trio・bye)で正しいチーム構成になる。
- `layout.test.ts`: 4/8/16チームで `computeBracketLayout` が
  - WB/LB/GF すべての match を返す
  - 同一 (bracket,round) 内で y が重ならない
  - viewBox の width/height が全ボックスを内包する
  - `slot.center` / `match.center` が box 内にある

```bash
npx vitest run
```

---

## 12. ハマりどころ（先回りメモ）

- **brackets-manager のAPI差**: バージョンで `create`/seeding/snapshot が違う。導入版に合わせる（§10.2の警告）。
- **顔写真の対応付け**: seeding に team.id(uuid) を渡す前提を崩さない。崩すとVSに顔が出せない。
- **奇数人数**: `odd_strategy` を `events` に保存し、抽選・表示の両方で一貫させる。
- **座標のハードコード禁止**（`03` §1,§3）: 表示は必ず `computeBracketLayout` 経由。
- **演出を先に作らない**: Phase2は「静的表＋正しい座標」で止める。線の衝突/爆発/VSはPhase5。
- **真実源はSupabase**: 画面ローカルstateを真実源にしない。リロード復元を常に確認。
- **顔写真プリロード**: 表示前に先読み。未ロード表示はちらつき/演出破綻の元。

---

## 13. 次スプリント予告（本書の範囲外）

- Phase 3: 進行ロジック（`bracket_snapshot` を `InMemoryDatabase.setData` で再水和 → 勝敗入力 → 勝者前進/敗者LB落とし/GFリセット → undo → Realtime同期）。
- Phase 4–5: 静的表の作り込み → 演出（GSAPタイムライン / 爆発 / VS画面、すべて座標駆動）。
