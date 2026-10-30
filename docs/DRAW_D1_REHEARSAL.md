# 登録参加者 → 既存Draw → 確定ペア → D1 → Bracket

最新：受付からChampionまでの接続を公開しました。[連続した大会運営の手順・通常大会4名の状態・公開7試合完走結果](TOURNAMENT_FLOW.md) を参照してください。以下は前段の実装・検証記録です。

確認日：2026-10-25 JST。既存のペア編成・演出・Bracket生成を再利用する接続を実装し、通常受付Workerと検証Workerに公開しました。通常大会での実参加者4名による最終確認状況は「通常大会の公開確認」節を参照してください。

## 公開URL

| 用途 | 通常大会 `cf-rehearsal-001` |
|---|---|
| 受付 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin |
| 運営・Draw開始 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/admin |
| 会場Display | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display |

ログインは従来と同じ確認コード。[ローカルのコード保存先](../.checkin-access.local)。Admin API Token・DISPLAY_API_TOKENはブラウザに追加していません。

検証大会の確定済みBracketは https://tournament-checkin-e2e.pine-shaken.workers.dev/display で参照できます。Draw確定後にreloadしても抽選し直しません。サンプル専用Animation Previewは https://tournament-animation-preview.pine-shaken.workers.dev/ に残しています。

## 操作

1. 受付で写真付き参加者を4名以上の偶数人数で登録。名前・rating・保存写真を一覧で確認します。
2. 「受付終了」を実行。R2写真の実体、重複、不足情報、偶数人数、後処理完了を検証し、確定一覧を保存します。終了後は参加者の追加・編集・削除を停止します。
3. 会場モニターでDisplayを開き、確認コードでログイン。待機中に参加者一覧を確認できます。
4. 運営画面の対象人数と参加者一覧を確認し、「Draw開始」を押します。
5. Workerが既存ロジックでペアを編成し、draw session・teams・team_members・Bracket・scene/versionを一度のD1 batchに保存。Displayは保存済み状態を検知して再生します。
6. 既存のダーツ → impact → 写真・名前reveal → PAIR CONFIRMED → hold → 次のペア → TEAMS CONFIRMED が進み、Bracketへ自動で切り替わります。

DisplayにDraw開始や組み合わせ変更の操作はありません。Displayのナビゲーションも表示しません。音声は今回無効にしています。自動再生のブラウザ制約を避け、既存の視覚演出とタイミングを確認する構成です。

Drawを再実行・リセットする機能は今回追加していません。確定済みの大会で「Draw開始」を再送しても、保存済み結果を返します。Draw演出を何度も開発確認する用途には、別のサンプル専用Animation Previewを使用してください。

## 最初に確認した既存実装

| 対象 | 再利用・接続方法 |
|---|---|
| `features/draw/draw.ts` | `makeBalancedTeams`・`buildRevealOrder`・rating合計をWorkerから呼び出す。クライアントや演出内で抽選しない |
| `features/draw/drawApi.ts` | Supabase版の既存確定処理を調査。今回はそのDB呼出し自体は流用せず、同じ純粋ロジックをD1側に接続 |
| `DrawScene.tsx` | データ取得・旧scene更新のwrapperを維持。既存の描画部分を `DrawStage.tsx` に抽出し、双方から再利用 |
| `drawAnimationTiming.ts` | 数値を変更せず、既存の `estimateDrawDurationSec` をサーバーにも使用。4名2組のfullモードは45秒 |
| `drawVisualState.ts` | 保存済みreveal_orderを2名ずつに分割。別のペア決定は行わない |
| `PairConfirmed.tsx` | JSX・表示順・holdをそのまま再利用。型のimport先のみDBに依存しない共通型へ変更 |
| `bracket/manager.ts` | 既存 `buildDoubleElimination` でsnapshotを生成。`toStageData` の純粋変換を共通ファイルへ移動し旧exportも維持 |
| `BracketView.tsx` | 変更せず利用。D1のteam ID、member ID、名前、認証付きportrait URLを渡す |
| fixture | サンプル専用Previewに維持。実際のDrawの参加者には使用しない |

新しいDraw演出やペア決定アルゴリズムは作っていません。独立した受付ビルドで既存のTailwindクラス・演出素材も含めるようにし、元のGSAPのレイアウトが働く状態にしました。Supabase接続や旧scene更新APIを公開受付のブラウザbundleへ取り込みません。

## 型・データ経路

```text
D1 participants（id / display_name / rating / photo_path / checkin_version）
  → 共通participant DTO（id / name / rating / portraitUrl）
  → presentationAdapter（大会・参加者・写真URLを検証）
  → DrawPresentationData（確定session ID / 保存済みreveal_order順のparticipants）
  → 既存DrawStage / PairConfirmed

D1 teams + team_members + events.bracket_snapshot
  → /api/draw/state
  → 既存toStageData / BracketView
```

`DrawRevealParticipant` は既存の `id / displayName / faceUrl` に任意のratingを加え、`presentationTypes.ts` に共通化しました。旧drawApiからの型exportも維持しています。portraitが欠ける、別大会、fixture URLなどの場合はadapterで止め、仮の顔写真に置き換えません。

## D1への保存と再送・競合

既存の `draw_sessions`・`teams`・`team_members`・`events.bracket_snapshot`・`event_state`・`command_receipts` を利用します。重複テーブルや新しいマイグレーションは不要です。

受付終了時のID/versionの一覧と現在のD1参加者が一致すること、写真の保存実体、最低人数、偶数人数をDraw開始前に再確認します。今回の接続はteam_size=2に限定し、奇数・trio/byeの新規接続は行いません。rating未入力は既存ロジックへの入力時に0として扱い、登録時のnullを変更しません。

D1 batchの先頭で、受付closed・scene/version一致・確定Drawなし・既存teamなしを条件にcommand receiptを作成します。続く全書込みは、その試行固有のsession IDを持つreceiptが存在するときだけ実行します。同じUUIDを使う同時再送でも、別試行が既存receiptを使って二重保存できないようにしています。途中失敗はbatch全体をrollbackし、応答が失われた場合は保存済みsessionを読み返します。[D1 batchのトランザクション仕様](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)。

sceneは `idle/version 0 → draw/version 1 → bracket/version 2`。開始時に `scene_seq`・`scene_started_at`・durationを保存します。Displayは1秒間隔で取得し、同じversionでタイムラインを再作成しません。reload時は保存時刻からの経過位置にseekし、ペアを再生成しません。

既存GSAPが完了すると再取得を促し、サーバー時間でもduration経過済みの場合のみ `/api/draw/complete` でBracketへCAS更新します。これは表示完了の自動通知で、Displayの手動運営操作ではありません。Display未接続時も運営画面の取得で完了状態を同期できます。複数端末が同時に完了通知しても結果は同じです。

## API

| API | 用途 |
|---|---|
| `GET /api/draw/state` | 受付状態、scene/version、確定session、reveal_order、参加者、teams/member IDs、Bracket snapshot |
| `POST /api/draw/start` | requestId・expectedVersion付きDraw開始。未受付終了・不整合・古いversionは409 |
| `POST /api/draw/complete` | sessionId・expectedVersionとサーバー経過時間で完了を検証し、Bracketへ遷移 |

いずれも従来のHttpOnly sessionが必要。書込みには同一Origin検証も適用します。以後のVS/Result/NEXT MATCH/Championもこの確定team/member/session/snapshotを取得できる構造です。今回それらの進行・勝敗保存までは実装していません。既存 `/show-preview` は引き続き表示確認用で、大会結果の正本ではありません。

Bracketは既存のevents.bracket_snapshotに保存します。今回、D1のmatchesテーブルへの試合進行レコード同期や勝敗入力は追加していません。Bracket表示はこの確定snapshotとteamsを使います。

## 検証大会の公開E2E結果

対象：`cf-checkin-e2e-20261025`。前段で実際の受付画面から登録・保存した4名のテスト画像データを再利用しました。今回、通常大会へ架空の実名・本人写真の複製を追加していません。

- Pair 1：受付E2E 01 編集済み ＆ 受付E2E 02
- Pair 2：受付E2E 04 ＆ 受付E2E 03
- draw session：`8a15ab3e-34ac-4701-b0fe-7a50c32dae50`
- D1：session 1件、teams 2件、team_members 4件。reveal_order・所属ID・Bracket snapshotを直接SELECTして画面の内容と照合。
- 4名の登録名と保存画像をreveal、2組のPAIR CONFIRMED、全組のTEAMS CONFIRMEDを実際に再生・撮影。
- Draw途中でreloadしても同一ペア・sessionを維持。完了後にBracket表示、さらにreload後も一致。
- 同じ操作UUID／異なるUUIDでの再送でもsessionとteamが増えず、同じ結果。
- HTTP失敗0、ブラウザJSエラー0。

4名の画像は既存テスト画像のアップロードです。本人4名が実機で新規撮影したという意味ではありません。証跡：Git除外 `.wrangler/draw-e2e/result.json`・`pair-1.png`・`pair-2.png`・`all-pairs.png`・`bracket.png`。

## 通常大会の公開確認

**全体の完了条件は未達です。通常大会での実参加者4名によるE2Eが残っています。**

2026-10-25 03:10 JSTの最終取得では、登録済みは「にゃー」「けんけん」「テスト」の3名です。全員D1に登録済みの写真付き参加者で、通常API・保存写真・既存の表示確認も読取検証しました。今回これらの参加者の名前・rating・写真を変更していません。

- 受付：open、count=3。最低4名・偶数人数の検証で終了を拒否。
- Draw：idle、version=0、session未作成、team未作成。
- 通常大会のPair 1/Pair 2：まだ確定していません。検証大会のペアとは別です。
- 4名目がないため、通常大会を勝手に受付終了したり、本人写真のコピー・架空の実名で人数を増やしたりしていません。
- 通常大会のE2E待機プロセスは停止済みです。後から自動的に受付終了するバックグラウンド処理は残していません。

次に通常の受付URLで4名目を登録し、受付終了→運営でDraw開始→Display→Bracketを確認します。実行時は現在の全参加者を再取得し、偶数人数と保存写真を確認します。操作は上記手順のとおりです。今回残っているのはこの通常大会の最終確認であり、接続コード・公開と検証大会4名の機能E2Eは確認済みです。

証跡は `.wrangler/draw-primary/final-status.json`、通常Display/運営/写真/表示確認の読取結果は `.wrangler/draw-primary-readonly/result.json`。通常大会への参加者変更は0件。

公開Version：通常 `1b77076a-885b-4141-b1de-53902030a6a6`、検証 `fed07725-dcf6-475b-9407-f776b84042cc`。

## 検証・変更ファイル

`npm run build`、`npm run build:checkin` が成功。165 unit testsが成功し、同時開始、UUID再送、旧version拒否、途中rollback、応答喪失、受付未終了、奇数受付終了拒否、時間前の完了拒否、再接続後の同一Bracketを含みます。新しい依存のインストール・更新は行っていません。

- `cloudflare/checkin/src/draw.ts`：D1確定・state API・完了CAS。
- `cloudflare/checkin/src/index.ts`：既存認証後に新APIを接続。
- `cloudflare/checkin/src/lifecycle.ts`：今回の2名ペア向けに受付終了時の偶数人数を確認。
- `cloudflare/checkin/src/draw.test.ts`・`testSupport.ts`・`index.test.ts`：実SQLiteの共通test harnessとDraw検証。
- `cloudflare/checkin/wrangler.jsonc`・`wrangler.e2e.jsonc`：既存BracketライブラリをWorkerで使うためnodejs_compat。
- `src/features/draw/presentationTypes.ts`・`drawApi.ts`：DB非依存の共通描画型、旧export互換。
- `src/features/presentation/scenes/DrawStage.tsx`・`DrawScene.tsx`・`PairConfirmed.tsx`：既存描画の抽出と共用。GSAP値・DOM・素材は維持。
- `src/features/bracket/stageData.ts`・`manager.ts`：既存の純粋変換を抽出し旧exportも維持。
- `src/checkin/DrawControl.tsx`・`DisplayPage.tsx`・`main.tsx`・`api.ts`・`draw.css`：運営の開始操作、Displayの状態監視、経過位置復元、Bracket、エラー表示。
- `vite.checkin.config.ts`：純粋描画モジュールと既存素材のみ許可、Tailwind生成。browser bundleの秘密値・Supabase混入検査を維持。
- `scripts/verify-persisted-draw.cjs`：公開UI・API・D1照合。通常大会に架空の参加者を自動追加しない。
- 本書・`PLAN.md`・関連運用資料：最新状態、公開手順、検証結果。

Cloudflare側の手動作業は不要。今回新しいDB・R2・Secret・migrationは追加していません。通常受付と検証受付Workerのみ更新し、旧read-only Worker・Supabase環境・サンプル専用Previewは再公開していません。
