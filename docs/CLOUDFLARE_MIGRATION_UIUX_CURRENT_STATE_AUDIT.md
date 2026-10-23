# Cloudflare移行・UI/UX・演出 現状調査レポート

- 調査日: 2026-10-12
- 対象: 現在のリポジトリ全体（React/Vite、Supabase、演出、運営画面、Display）
- 目的: Cloudflare移行前に現行仕様を固定し、本番向け演出制作で先に解消すべき問題を整理する
- この文書の範囲: 調査・評価・移行方針。実装変更は含まない

## 1. 結論

現行アプリは大会ロジック、シーン状態、Display表示を分ける基本構造があり、抽選・結果・NEXT MATCHの演出も主系統では動く形になっている。TypeScriptビルドと既存60テストも成功している。

ただし、本番投入前に優先すべき問題がある。

1. **認証・認可が本番水準ではない**: Adminパスコードはブラウザへ配布され、Supabaseの匿名キーにはほぼ全テーブル・Storageへの更新権限がある。
2. **大会進行更新が原子的でない**: ブラケット更新、matches同期、scene更新が複数リクエストに分かれ、複数Admin・再送・通信断で中間状態が残り得る。
3. **Display自身がDBのシーンを進める**: 抽選や結果演出の終了時に表示端末が永続状態を書き換えるため、複数Displayで競合し得る。
4. **優勝演出が未完成**: 最終結果後は `FINISHED` の文字だけで、`championTeamId` を受け取っても顔・名前・表彰演出に使っていない。
5. **演出素材が重い**: 常時プリロード対象だけで約23.3 MiBあり、初回開始が通信品質に依存する。
6. **旧演出系統が残存**: 現在のシーン方式とは別の `EffectOrchestrator` 系が未使用のまま残り、今後の改修対象を誤る危険がある。
7. **演出のブラウザE2Eテストがない**: タイミング計算の単体テストはあるが、画像ロード、GSAP、音、画面遷移を実ブラウザで保証できていない。

Cloudflare移行は「Supabase APIをD1へ差し替える」作業ではなく、**ブラウザ直結型からWorker API中心へ境界を引き直す本番化**として行うべきである。

推奨構成は次のとおり。

```text
React/Vite SPA（運営・Display）
  ├─ 静的配信: Cloudflare Workers Static Assets
  ├─ HTTP API: Cloudflare Worker
  │    ├─ D1: 大会・参加者・チーム・試合・シーン・操作ログ
  │    └─ R2: 顔写真・元写真・広告メディア
  └─ WebSocket: Event単位のDurable Object
       ├─ シーン更新の直列化
       ├─ Admin/Displayへの配信
       └─ 再接続時の最新scene_seq提示
```

## 2. 調査方法と確認範囲

実施済み:

- `src/` 全体、SQLマイグレーション、既存演出調査文書を確認
- Supabase呼び出し、Storage、Realtime、GSAP、timer、CSS animationを横断検索
- Node 22.18.0で `npm test`: **14ファイル、60テストすべて成功**
- Node 22.18.0で `npm run build`: **成功**
- 1440×1000のHeadless Chromeで `/` と `/presentation` を実描画
- public演出素材の存在、解像度、容量を確認
- CloudflareとSupabaseの現行公式ドキュメントを確認

未確認:

- 実Supabase環境を使うAdmin → 抽選 → Display → 全試合完走のE2E
- 1920×1080会場モニター、4K、縦長・小型端末での実機表示
- 音響設備での音量・遅延・コーデック確認
- 低速回線、瞬断、複数Display、複数Adminの負荷・競合試験
- RLSが本番Supabaseへどのマイグレーション順で適用済みか

したがって、この文書では指摘を次のように区別する。

- **確定**: コード・SQL・ビルド・テストから再現条件を特定できる
- **高確率**: 実装上のリスクが明確だが実データE2Eが必要
- **要実機**: 視聴体験、音、フレーム落ちなど環境依存

## 3. 現在のシステム構成

### 3.1 画面

| Route | 役割 | 状態 |
|---|---|---|
| `/` | 体験メニュー・各画面への入口 | 実描画確認済み |
| `/admin` | 参加者登録、抽選、試合進行、メディア、シーン、終了 | Supabase必須 |
| `/display` | 会場表示、ブラケット、抽選、結果、NEXT MATCH | Supabase必須 |
| `/demo` | サンプル大会の操作・表示一体型 | Supabase必須 |
| `/rehearsal` | サンプルデータ作成と通し確認 | Supabase必須 |
| `/presentation` | 約90秒の操作説明 | 実描画確認済み |

### 3.2 現在の主データフロー

```text
Admin操作
  ↓ ブラウザからsupabase-jsで直接CRUD
Supabase Database / Storage
  ↓ Postgres Changes + 1.5秒polling
Display useEventState
  ↓ scene + scene_seqで表示を選択
DrawScene / ResultScene / VsCardScene / BracketView
```

主要な真実源は二重になっている。

- 大会進行計算: `events.bracket_snapshot`（brackets-managerのexport）
- Display用試合行: `matches`
- 表示状態: `event_state`

`bracket_snapshot` 更新後に `matches` を同期し、その後 `event_state` を更新する。現状は一つのトランザクションではない。

### 3.3 Realtime

現在は2系統ある。

- 主系統: `event_state` のSupabase Postgres Changes + 1.5秒polling
- 補助系統: `lib/realtime.ts` のBroadcast。Adminの疎通Pingなどで利用

pollingがあるためRealtime断でも最終的には追従しやすいが、各Displayが1.5秒ごとにDBを読む。Cloudflare移行後はWebSocket再接続時に最新状態を取得する方式へ整理できる。

## 4. 現在の演出フロー

### 4.1 抽選（full）

現行主系統は `DrawScene.tsx` の単一GSAP timeline。

```text
TEAM DRAW intro
  ↓
メンバー1: カード登場 → ダーツ → impact → 2秒保持 → 裏面効果消去
          → 反転 → 顔・名前 → 退場
  ↓
メンバー2以降も同様
  ↓
PAIR/TEAM CONFIRMED → 7秒保持
  ↓
次チーム
  ↓
全チーム一覧 → 2.2秒保持 → bracket
```

タイミングは `drawAnimationTiming.ts` に集約されており、過去の「顔写真に穴が残る」「ペア確認時間がない」は現行コードでは修正済み。

- impact markはカード裏面DOMの内側
- 反転前にダーツ・軌跡・impact・穴を明示的に非表示
- ペア確定画面は7秒保持
- full / short / liteを分岐

32名・16チームのfull演出は計算上約 **324秒（約5分24秒）**。大会進行上許容するか、8名用と32名用でプリセットを分けるべきである。

### 4.2 試合結果から次試合

```text
Adminが勝者確定
  ↓
bracket_snapshot更新 → matches同期 → scene=result
  ↓
ResultScene 5.8秒
  ↓
次試合あり: scene=vs_card（最低5秒、Admin close待ち）
最終試合: scene=finished
  ↓
AdminがNEXT MATCHを閉じる → match_live
```

以前の文書にある「結果後にbracketへ戻り、NEXT MATCHは別操作」という記述は現在は古い。現行 `ResultScene` は通常、結果から直接 `vs_card` へ遷移する。

### 4.3 旧演出系統

以下は互いに参照しているが、Routeや現行Displayから到達しない旧系統である。

- `EffectOrchestrator.tsx`
- `PresentationStage.tsx`
- `useMatchEffect.ts`
- `timeline.ts`
- `LineCollision.tsx`
- `WinnerLayer.tsx`
- `TeamPairLayer.tsx`
- `ExplosionVideo.tsx`
- `ReturnFlashLayer.tsx`
- 関連CSSの多数の `effect-*`

過去文書の「線伸長→衝突→爆発→VS」はこの旧系統を説明している部分が多い。現在の主系統は `ResultScene → VsCardScene` であり、線伸長・衝突WebMは実際の試合進行から呼ばれていない。

これは本番演出を作り込む前に決めるべき重要事項である。

- 旧系統を復活・統合するのか
- 新シーン系統を唯一の演出基盤として旧系統を削除するのか

推奨は後者。必要な「衝突・爆発・線」を新シーン側へ再設計して移植する。

## 5. バグ・本番阻害要因

### P0: 本番前に必須

#### P0-1. Admin認証はセキュリティ境界になっていない（確定）

`useAdminPasscode.ts` は `VITE_ADMIN_PASSCODE` を参照する。Viteの `VITE_*` はブラウザへ埋め込まれるため、閲覧者は値を取得できる。また認証済み状態は `sessionStorage` のフラグだけである。

さらにSQLでは `anon` にevents、event_state、participants、teams、matches、メディア、Storageを含む広範なCRUDを許可している。Admin画面を隠してもAPIを直接操作できる。

影響:

- 大会結果やシーンを第三者が変更可能
- 顔写真の閲覧・上書き・削除が可能
- 大会終了後の状態を戻せる
- 操作ログ自体も信頼できない

Cloudflare移行時は、ブラウザへDB資格情報や管理秘密を配らず、Worker側でAdminセッションとevent単位の認可を検証する。

#### P0-2. 大会進行が複数書き込みに分割される（確定）

`confirmMatchResult()` は次の順に別々の通信を行う。

1. events読込
2. brackets-managerでローカル計算
3. events更新
4. matchesを複数insert/update/delete
5. event_state更新

途中失敗時のrollbackがなく、同時操作に対するversion条件もない。二重クリックはUIの `busy` で抑えるが、複数タブ・複数Admin・再送には効かない。

Cloudflareでは大会event単位のDurable Objectでコマンドを直列化し、D1のbatch/トランザクションで永続化をまとめる。最低でも `expected scene_seq` またはversionを全更新条件へ含める。

#### P0-3. Displayが永続シーンを更新する（確定）

`DrawScene` と `ResultScene` はタイムライン完了時にDBのsceneを変更する。複数Displayがあると全端末が同じ遷移を書き込もうとする。

`ResultScene` は `scene + scene_seq` 条件付き更新でかなり防御されているが、`DrawScene` は通常の `transitionScene(..., force: true)` で、現在状態を取得してから更新するため競合余地が大きい。

推奨:

- 永続シーンの進行主体をWorker/Durable ObjectまたはAdminに限定
- Displayは受信・再生・再同期のみ
- 演出完了通知が必要なら冪等なackとして送る

#### P0-4. 優勝・表彰体験が未完成（確定）

最終試合後、`ResultScene` は `championTeamId` をpayloadへ渡して `finished` にするが、Displayのfinished表示は中央の `FINISHED` だけ。優勝チームの顔、名前、トロフィー、最終ブラケット、表彰プレイリストへの導線がない。

本番演出の終点として、次を独立した `ChampionScene` にする。

- WINNERからCHAMPIONへの格上げ
- 優勝チーム名・全メンバー写真
- 最終結果と大会タイトル
- 紙吹雪・照明・専用SE/BGM
- 自動終了せずAdmin操作待ち
- awardシーンまたは表彰メディアへの明示遷移

#### P0-5. 肖像データ削除が部分完了し得る（確定）

大会終了処理はeventsをfinishedにしてsceneを変更した後、複数Storage bucketとテーブルを順次削除する。途中失敗すると「終了済みだが写真が残る」「一方のbucketだけ残る」状態になる。

R2移行後は削除ジョブを冪等化し、削除状態と再試行回数をDBに記録する。顔cropだけでなく元写真、参加者行、キャッシュも削除確認対象にする。

### P1: 演出制作開始前に解消

#### P1-1. 新旧演出コードの二重化（確定）

旧 `EffectOrchestrator` 系は主画面から未使用だが、関連テストと約500行超のCSSが残る。過去ドキュメントも旧系統と新系統が混在している。

影響:

- 修正したのに本番画面へ反映されない
- 使われない大規模CSSの維持
- 演出仕様の認識違い

新シーン系を唯一の主系統とする決定記録を作り、旧系統は必要要素を移植後に削除する。

#### P1-2. 23.3 MiB一括プリロード（確定）

`handleStart()` は演出画像と音声をすべて待ってからDisplayを開始する。素材合計は約23.3 MiBで、PNGの多くが1.2〜2.3 MiB、1024〜1536pxである。

問題:

- 会場回線で開始待ちが長くなる
- 進捗表示は実測ではなく30%→100%の2段階
- 必須画像1件の失敗で `await` がrejectし、開始状態へ進めない
- `handleStart` にcatchがなく画面内エラーを表示しない

対策:

- PNGをWebP/AVIFへ変換し、透過が必要なものだけ最適形式を選ぶ
- critical（最初のscene）とlazy（次scene）へ分割
- 件数・byteベースの実進捗
- 再試行、スキップ、素材ごとのfallback
- デプロイ時にasset存在・容量budgetを検査

#### P1-3. 音声アンロックの保証が弱い（高確率）

開始クリックでAudioContextをresumeしてすぐcloseし、実際のSEは後で毎回 `new Audio()` して再生する。再生失敗はcatchして無視するため、無音でも運営側に分からない。

対策:

- 共有AudioContextまたは事前生成したHTMLAudioをユーザー操作中にunlock
- 音声テストボタンと音量メーター
- muted/blocked状態をDisplayヘッダーまたはAdminに通知
- SEごとのgain設定と会場用master volume

#### P1-4. 実ブラウザの演出テストがない（確定）

既存テストはロジック中心で、Vitest環境はnode。GSAP DOM、画像ロード、音声、scene遷移の視覚結果を保証していない。

最低限のPlaywrightシナリオ:

1. Display開始とプリロード成功/失敗
2. full抽選で裏面効果が反転前に消える
3. 2名のPAIR CONFIRMEDが7秒保持される
4. result → vs_card → match_live
5. 最終試合 → ChampionScene
6. 演出途中リロードから正しい最終状態へ復帰
7. forceComplete連打、複数Display、WebSocket切断復帰
8. 1920×1080のスクリーンショット差分

#### P1-5. reduced motion未対応（確定）

`full/short/lite` はあるが `prefers-reduced-motion` を見ていない。操作説明ページを含め、多数の無限CSS animationが動く。

対策:

- OS設定時は自動でlite、または動きと点滅を減らす
- Adminで会場用モードを上書き可能にする
- 点滅頻度、画面全体flash、shakeの安全基準を設ける

#### P1-6. kioskでも技術ヘッダーが常時残る（確定）

`kiosk=1` はカーソルとホームリンクを消すだけで、タイトル、scene名、接続状態、scene_seq、イベントID、上下の余白は表示される。会場映像としてはデバッグ情報が強い。

本番kioskでは演出キャンバスを完全な16:9全画面にし、接続状態は異常時だけ控えめに表示する。技術情報はクエリまたはショートカットで開くdiagnostic overlayへ移す。

### P2: ブラッシュアップ

#### P2-1. 抽選fullの総尺（確定）

32名では約5分24秒に加え、素材ロードとDB遷移時間がかかる。7秒のペア確認自体は意図どおりだが、全体として間延びする可能性がある。

推奨プリセット:

- 8名: cinematic full
- 16名: full compact
- 32名: pair revealを維持し、個人ごとのimpact holdを短縮
- 当日遅延時: short

Adminに推定総尺を表示する。

#### P2-2. ResultSceneの情報量と因果が弱い（確定）

現行は勝者拡大、敗者縮小、花吹雪が中心。旧仕様にあった「ブラケット上の進出」「衝突→VS」の物語は主系統から消えている。

本番向けには次を検討する。

- WIN表示後、勝者カードが進出先へ移動
- 更新済みブラケットを1〜2秒見せる
- そこから次の対戦者を取り出してNEXT MATCHへ接続
- 同じ顔を消して再登場させない共有トランジション

ただしReact mountとGSAP imperative制御を混ぜた旧構造は復活させず、単一timelineまたは明示的scene内substateで作る。

#### P2-3. VS画面の小画面耐性（高確率）

`VsCardScene` は左右固定配置、顔136px、VS 144px、team plate最小幅256pxで、モバイルbreakpointがない。Displayは大画面前提でも、リハーサルや運営確認をノートPCで行うため、狭幅では圧迫される。

16:9会場を基準にしつつ、1280×720、1366×768、1920×1080、4Kでvisual regressionを持つ。

#### P2-4. 顔写真のaltとプレゼンテーション意味（確定）

抽選では氏名altがあるが、Result/VSの顔写真は空alt。画面全体の意味を読み上げるlive regionもない。会場表示は装飾扱いでも、Adminや説明画面はキーボード操作・focus表示を含むアクセシビリティ確認が必要。

#### P2-5. 外部メディアURLの扱い（確定）

任意URLをiframeへそのまま渡している。通常のYouTube watch URLはembed向けではなく、X-Frame-Options/CSPや自動再生制限で失敗し得る。エラーUIやfallbackもない。

許可provider、URL正規化、embed URL生成、タイムアウト、ポスター画像、失敗時の次項目スキップを実装する。

#### P2-6. メディア並び替えは二段階更新（確定）

playlist itemのorderを2回のupdateで交換するため、途中失敗で重複・不整合が起きる。D1移行時にbatchへまとめる。

#### P2-7. 画像登録の孤児データ（確定）

参加者行を先にinsertし、その後2ファイルを順番にuploadする。途中失敗時に参加者行または片方のファイルが残る。削除もStorageエラーを確認していない。

Workerでupload intentを発行し、完了commitまたはcleanupを行う状態モデルへ変更する。

## 6. Cloudflare移行マッピング

| 現在 | Cloudflare案 | 注意点 |
|---|---|---|
| Vite SPA / Vercel | Workers Static Assets | SPA fallbackを設定 |
| Supabase Data API | Worker JSON API + D1 binding | ブラウザからD1へ直接接続しない |
| PostgreSQL | D1（SQLite） | 生のPostgres dumpは直接import不可。型・SQL変換が必要 |
| Supabase Storage | R2 | 顔写真はprivate bucket + Worker経由を推奨 |
| Public Storage URL | Worker配信またはR2 custom domain | `r2.dev` は本番用にしない |
| Postgres Changes | Event Durable Object WebSocket | Hibernation APIを利用 |
| Realtime Broadcast | 同上 | eventIdごとに1 object |
| RLS | Worker認可 | event role、Admin session、Display read token |
| SQL trigger | Worker command / D1 batch | app層の明示処理へ寄せる |
| operation_log | D1 append-only audit | actor、requestId、versionを追加 |

Cloudflare公式情報上、D1はSQLite系で、PostgreSQLの型とSQLをそのまま移せない。またD1 bindingの `batch()` は複数statementを順序実行し、失敗時はbatch全体をrollbackできる。Durable ObjectsのHibernation WebSocket APIは、接続を維持しながらidle時の実行コストを抑える推奨方式である。

### 6.1 D1スキーマ変換で必要な作業

- `uuid default gen_random_uuid()` → WorkerでUUID生成
- `timestamptz` → ISO 8601 TEXTまたはepoch INTEGERへ統一
- `jsonb` → JSON TEXT +必要列の正規化
- `numeric(p,s)` →用途に応じINTEGER（レーティング×100等）またはREAL
- `bigserial` → INTEGER PRIMARY KEY等へ変更
- PL/pgSQL trigger/function → Worker commandへ移動
- `distinct on`、partial index、Postgres固有viewの再設計
- RLS/GRANT → Worker middlewareの認可テストへ変更

### 6.2 推奨API境界

```text
POST /api/admin/session
GET  /api/events/:eventId/state
POST /api/events/:eventId/commands/register-participant
POST /api/events/:eventId/commands/commit-draw
POST /api/events/:eventId/commands/confirm-result
POST /api/events/:eventId/commands/undo
POST /api/events/:eventId/commands/transition-scene
POST /api/events/:eventId/media/upload-intent
GET  /api/events/:eventId/ws
```

すべての変更コマンドへ以下を持たせる。

- `requestId`（冪等性）
- `expectedVersion` または `expectedSceneSeq`
- actor/session
- eventId
- command payload

### 6.3 Durable Objectの責務

Event単位のDurable Objectは、DBの代替ではなく**調停者**として使う。

- 同一eventの進行コマンドを直列化
- 現在のscene/versionをキャッシュ
- Admin/DisplayへWebSocket配信
- 接続直後に最新snapshotを送信
- 重複requestIdを拒否または同じ結果で応答
- D1永続化成功後だけbroadcast

顔写真や大きいsnapshotをWebSocketメッセージへ毎回含めず、ID/versionと必要差分を送る。

## 7. UI/UXの現状評価

### 良い点

- トップ画面は目的別カードで入口が明確
- AdminとDisplayのevent ID不一致を警告する設計がある
- full/short/lite、force complete、rehearsal、undoなど当日運用を意識している
- Display開始をユーザー操作にして音声制約へ対応しようとしている
- sceneとscene_seqでリロード復帰・古い更新拒否を設計している
- 抽選タイミングが定数化され、ロジックテストがある
- ブラケットレイアウトにまとまったテストがある

### 改善が必要な点

- トップは「デモ」と「本番運営」が同列で、事故防止の環境表示が弱い
- Adminタブが多く、試合当日の主要操作と設定系が混在
- 非同期保存の成功・失敗が表示されない箇所がある（大会タイトル等）
- Displayの正常時にも接続・seq・IDが常時露出
- scene切替中のcrossfade/pending表現が統一されていない
- エラー時に「再試行」「素材を飛ばす」「前sceneへ戻す」の標準導線がない
- 本番用の演出プレビュー、timeline scrub、音量調整、safe area表示がない

## 8. 本番演出を作り込む際の設計原則

1. **永続sceneとscene内animationを分ける**  
   DB/DOには `result` など粗いsceneだけを保存し、0.2秒単位のphaseは一つのコンポーネント内timelineで完結させる。

2. **一つのsceneに一つの時間の真実源**  
   GSAP timeline、React mount条件、複数setTimeoutを同じ演出で競合させない。

3. **素材未ロードでも必ず進行可能**  
   画像・動画・音声にはposter/CSS/無音fallbackを持つ。

4. **同一主体を連続して見せる**  
   顔カードを消して別コンポーネントで再出現させるのではなく、共有舞台上で位置・scale・背景を遷移させる。

5. **運営操作は冪等**  
   二重クリック、再接続、複数タブでも結果が一度だけ確定する。

6. **演出尺をデータ化**  
   参加人数・会場進行に応じたpresetを用意し、Adminに総尺を表示する。

7. **視覚回帰を成果物にする**  
   主要sceneの1920×1080スクリーンショットと動画をPRごとに比較する。

## 9. 推奨実装フェーズ

### Phase 0: 現行仕様の固定（先行必須）

- 現行主系統を `DrawScene / ResultScene / VsCardScene` と正式決定
- 旧EffectOrchestrator系の廃止または移植対象を決定
- 8名・16名・32名の期待動画を撮影し、受入基準にする
- Cloudflare移行中も使うdomain modelとAPI型をSupabase SDKから分離

### Phase 1: セキュリティ境界

- Worker API、Admin session、Display read token
- ブラウザからの直接DB/Storage更新を停止
- commandのrequestId/version検証
- portrait access policyと削除監査

### Phase 2: D1/R2基盤

- SQLite互換スキーマとmigration
- repository層実装
- R2 upload/download/delete
- Supabase export → 変換 → D1 importのリハーサル
- 件数、FK、画像objectの照合スクリプト

### Phase 3: Realtime

- Event Durable Object
- WebSocket Hibernation
- 再接続snapshot、heartbeat、version gap検知
- 複数Display・複数Admin試験

### Phase 4: 演出基盤整理

- 旧系統除去
- ChampionScene追加
- kiosk 16:9 canvasとdiagnostic overlay分離
- asset manifest、段階プリロード、音声管理
- reduced motionとfallback

### Phase 5: 本番演出制作

- Draw、Result、Bracket advance、NEXT MATCH、Championを一本の体験として調整
- 専用SE/BGM、音量preset
- 1080p/4K visual regression
- 低速回線・素材欠損・reload・skipのE2E

### Phase 6: 切替

- read-only shadowでSupabaseとCloudflareの結果比較
- リハーサル大会をCloudflareで完走
- データ凍結、最終export/import、整合性確認
- rollback条件と旧Supabase保持期間を決定

## 10. 受入基準案

本番準備完了と判断する最低条件:

- Admin secretがクライアントbundleに存在しない
- 未認証ユーザーが更新APIとportrait原本へアクセスできない
- confirm resultを同時送信しても一度だけ反映される
- 2台以上のDisplayが同じscene/versionへ収束する
- WebSocket切断後、再接続で3秒以内に最新状態へ復帰する
- 32名大会を開始からChampionまで自動E2E完走できる
- 1920×1080で全主要sceneのvisual regressionが通る
- 素材1件欠損・音声blockedでも進行が止まらない
- portrait purgeが再試行可能で、残存objectを照合できる
- ChampionSceneが優勝者の顔・名前を表示し、Admin操作まで保持する

## 11. 公式資料

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare SPA routing: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Cloudflare D1 Worker API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare D1 database/batch: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare D1 import/export（PostgreSQL非互換の注意を含む）: https://developers.cloudflare.com/d1/best-practices/import-export-data/
- Cloudflare Durable Objects WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare R2 public buckets: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Supabase breaking changes: https://supabase.com/changelog?types=breaking-change

## 12. 次に決めるべき事項

実装に入る前に、次の3点をプロダクト判断として確定する。

1. 旧「線伸長→衝突→爆発→VS」を新シーン系へ再実装するか
2. Admin認証をCloudflare Accessに限定するか、アプリ内ログインも用意するか
3. 顔写真をDisplayから直接読める公開URLにするか、期限付き/Worker認可配信にするか

推奨は、旧演出の見せ場だけを新シーンへ移植し、Adminはアプリ内session + 必要に応じAccess、顔写真は非公開R2をWorker経由で配信する構成である。
