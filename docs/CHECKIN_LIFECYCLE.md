# 連続受付・編集・削除・受付終了

最新：受付からChampionまでの接続を公開しました。[連続した大会運営の手順・通常大会4名の状態・公開7試合完走結果](TOURNAMENT_FLOW.md) を参照してください。以下は前段の実装・検証記録です。

追記：受付終了後の [既存Draw・D1ペア保存・Bracketへの接続](DRAW_D1_REHEARSAL.md) を公開しました。以下はその前段の受付検証記録であり、最新の人数はDraw接続資料を参照してください。

確認日：2026-10-25 JST。通常受付への公開反映済み。今回の依頼範囲の受付機能と公開検証は完了。実機での複数名撮影確認と大会進行全体は別の確認項目です。

## 公開URLと現在の人数

| 用途 | URL | 状態 |
|---|---|---|
| 通常のスマホ受付 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin | 受付中・本人写真付き1名「にゃー」 |
| 通常のDisplay | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display | 同じ参加者を5秒間隔で取得 |
| 通常の運営確認 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/admin | 読取専用 |
| 通常の登録写真で演出確認 | https://tournament-checkin-rehearsal.pine-shaken.workers.dev/show-preview | 登録者が1名の間はVS/NEXTに必要な相手の登録待ち |
| 4名の検証済み受付 | https://tournament-checkin-e2e.pine-shaken.workers.dev/checkin | 受付終了・テスト4名 |
| 4名の演出確認 | https://tournament-checkin-e2e.pine-shaken.workers.dev/show-preview | 6演出確認可能 |

確認コードは従来と同じ。[ローカル確認コード](../.checkin-access.local) に保存されています。コード本文はGit管理や公開資料に記載していません。

通常大会 `cf-rehearsal-001` の本人写真は削除・編集していません。過去の模擬カメラ画像1件と旧seed2件も残していますが、通常の受付人数・演出対象には含めません。今回作った4名は別大会 `cf-checkin-e2e-20261025` に隔離しました。2つの大会の人数を合計して通常受付の人数と表示することはありません。

## スマホで続けて受け付ける

1. 通常の受付URLを開き、従来の確認コードでログイン。
2. 名前、任意のratingを入力。「カメラを起動」→「写真を撮影」、または画像入力から撮影・写真選択。
3. 「参加者を登録」。成功すると入力が空になり、同じ画面の一覧に名前・保存写真が反映されます。
4. ページを開き直さず次の参加者の入力へ進みます。送信失敗時は入力を保持し、同じ登録を再試行します。
5. 一覧の「編集」から名前・rating・写真を変更。「変更を保存」。写真を選ばなければ従来の保存写真を使います。
6. 「削除」は対象者の名前を確認して実行。D1の行と保存写真を削除します。
7. 別のPC・スマホ・会場モニターでDisplayを開き、同じコードでログイン。通常5秒以内に反映。「今すぐ更新」も使用可能。
8. 全員の受付後、「受付終了の確認」に出る不足項目を解消して「受付終了」。人数の確認に同意すると確定します。

現在のteam_size=2では最低4名が必要です。名前の重複、名前/ratingの異常、R2写真の欠落、写真の保存・削除処理が残っている場合は終了できません。名前の重複は前後空白・連続空白・全角半角・大文字小文字を正規化して確認します。ratingは任意です。

終了後は登録・編集・削除を停止します。画面を開いたままの他端末からの変更もAPI・DBで拒否します。今回、受付再開の操作は実装していません。通常大会は引き続き受付中です。検証大会は終了状態を確認するため、そのまま保持しています。

## データと失敗時の扱い

`D1 participant → 共通DTO → presentationAdapter → Draw / VS / Result / Bracket advance / NEXT MATCH / Champion`。

D1の既存 `photo_path` がportrait keyです。画像本体はprivate R2に保存し、ブラウザには同じoriginの認証付きportrait URLを返します。保存済み写真が読めない場合はエラーを表示し、fixtureやplaceholderへ置き換えません。写真のversionを画像URLにも反映し、編集後に別端末で古い写真を使い続けないようにしています。

- 名前/ratingのみの編集：写真を再保存せず、`checkin_version` を増加。
- 写真差し替え：新しい一意なR2キーに保存 → D1のキー更新と旧キー削除予定を同じD1 batchで確定 → 旧objectを削除。
- 削除：D1行の削除とR2削除予定を同じbatchで確定 → R2削除。
- R2削除失敗：D1に後処理を保持。画面の「写真の後処理を再試行」、または5分間隔Cronで再試行。未完了を正常完了として隠さず、受付終了を止める。
- 曖昧な送信結果：操作UUIDとreceiptで再送を照合。写真保存前に期限付きの保存予定を記録し、未使用objectも回収対象にする。遅延したアップロード用に削除済み記録を残して再確認。
- 他端末と競合：expectedVersion/revisionが変わっていれば409。古い内容での上書き、受付終了直前の変更の見落としを防止。

D1とR2をまたぐ単一トランザクションではありません。障害時はD1の永続的な削除予定から回復する方式です。今回の公開検証では後処理待ち0、不要な旧写真2件は実際に404でした。

## 運営側の取得API

同じ確認コードのHttpOnly Cookieで認証します。Admin API TokenやDISPLAY_API_TOKENをブラウザへ追加していません。

| API | 用途 |
|---|---|
| `GET /api/participants` | 現在の参加者DTOと受付状態 |
| `POST /api/participants` | 新規登録 |
| `PATCH /api/participants/:id` | UUID・expectedVersion付き編集 |
| `DELETE /api/participants/:id` | UUID・expectedVersion付き削除 |
| `GET /api/checkin/state` | 人数・写真・不足項目・終了可否・revision |
| `POST /api/checkin/close` | UUID・expectedRevision付き終了 |
| `GET /api/checkin/roster` | 受付完了済みの固定一覧。未終了なら409 |
| `POST /api/checkin/cleanup` | 写真後処理の再試行 |

受付終了は `checkin_state` の状態と `closed_roster` を確定します。events.statusをdrawn/runningへ進めず、抽選・勝敗確定・本格的な大会進行は実行しません。運営確認画面は現在の同じparticipant APIを参照し、終了状態を明示します。運営処理へ引き渡す場合は確定一覧APIを使用できます。

## 公開検証結果

スマホ相当390×844と別の1920×1080ブラウザセッションで実施。PCの別セッションを別端末相当として使用しました。Safari・物理スマホ複数台の試験ではありません。

| 項目 | 実測 |
|---|---|
| 連続登録 | 4名を同じ画面から登録。名前・写真入力リセット、一覧反映を確認 |
| 別セッション | Displayで4名とR2由来写真を確認、編集後の名前の反映も確認 |
| 編集 | 01を「受付E2E 01 編集済み」、rating 12.5へ更新、写真を別ファイルに差し替え。version=2 |
| 写真差し替え | 新キー保存、旧R2キーは404 |
| 削除・再登録 | 04の旧D1行と写真を削除、3名になった後、新IDで再登録し4名 |
| D1 | create receipt 5件、update 1件、delete 1件、最終participant 4行 |
| R2 | 最終4枚の実バイナリを取得。31,411 / 29,675 / 29,284 / 31,828 bytes。全画像のSHA-256が異なる |
| 不要写真 | 写真差し替え前と削除対象の2キーが404、削除予定は全件done |
| 共通演出 | 編集後participantとportrait URLで6演出を表示、画像decode成功、fixtureへの代替なし |
| 受付終了 | 4名のclosed_roster、revision=8、終了後の追加登録409 |
| 通常大会 | 「にゃー」の保存キーを維持、写真62,466 bytes。R2/配信バイト一致。Display・運営・4演出を読取確認（参加者変更0件） |
| ビルド・テスト | `npm run build:checkin` 成功、`npm run test:rehearsal` 159件成功。ブラウザJSエラー0 |

**4名の写真は `public/images/test01..05.png` を画像入力から実際にアップロードして保存したテストデータです。4名が実機で新規撮影したとは扱いません。** アプリ側がfixtureを直接表示した試験でもありません。通常大会の本人写真は利用者が実機登録した既存データを読み取って検証しました。

証跡はGit除外の `.wrangler/checkin-lifecycle-e2e/result.json` と同フォルダの画面画像。通常大会の読取証跡は `.wrangler/participant-e2e/lifecycle-primary/result.json`、R2直接照合は `.wrangler/photo-audit/result.json`。本人写真を公開ドキュメントへ添付していません。

`scripts/verify-checkin-lifecycle.cjs` は専用検証大会にのみ書き込みます。初回は空の大会を要求し、既存データを自動削除しません。終了済みの大会で初回検証を再実行しないでください。

## 今回の変更ファイル

- `cloudflare/migrations/0003_checkin_lifecycle.sql`：追加スキーマ・整合性トリガー。
- `cloudflare/checkin/src/domain.ts`・`lifecycle.ts`・`index.ts`：共通型、受付API、写真後処理、認証を維持したrouting、scheduled。
- `cloudflare/checkin/src/index.test.ts`：実SQLiteのマイグレーションを使うCRUD/障害/受付終了テストへ更新。
- `cloudflare/checkin/wrangler.jsonc`・`wrangler.e2e.jsonc`：Cron・専用検証大会設定。
- `src/checkin/CheckinWorkspace.tsx`・`CheckinPage.tsx`・`main.tsx`：一覧・連続登録・編集・削除・終了。
- `src/checkin/api.ts`・`useParticipants.ts`・`ParticipantPhoto.tsx`・`DisplayPage.tsx`：version・受付状態・画像更新・運営表示。
- `src/checkin/presentationAdapter.ts`・`presentationAdapter.test.ts`・`LiveShowPreviewPage.tsx`：専用検証大会の明示的許可、編集写真の再取得。
- `scripts/verify-checkin-lifecycle.cjs`・`verify-checkin.cjs`：公開ライフサイクル検証と旧ローカル検証の成功表示追従。
- 本書・`CHECKIN_REHEARSAL.md`・`CLOUDFLARE_REQUIRED_ACTIONS.md`・`README.md`・`../PLAN.md`：最新状態と手順。

既存のSupabase版Admin/Display、旧read-only Worker、サンプル専用Animation Previewは今回変更・再公開していません。依存追加・インストール・Git pushも行っていません。
