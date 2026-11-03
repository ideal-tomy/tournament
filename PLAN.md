## Cloudflare canonical統合（2026-10-31 依頼.md）完了

8 WorkerをCloudflare APIとrepoで照合。既存throughだけに公開、旧configは.disabled保存。新大会0名開始に限定し、写真コピー・サンプル再送を排除。run/portrait不一致拒否とstatic cache維持を修正。182 tests、build、dry-run成功。公開新runで0→1名Display自動反映→8名・3試合・Champion・D1/R2全byte照合成功。新Worker・依存追加・削除・Git pushなし。[最終報告](docs/CANONICAL_CONSOLIDATION_20261031.md)。実スマホ実機は未確認。以降の過去計画より今回の依頼を優先する。

# Cloudflareアプリ実装 PLAN

## Phase D0：当日の3端末を同じ大会IDで連動させる（2026-10-31）

目的：スマホ受付・運営・会場モニターが同じ `?run=` を開いていることを、画面構成を大きく変えずに確認できるようにする。運用手順の正本は [docs/DAY_OF_EVENT.md](docs/DAY_OF_EVENT.md)。

- [x] D0-1：Rehearsalの「当日の3画面」に受付URLのQRを追加。QR画像は外部サービス（api.qrserver.com）で生成し、表示できない場合はURLコピーでの配布を案内する。CSPの `img-src` にこの1ホストだけを追加。
- [x] D0-2：受付とAdminの大会IDバナーで、URLの大会IDとサーバーが返す大会IDを照合。存在しない大会IDや不一致を警告し、大会IDのコピーボタンを追加。会場Displayには運営用バナーを置かず、待機表示に大会IDの末尾だけを出す。
- [x] D0-3：本節と DAY_OF_EVENT.md に受入基準・公開手順を記載。
- [x] D0-4：`npm run test:shared-run-ux`（`scripts/verify-shared-run-ux.cjs`）を現行UIに合わせ、3リンクとQRのrun一致、存在しない大会IDの警告、受付4名→Admin反映→受付終了→ペア発表開始→Displayの発表演出までを確認。

受入基準：Rehearsalで空大会を準備した後の3リンクとQRが同じrunを指す。存在しない大会IDの受付・Adminに警告が出る。`npm test`、`npm run build`、`npm run test:shared-run-ux`（`npm run dev` 起動中）が成功する。Rehearsal・Admin・Displayの主要ブロック配置と操作は変えない。

D0に含めないもの：当日専用の入口、運営スマホ向けレイアウト、Displayの非表示タブでのポーリング、受付終了と発表開始の統合、会場音声。これらはD1以降で扱う。

## 32人・16チーム・15試合の観客通し確認（docs/依頼.md）

前段の8名ローカル確認を土台とし、今回は公開まで実行する。canonicalは既存 `tournament-through-rehearsal`。新しい公開Workerを作らず、通常大会と過去の検証大会を保持する。UIデザイン変更・依存追加・Git push・公開DBの破壊的変更を行わない。

1. **Phase 0 / 構成監査**：標準dev/build/previewとlegacyを照合。既存Admin、Display、受付、Rehearsal、show-previewの直アクセス・reload・Worker assets・API routingをlocal/publicで検証。複数Workerのうち既存通しWorkerへ入口を統一する。
2. **Phase 1–3 / 永続32人大会**：既存participant登録・R2 portrait・rating均等ペアを再利用。新規runのみsingle_eliminationを指定し、既存brackets-managerで16チーム15試合を作る。従来doubleの大会は変更しない。format・人数・timing presetを大会に保存し、リロード・別端末で一致させる。既存列を使用しschema変更を避ける。
3. **SHOW / FAST CHECK**：同じDraw、Winner、実Bracket進出演出、VSへtiming presetを渡す。FASTも全16ペアと全15試合の構造を省略せず、holdだけ短縮する。サーバー側の遷移可能時刻とDisplayのtimelineを同じ設定から算出する。
4. **手動・自動進行**：手動ではVSで停止し、Adminの試合開始だけで進める。自動ではVSが見えた後に明示的な模擬STARTコマンドを実行。停止・再開・新規run作成・現在step/round/match/nextを維持。初期化や再開で再抽選・二重結果入力をしない。
5. **local受入**：32名・16ペア・15match、全ペア発表、R16/QF/SF/Final、15回のVSと開始待機、WINNER→実進出線→NEXT/VS連続表示、優勝、reloadを実Displayで観察。unit、build、型、dry-runを通す。FAST全通しとSHOWの開始待機・代表遷移を検証し、証跡を残す。
6. **既存canonicalへdeploy**：対象設定・binding・既存versionを確認し、既存through Workerのみ更新。SecretとD1/R2を継続使用。失敗時は原因を修正し同じWorkerへ再試行し、新Workerに逃げない。
7. **public受入・引渡し**：公開全routeのdirect/reload、認証、32人15試合の観客通しを再実行。動画・スクリーンショット・遷移記録・永続データ整合性を確認。人間が全16ペア発表から見られるよう、新しい32名SHOW大会をペア確定・発表前で渡し、同じrunの5 URLを正本へ記録する。VSでの手動START待機は通し試験で実証する。残課題は機能・演出・UIUX・不具合に分ける。

合格条件：localhostに留めず、canonicalの公開Displayで16ペアと15試合を可視時間付きで観測する。通常大会を変更しない。単にAPI上のfinishedや新設の確認ページで代替しない。失敗・未観測項目を成功扱いにせずPLANと証跡へ記録する。

### 完了実績（2026-10-30）

- [x] Phase 0：標準dev/build/previewとdev:rehearsalをCloudflareへ統一。旧Vite/Supabaseはlegacyへ分離。5 routeのlocal/public direct accessとreloadを実測。
- [x] Phase 1–3：32名の通常participant・R2 portrait・rating、16確定ペア、single_elimination 15枠を新規runへ保存。既存double大会は保持。
- [x] 同一PresentationのSHOW／FAST hold preset、VS停止とAdmin START、現在step/round/current/next、一時停止・再開・新規runでのリセットを確認。
- [x] Local FAST：32 reveal・16 pair・15 VS／WINNER・14進出線・15試合・優勝とreload。画面・D1・ログを照合。
- [x] 32人で露見した写真の再読込による空枠を認証付きメモリcacheで修正。状態pollingの毎回INSERTを廃止、Displayを読取専用にし、計測API頻度を減らした。181 unit tests・最終build成功。
- [x] 既存canonical `tournament-through-rehearsal`へdeploy（最終version `6a2ecda1-1ec0-446a-9821-39e0573f5525`）。新Worker・binding・Secret・migration追加なし。
- [x] Public SHOW：19:47:55～20:00:25 JST、約12分30秒の全通し成功。32 reveal／16 pair／15 VS／15 WINNER／14実進出線、R16・QF・SF・Final・CHAMPIONとreloadを観測。最終実行の通信再試行・JS例外・想定外HTTP失敗0。通常参加者hash不変。D1 done15件とSTART／winnerログ各15件一致。
- [x] 発表前の引渡しrun `cf-through-6912c2e2-bbfb-4c71-90d5-da764b5a6003`：32名・16ペア・15枠、SHOW、idle/version1で保持。全5 URLを同じrunで確認。
- [x] 公開の中断試験は成功扱いにせず記録し、通常大会・過去run・既存作業を保持。Git push、依存追加、OS変更は実施せず。

正本：[REHEARSAL32.md](docs/REHEARSAL32.md)。5 URL、各演出の接続状態、機能・演出・UIUX・不具合の残課題、55秒の連続表示動画、全編録画とJSON／PNG証跡を集約した。

## 現在の実行計画：起動・公開経路の統一（2026-10-30）

目的：UIUX改修前に、Cloudflare版の受付→抽選→管理→Display→優勝を同じ入口から確認し、公開可能な成果物と再現手順を揃える。

### 保護条件・スコープ

- 既存の未コミット実装を引き継ぎ、巻き戻し・削除・Git pushは行わない。
- remote D1/R2・通常大会・既存Worker設定は変更しない。今回の完走試験は専用ローカルD1/R2に限定。
- 起動はloopback限定。ローカル専用の設定・認証値・保存先を作り、remote bindingを使わない。
- 既存migrationはローカルの履歴管理で一度だけ適用し、既存公開DBへ再適用しない。
- 新規依存の追加・更新は事前承認後のみ。共有node_modulesを変更しない。
- 今回は公開準備・dry-runまで。公開操作は対象と検証結果が揃ってから別途明示する。
- 広告・音響・undo・32名実機運営等の全移行は別段階。実測した範囲のみ完了とする。

### P1：標準入口・成果物をCloudflareへ統一

- [x] `dev` / `build` / `preview`をCloudflare版へ統一し、旧版を明示的なlegacyコマンドとして保持。
- [x] 通常testも共有node_modulesのjunctionを解決できる設定へ合わせる。
- [x] `/admin` `/display` `/checkin`の直アクセスと未ログイン表示をブラウザで確認。

### P2：安全なローカル実行環境

- [x] remote IDを持たないローカル専用Wrangler設定、D1/R2、migration追跡、冪等な初期大会seed。
- [x] ローカル専用認証ファイルを未作成時だけ生成。秘密値はログへ出さず、既存秘密値は上書きしない。
- [x] ワンコマンドでbuild→migration→seed→APIと画面の同一origin起動。frontend変更の反映方法も用意。
- [x] ポート衝突は説明して停止。既存5173サーバーを強制停止しない。
- [x] 再起動で大会・写真が保持されること、公開リソース不要で動くことを確認。

### P3：大会フローと保存の実証

- [x] 検証スクリプトをloopback専用にし、remote認証・固定の公開大会IDへの依存を排除。
- [x] サンプル8名の新規大会：受付→ペア保存→発表→Bracket待機→手動開始相当→勝敗→CHAMPION。
- [x] 運営・Displayを別ブラウザcontextで開き、写真取得・各演出・最終状態の同期を確認。
- [x] 一時停止、API失敗後の再開、同じrequestIdでの再送、リロード復元、D1整合性と勝敗ログを確認。
- [x] 検証大会を作り直しても完走大会が保持されることを確認。通常大会・remoteへの書込0。
- [x] localhost上の認証Cookie・Origin検査も実ブラウザで確認し、必要な修正は本番の制約を維持。

### P4：公開準備・文書・結果

- [x] default build、unit全件、Worker型検査、既存公開設定のdeploy dry-runが成功。
- [x] READMEを現行入口へ更新。ローカル認証値の所在、URL、停止・再起動・保存・検証・公開手順を記載。
- [x] Cloudflare公開先とlegacy Vercel設定の位置づけを明示。静的ファイルだけの公開でAPIが動くと誤解させない。
- [x] 検証日時・実行コマンド・件数・スクリーンショット・保存整合性・未検証項目を記録。
- [x] PLANに実績を追記し、ユーザーがローカルURLから確認できる状態で渡す。

受入基準：`npm run dev`でCloudflare版へ到達し、管理画面が白画面にならない。ローカルD1/R2で8名大会が完走・再読込復元できる。標準build/testと公開dry-runが成功し、既存公開データ・既存作業を保持する。

復旧：今回の起動プロセスだけを停止。ローカル永続データは保持し、失敗時もDBを削除せず原因とログを確認する。旧コードはlegacyコマンドで個別利用可能。

### 実行結果（2026-10-30 17:49 JST）

P1〜P4の受入範囲は完了。標準unit 179件、標準build、旧Worker型検査、通常／通し検証Workerのdry-runが成功。ローカル8名・4チーム・6試合で優勝（version 28）、全写真・4ペア・結果演出を観測し、done試合と勝者操作ログが各6件で一致。一時停止・API失敗後の同一requestId再開・優勝リロード復元・完走大会を保持した新規大会準備も成功。

実受付フォームの写真登録・名前編集・写真差し替え、Cookie・Origin検査、別ブラウザの認証付き写真取得、サーバー再起動後のD1/R2復元を確認した。ポート競合時は既存サーバーを停止せず起動を中断する。現在はlocalhost:5174のpreviewで8名準備済み大会を確認できる。公開・push・remoteデータ変更は実施していない。

Wranglerの開発依存固定は確認待ち。追加インストールを伴わず既存Wrangler 4.152.0で受入を実施した。clean installの再現性や実機・会場・16/32名運営を完了扱いにしない。

詳細・確認URL・証跡は [LOCAL_DEPLOY_READINESS.md](docs/LOCAL_DEPLOY_READINESS.md) に集約。

## 最新：WINNER → Bracket advance → 次VS（2026-10-25）

- [x] 勝者確定時の更新前Bracketを、既存の結果確定処理と同じ保存単位で保持。
- [x] 実DisplayでWINNER保持 → 更新前 → 実進出ライン・顔の移動 → 更新後 → 実際の次2チームのVSへ接続。
- [x] NEXT MATCHで停止し、運営の試合開始操作でのみ次試合へ進行。
- [x] 専用 `/match-transition` に同じDisplayの読取専用再生・一時停止・再開を追加。
- [x] 公開実機相当ブラウザで線の連続伸長・実進出先・待機・reload・運営開始を確認。179 tests、通常build、checkin build成功。

調査した既存コード、再利用箇所、公開URL、検証結果、変更ファイルは [詳細報告](docs/MATCH_RESULT_PRESENTATION.md)。以下は前段階の記録。
## 最新：受付からCHAMPIONまでの通しリハーサル（2026-10-25）

- [x] 専用公開Worker `/rehearsal` を追加し、通常大会と隔離したrun IDを発行。
- [x] 撮影不要のサンプル8名と、現在の登録参加者・写真をコピーする準備方法を用意。D1/R2へ通常登録APIで保存。
- [x] 同じ運営コマンド・Displayによる手動操作と、自動command runnerを接続。
- [x] 開始・一時停止・再開・新規大会への初期化、進行ステップ・状態・次試合・人数を表示。
- [x] API・写真・人数・D1整合性の異常で停止。同じrequestIdで再開。
- [x] 公開入口のボタンから8名4チーム6試合をfinishedまで完走。Championは参加者01＆04。個別Animation Preview選択0回。
- [x] 一時停止、意図的503停止・再開、完走後初期化による旧大会保持を公開確認。
- [x] 最少4名の確認で発見した2チーム時の優勝判定を共通ロジックで修正。176 tests成功。
- [x] 修正後の4名手動完走、保存済み決勝の復帰、写真取得エラー停止、通常大会・既存Previewの最終読取確認。両build成功。

[公開URL・使い方・state列・共用範囲・発見不具合・変更ファイル](docs/THROUGH_REHEARSAL.md)。初期化は新規大会作成で、既存大会を削除・上書きしません。以下は前段階の記録です。
## 最新：第1試合から第2試合への基本ループ（2026-10-25）

- [x] 既存applyResult／getNextMatch／snapshot更新・receiptを再利用。
- [x] 試合中のRound・Match番号・両チーム・写真・名前と勝者ボタンを表示。
- [x] 勝者をD1へ保存→既存WINNER→更新済みBracketを2秒表示→次VSへ自動接続。開始は必ず運営操作待ち。
- [x] operation_logを同じbatchに記録。開始・勝者の重複／競合／応答消失後の再送を保護。
- [x] 公開隔離大会で第1試合ID 0→勝者確定→Bracket更新→第2試合ID 1の開始待ちまで確認。4名の保存写真を検証用8件で再利用し、新規実機撮影とは区別。
- [x] 170 tests（test:rehearsal）、専用build・通常build成功。通常Workerへ反映し、通常大会の未開始・未結果入力を維持。
- [x] 既存Animation Preview、通常DisplayのPC/SP/1920×1080、reload復帰を確認。

[状態遷移・第1/第2試合・D1・URL・変更ファイル](docs/MATCH_PROGRESS_LOOP.md)。後半戦や演出デザインの追加はしていません。以下は前段階の記録です。
## 最新：受付終了・ペア発表・ゲーム開始の分離（2026-10-25）

`docs/大会フロー再確認.md` に基づき、今回の範囲を第1試合VS後の待機までに限定します。以下の過去記録にある「Draw開始でペア確定」「Bracket後は自動で第1試合」は、この節の仕様で置き換えます。

- [x] 既存rating均等化・公開順・Bracket・次試合決定ロジックを調査し、そのまま再利用。
- [x] 受付終了で名簿を固定し、ペア・Bracket・matchesを事前保存。Displayは大会開始待機。
- [x] 「ペア発表開始」で保存済みペアの既存Drawを再生。全ペア発表後はBracketで待機。
- [x] 「ゲームスタート」でシステムが第1試合を選択し、既存NEXT MATCH/VS後に「試合開始」を待つ。
- [x] 正常遷移・再送・競合・準備失敗後の回復を含む168 tests成功。
- [x] 公開隔離大会で実登録4名の保存写真・ratingを再利用して全ゲートを確認し、通常Workerへ反映。通常大会のペア・現在試合は保持。通常build成功、PC/SP/1920×1080の読取確認も完了。

[最新の操作手順・調査結果・公開検証記録](docs/PAIR_ANNOUNCEMENT_FLOW.md)。後半戦の機能追加・演出UI変更は今回の対象外です。

## 最新：受付からChampionまでの連続進行（2026-10-25）

- [x] 既存getNextMatch/applyResult/getChampionTeamIdをD1のsnapshotへ接続。
- [x] 次試合をシステムが自動選択。通常運営に試合選択・手動「次へ」は置かない。
- [x] Draw完了→Bracket→NEXT MATCH/VS→開始待ち→試合開始→勝者確定→Result/Bracket更新→次対戦、を連続化。
- [x] 最終結果からChampion・finishedへ接続。試合開始・勝者確定は運営の操作を必須にする。
- [x] snapshot・matches・現在試合・scene/version・再送receiptを同じD1 batchで保存。
- [x] 公開の隔離大会8名4チームで、敗者復活・決勝リセットを含む7試合を完走。D1と照合、version25で終了。
- [x] 通常大会4名のペアを保持し、最初の試合を自動表示。04:16 JST現在、VS後の試合開始待ち。通常大会の勝者を検証用に入力していない。
- [x] 専用build・通常build・167 tests成功、通常Workerに公開済み。

[公開URL・通常運営手順・E2E結果・変更ファイル](docs/TOURNAMENT_FLOW.md)。通常大会での実戦結果入力からChampionまでの確認は運営者の開始・結果入力待ち。以下の3名待ち等は過去時点の記録です。

## 最新：既存Draw・D1確定ペア・Bracketへの接続（2026-10-25）

- [x] 既存makeBalancedTeams/buildRevealOrder/buildDoubleEliminationを再利用。
- [x] 既存DrawSceneの描画をDrawStageへ抽出し共用。GSAPタイミング・PairConfirmed演出は維持。
- [x] 受付終了時の固定ID/version・実保存写真・偶数人数を検証。
- [x] 運営の「Draw開始」から既存session/team/team_members/Bracket/sceneをD1 batchで確定。
- [x] UUID・version・試行固有sessionで同時再送を保護し、reload・再接続で同じペアを復元。
- [x] Displayはscene/version監視で再生し、全ペア確定後に既存BracketViewへ接続。手動の運営操作は置かない。
- [x] 公開の隔離検証大会4名で、全名・保存写真・2組のPAIR CONFIRMED・全組完了・Bracket・D1直接照合を確認。
- [x] 通常ビルド・受付ビルド・165 tests成功、通常Workerへ反映。依存追加・migration追加なし。
- [ ] 通常大会cf-rehearsal-001の本人写真付き4名で受付終了→Draw→Bracketの最終確認。03:10 JST現在は「にゃー」「けんけん」「テスト」の3名、受付open/scene idleのまま保持。4名目が必要。通常大会のDrawはまだ実行していない。

[調査・再利用範囲・公開URL・操作・D1保存結果・変更ファイル](docs/DRAW_D1_REHEARSAL.md)。以下は受付機能までの経過記録。

## 最新：大会開始前の受付フロー（2026-10-25）

- [x] 同じ画面から写真付き参加者を連続登録し、成功時に入力をリセット。
- [x] 受付に人数・保存済み写真・名前・rating・編集・削除を表示。
- [x] versionで競合を防ぎ、名前/rating/写真を編集。
- [x] 写真差し替え・削除はD1トランザクション内で削除予定を記録し、R2削除を実行。失敗時は再試行と5分間隔Cron。
- [x] 最低人数・重複・必須情報・R2実体・後処理を検証して受付終了、確定一覧を保存。
- [x] D1 participant → presentationAdapter → 6演出で共通利用。
- [x] 公開専用検証大会で4名登録、別セッション表示、編集、削除、再登録、受付終了を確認。通常大会の本人写真は保持。
- [x] 専用buildおよび159 unit tests成功。通常受付Workerへ反映。
- [ ] スマホ実機で追加3名以上を連続撮影し、実機同士で受付を確認する（自動試験4名の画像は既存テスト画像）。
- [ ] Draw/勝敗確定/大会の完全進行は別工程。受付終了は大会開始や抽選実行ではない。

[今回の公開URL・運用手順・実測・変更ファイル](docs/CHECKIN_LIFECYCLE.md)。以下の本人写真未登録という記録は現在の状態ではありません。

## 過去記録：参加者データを演出へ接続（本人写真登録前）

専用Worker `tournament-checkin-rehearsal` の `/checkin` → D1／R2 → `/display`・読取専用 `/admin` → 実データ専用 `/show-preview` を実装・公開した。canonical portrait APIとpresentation adapterを共通化。166 tests、各build、ローカルで保存済み参加者の6シーン表示を確認。

**全体は未完了。** 公開環境の本人写真が未登録のため、実スマホ撮影から公開演出までの実写E2Eが残る。既知の緑色模擬画像は通常API・演出から除外し、実写として扱わない。[URL・実装・検証・変更ファイル・残作業](docs/CHECKIN_REHEARSAL.md)。以後の過去記録よりこの節を優先する。

## 写真付き受付の最小実装（2026-10-24）

2026-10-25追記: 緑色の写真は最初の公開試験で作成した模擬カメラ画像と判明。R2／Worker間のバイト一致と正しいJPEG headerを確認し、検証画像の明示・読込失敗表示・確実な再取得を公開した。参加者データの変更は0件。**実スマホ撮影の登録待ちであり、実写のDisplay確認は未完了。** [写真経路の調査・修正記録](docs/CHECKIN_REHEARSAL.md)。

最新の [依頼](docs/依頼.md) に従い、別Worker `tournament-checkin-rehearsal` に `/checkin` と参加者確認用 `/display` を実装・公開済み。名前・任意rating・写真をWorker経由で既存D1と非公開R2へ保存し、別端末の確認画面に表示する。既存Admin／Display・Supabase版と演出Previewは維持する。

[URL・確認コードの場所・操作・Cloudflare設定・検証記録](docs/CHECKIN_REHEARSAL.md)。専用build、従来build、153 unit tests、実D1・R2を使った公開URLでの模擬カメラ→別セッションDisplay確認が成功。残作業は実スマホによる撮影・Safariを含む端末確認。この最小実装を一般のAdmin認証・大会進行API全体の完成とは扱わず、以下のM1.2以降の未実装項目は保持する。

## 公開演出Previewの先行計画（2026-10-24）

今回の依頼は、以下の公開演出Previewを先に進める。既存のM1.1以降のDB連携計画とは独立して実装でき、公開Displayキーの解決を待つ必要はない。**専用Previewを実装し、2026-10-24に別Workerへ公開済み。** [公開URL・操作・更新・検証記録](docs/ANIMATION_PREVIEW.md)。以下は実装方針の記録。残作業は実際のスマホ・会場モニターでの目視確認とUI調整。

### 調査結果と採用方針

対象はこのクローンの `c40cfb7` と作業中の追加ファイル。2026-10-24にコードを確認し、`npm run build`（TypeScript + Vite）は成功した。

| 対象 | 現状 | 公開Previewへの適性 |
|---|---|---|
| `/show-preview` | fixtureとPostMatchStageだけで動作。再生・停止・seek・skip、full/short/lite。DB接続なし | **ベースに採用**。操作と表示部品を専用エントリーから再利用する |
| `/local-rehearsal` | DB不要だが写真登録・カメラ・localStorage・抽選・勝敗・undoまで含む | 手元の進行検証用として維持。画面全体は公開Previewに取り込まない |
| 通常のVite build | 静的出力に成功。ただしAdmin、Display、Supabase関連chunkも生成される | `dist` 全体をそのまま公開する方式は採らない |
| 本番DrawScene | GSAPの抽選演出とデータ取得・scene更新が同じモジュールにある | 直接importしない。公開用はfixture専用の描画実装を追加する |

| 演出 | 既存Previewの到達点 | 必要な追加 |
|---|---|---|
| Draw | local-rehearsalはチーム結果の静的表示 | ダーツ・カード反転・ペア成立をfixtureで再生する専用stage |
| Result | PostMatchStageのWINNER表示 | 単独再生入口と長い名前・顔なしfixture |
| Bracket advance | PostMatchStageに模式的なライン演出 | 単独入口。実大会bracketとの同期機能ではないことを画面に明記 |
| VS | PostMatchStageで再生可能 | 単独入口 |
| NEXT MATCH | PostMatchStageで停止・手動開始待ち表示 | 単独入口・リプレイ操作 |
| Champion | local-rehearsalの静的な優勝パネル | fixture専用の優勝アニメーションstage |

### 最小変更の実装単位

1. `preview/index.html`、`src/preview/main.tsx`、`PreviewApp.tsx`を新設し、通常の `src/main.tsx`／`App.tsx`から分離する。既存の2ページ、Admin／Display、本番DrawScene、Supabase、Cloudflare APIは変更しない。
2. `src/preview/fixtures.ts`に固定の参加者・チーム・勝者・次試合を定義する。公開用の顔画像はまずプレースホルダーを標準にする。同梱写真を使う場合は公開してよい素材だけを選ぶ。参加者登録、撮影、upload、API取得、永続化は不要。
3. `PostMatchStage`と既存の純粋な描画・タイミング部品を再利用する。Result／Bracket advance／VS／NEXT MATCHの入口は既存timelineの位置へseekして実装する。Draw／Championは `src/preview/scenes/` に新設し、完了時はPreview内の状態だけを更新する。本番DrawSceneの見た目・タイミングを照合するが、同一コンポーネントではないため本番と完全一致した検証とは扱わない。実データを使った本番演出の回帰検証は別工程とする。
4. シーン選択、再生、停止、最初から、skip、モード、全体通し再生を用意する。NEXT MATCHでは自動的に試合開始しない。モニター表示用に操作パネルを隠す。音声は初回対象外。既存ホームへ戻るリンクは専用Preview内へ向ける。
5. `vite.animation-preview.config.ts`を新設し、`preview/`をroot、`dist-animation-preview/`を出力先にする。標準Vite設定とlocalhost専用proxy設定は継承しない。公開用環境変数は不要とし、`envDir:false`で通常の `.env*` を読ませない。`publicDir:false`とし、必要な演出素材だけを明示リストで出力へコピーする。通常の `public/` には仮置き素材や動画もあるため丸ごとコピーしない。
6. `package.json`に専用build／previewコマンドを追加する。既存buildは保持し、新規依存は追加しない。専用bundleにAdmin／Display／Supabase／Cloudflareクライアント・秘密値が入らないことを検証する。
7. 新規の静的配信用Cloudflare Workerへ専用出力だけを公開する。既存 `tournament-rehearsal` Workerを更新しない。公開後にPC・スマホ・モニターで確認する。

### 公開先の比較と設定

推奨は **Cloudflare Workers Static Assetsの別Worker**。既にCloudflareを利用しているため、別サービスの接続を増やさず、既存APIと別の名前・URL・設定で管理できる。[公式の静的配信方式](https://developers.cloudflare.com/workers/static-assets/)を使う。

新規設定例 `cloudflare/wrangler.animation-preview.jsonc`（未作成）:

```jsonc
{
  "name": "tournament-animation-preview",
  "compatibility_date": "2026-10-24",
  "assets": { "directory": "../dist-animation-preview" }
}
```

`main`、D1／R2 binding、API token、Secretsは設定しない。最初はルートとqueryだけで画面を切り替え、SPAのパスrewriteを不要にする。Cloudflare側の作業は専用Worker作成・この出力の公開・HTTPS URL確認のみ。D1 migration、R2設定、既存APIのCORS変更は不要。

Vercelでも新規プロジェクトに専用build commandと `dist-animation-preview` を設定すれば公開可能。[Vite公式連携資料](https://vercel.com/docs/frameworks/frontend/vite)。既存プロジェクトの環境変数・ドメインは引き継がない。既存 `vercel.json` は本体用の全パスrewriteを持つため、専用projectのRoot Directory／設定を分離し、この設定を流用しない。最初の実装では公開方式をCloudflareの一方に絞る。

### 専用URL

以下は設計時のURL形式。実際の公開先は `https://tournament-animation-preview.pine-shaken.workers.dev/`。

```text
https://tournament-animation-preview.<account-subdomain>.workers.dev/
  ?scene=draw&mode=full
  ?scene=result&mode=full
  ?scene=bracket&mode=full
  ?scene=vs&mode=short
  ?scene=next&mode=lite
  ?scene=champion&mode=full
  ?scene=all&mode=full&controls=0
```

各queryはルートURLに続ける。既存 `/show-preview`、`/local-rehearsal` は従来用途のまま残す。新URLにAdmin／Displayルートは実装しない。queryは既定のシーン名だけを受け付け、URLからデータ取得先・token・HTMLを指定できないようにする。

### 確認方法と完了条件

| 表示対象 | 確認 |
|---|---|
| PC | 1366×768、1440×900。操作パネルの折返し、再生／停止／seek／モード切替、6シーンと通し再生 |
| SP | 390×844、360×800、横向き844×390。横はみ出し、顔・名前・ボタンの可読性、タップ、回転後のサイズ復帰 |
| 会場モニター | 1920×1080、ブラウザ倍率100%、操作非表示。16:9舞台内の見切れ・余白・文字サイズ・連続再生 |
| 実機 | PC Chrome／Edge、iPhone Safari、Android Chrome。実際の公開URLで確認。ブラウザ自動試験と実機確認を区別して記録 |

- 6シーンそれぞれが直URL・再読込で開ける。最初から繰返し再生でき、NEXT MATCH停止後に意図せず進行しない。
- 同じURLの端末ごとの再生は独立する。同時刻同期・Admin遠隔操作・実大会進行は対象外。
- Networkで同一originの静的素材以外への接続がない。Supabase／既存Workerへの要求、書込リクエスト、秘密値の露出がない。
- bundle依存と出力ファイルを検査し、本体chunk・未使用の写真／仮置き素材・秘密設定が混入していない。秘密値をログへ出力しない。
- 素材404・JSエラーなし。full/short/lite、reduced-motion、長い名前・顔なしを確認。実機の描画の滑らかさは実測結果として記録する。
- 通常buildと既存の演出・読取proxyテストを実行し、既存Admin／Display／Workerのファイル差分がないことを確認する。

本計画で到達するのは公開URLでのサンプル演出確認。実際の撮影登録、D1／R2への保存、端末同期、本番大会の進行は以下の既存M2以降の計画で扱う。

更新日: 2026-10-24。対象: `c40cfb7` と、この作業フォルダに追加済みのローカルリハーサル実装。依頼元: [docs/依頼.md](docs/依頼.md)。M1.1の読取クライアント・開発専用proxy・新規確認画面を実装。既存Admin／Display・Supabase・公開Worker・DB・R2は変更していない。

M1.1の最新状態: 135 unit tests、画面のloading・成功模擬応答・各エラー表示、既存プレビューの回帰確認を実施。実公開Workerは現在のローカル読取キーで401のため、実D1の成功表示は公開用キー設定後の確認待ち。[接続方法と検証結果](docs/CLOUDFLARE_CHECK.md)。M1.2以降は実装していない。

演出と進行制御の設計方針は [提案書](docs/TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md) を継承する。本書は次の実装単位・変更対象・確認方法を定める実行計画。Cloudflare初期構築はやり直さない。

## 1. 結論と次の最小単位

**次の1回の実装は「既存画面を変更せず、新規の確認画面からCloudflareの大会状態を読み取る」までに限定する（M1.1）。**

実装するものは、型付きAPIクライアント、秘密値をブラウザへ渡さないローカル開発用の読取プロキシ、新しいCloudflare状態確認画面。対象は `cf-rehearsal-001` のみ。成功時は大会名・scene・scene_seq・versionを表示し、失敗時は認証・大会権限・DB取得・通信障害を区別する。

既存 `/admin`・`/display` の直接差し替え、参加者INSERT、写真upload、勝敗更新は含めない。現在のGET APIには参加者一覧・写真・bracketが含まれず、既存Display全体を動かすには不足しているため。

その後は **管理認証 → 更新の共通基盤 → 参加者の文字情報 → 写真 → 抽選 → 勝敗・undo → Display同期 → 切替** の順に進める。

## 2. 現在確認できている状態

### 完了済みの基盤

| 項目 | 状態・確認元 |
|---|---|
| D1 | `tournament-rehearsal-db`、ID `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c`。前回CLIで実在確認 |
| D1 schema | 0001/0002適用済み、15アプリテーブル、検証大会1件・選手2名。前回SELECTで確認 |
| R2 | `tournament-rehearsal-portraits`／`tournament-rehearsal-media`。前回、非公開・空を確認。以後の件数は再測定していない |
| Worker | `tournament-rehearsal` 公開済み。今回CLIで公開・Secrets更新の履歴を確認 |
| API接続 | `依頼.md` のユーザー確認: health 200、state未認証401、DISPLAY_API_TOKENで200、remote D1の `cf-rehearsal-001` 取得成功 |
| ローカル演出 | `/show-preview`、`/presentation`、`/local-rehearsal` 実装済み |
| 回帰基準 | 前回81 unit tests、build、CF型チェック、ブラウザで8名完走・模擬カメラ4名登録成功。今回は文書のみのため再実行していない |

「ユーザー確認」「前回実測」「今回コード確認」を区別する。今回、公開APIの認証付き再試験はしていない。`.dev.vars` の秘密値を出力・転記していない。公開URLとサーバー側資格情報の設定元は、M1.1着手時に確認する。

### 最終目標8項目に対する実装状況

| 目標 | 存在する実装 | Cloudflareで残っていること |
|---|---|---|
| 1. Admin参加者登録 | CameraCapture、顔crop、参加者一覧。Supabase版／端末内版は存在 | Admin認証・大会認可、新APIと登録UIの接続 |
| 2. D1保存 | participants等のテーブル | 登録・編集・取得repository、入力検証、重複防止 |
| 3. 写真をR2保存 | R2バケットbinding、既存の写真生成処理 | PUT/GET、認可、upload状態、失敗補償、撮り直し |
| 4. 抽選をD1保存 | draw計算、brackets-manager、draw_sessions等のschema | サーバー計算、チーム・試合・snapshot等の原子的保存 |
| 5. 勝敗・undo | progression計算、Supabase更新、端末内undo | API更新、永続undo、競合検証。現行useProgressionのundoはrefであり再読込で失われる |
| 6. scene/version更新 | D1の両カラム、command_receipts、sceneMachine | version検証、更新コマンド、ログ、receiptの一括保存 |
| 7. Display反映 | Supabase Realtime＋1.5秒polling | CFの状態・bracket・画像取得、再取得、後にDO配信 |
| 8. Supabase依存切替 | API単位の既存ファイルはある | provider分離、直import解消、全利用経路の確認 |

現行Worker `cloudflare/src/index.ts` はGET healthとGET stateのみ。管理・Display両固定トークンとも読取専用で、POSTは405。EnvにはDBとトークン等しかなく、R2 bindingを使う処理、DOクラス、利用者セッションは存在しない。

APIと画面の型には差がある。state APIは `scenePayload`／`sceneSeq`／`startedAt`／`currentMatchId` のcamelCase、既存画面はsnake_case。既存 `EventStateRow` にversionはなく、`EventRow` はCF schemaにない `admin_token` を必須にしている。型assertだけで流用せず専用DTOを作る。GET stateにはevent.status・bracket・参加者一覧・写真がないので、それらを仮の値で埋めて既存Displayを動かさない。

`/local-rehearsal` はlocalStorage保存。D1/R2や複数端末の動作証拠として扱わない。

## 3. 既存動作を守る境界

- `/show-preview`、`/presentation`、`/local-rehearsal` はCloudflare・Supabase・ログインなしで使える状態を維持。
- 旧 `/admin`、`/display`、`/rehearsal` は初期段階で変更しない。新画面をlazy loadし、CF画面にSupabaseモジュールを読み込ませない。
- 既存のVITE_ADMIN_PASSCODEは画面ガードのみ。新APIの認証として流用しない。
- 公開済みhealth/stateのURL・応答・401/403/404/503と読取専用契約を保つ。新しい更新権限は別契約として追加。
- 0001/0002は編集・再適用しない。schema差分が必要な段階で新migrationを作る。
- 同じ大会にSupabaseとD1を二重書き込みしない。切替は大会ごとに固定し、失敗時に他DBや本番大会へ自動フォールバックしない。
- 既存のWINNER→NEXT MATCH自動、NEXT MATCH→START手動、最低5秒保持、full/short/liteを維持。プレビューのseekは試合状態を変えない。
- 現在の未コミット変更・ユーザー文書を保持。初回にSupabase SDKや旧演出資産を削除しない。

## 4. 段階別の実装順序・確認方法

### M0：初期準備・公開接続【完了として次へ進む】

D1・R2・Worker・Secrets・読取API接続は依頼内容により完了。追加のDB作成や初期化は不要。管理セッション・個人別認可・DO・業務APIの完了を意味するものではない。

### M1.1：新規画面でstateを読む【次の最小実装】

**対象範囲**

1. 既存JSON応答と一致する `CloudflareEventStateResponse` を定義。文字列sceneの妥当性、数値version、boolean、nullable値を境界で検証。
2. APIクライアントにタイムアウト・中断・エラー分類を設ける。APIからHTML／不正JSONが返った場合も画面が落ちないようにする。
3. 新規 `/cloudflare-check?eventId=cf-rehearsal-001` に大会名・environment・scene・sceneSeq・version・再取得ボタンを表示。
4. ローカル開発時は同一originの読取プロキシを使用する。サーバー側だけで選択した読取キーを付与。VITE変数、URL、localStorage、ブラウザのAuthorizationヘッダーへ固定キーを渡さない。
5. プロキシはlocalhost・GET・許可path・eventId・設定済みWorker originに限定。任意URLへ転送する汎用プロキシにしない。遠隔公開版の認証方式として使わない。

**変更対象案（まだ未作成）**

- 新規 `src/lib/api/cloudflareTypes.ts`、`cloudflareClient.ts` とテスト。
- 新規 `src/routes/CloudflareCheckPage.tsx`。
- 新規 `scripts/dev/cloudflareReadProxy.ts`、既存 `vite.rehearsal.config.ts` に開発時のみ接続。
- `src/App.tsx` に追加route、`src/routes/HomePage.tsx` に確認導線。
- サーバー専用ローカル設定の説明。秘密ファイルはGit除外。Workerのコード・D1/R2 schema変更は不要。

**確認方法・完了条件**

- Browser→ローカルproxy→公開Worker→remote D1→画面まで `cf-rehearsal-001` の同じ値を確認。
- キー誤り・許可外event・存在しないevent・未設定・通信断をテストし、再試行できる。
- proxyのPOST・許可外path・任意転送先が拒否される。
- frontend bundle・ブラウザ通信・画面・consoleに固定キーが含まれない。
- 81件の回帰テスト・build・CF型チェックと既存3プレビュー画面が成功。D1/R2の業務データ件数は変わらない。

**この段階でできないこと:** 参加者登録、写真表示、抽選、勝敗更新、旧Displayの置換。新画面に大会状態が出ればこの単位は完了。

### M1.2：運営・Displayの認証をアプリ用へ整理

**依存:** M1.1。更新APIを公開する前に完了。

- 運営人数・撮影端末に応じAdminセッション方式を確定。既存案のCloudflare Access＋WorkerでJWT検証・大会権限照合を第一候補とする。
- Displayは大会限定・読取専用・失効可能なセッション／ペアリングにする。固定の管理キーをブラウザへ配らない。
- サーバーがactorと権限を決める。cookie方式ならOrigin/CSRFを検証。期限切れ・失効と再ログインを扱う。
- 新しいCF Admin／Displayを `/cloudflare-admin` と `/cloudflare-display` 等の独立routeで追加し、旧画面を保つ。
- 同一originでSPA/APIを提供する経路を確定。現WorkerはSPA assetsもCORS/OPTIONS処理もないので、ブラウザ直fetchを追加するだけでは完了しない。

**変更対象:** 新規 `cloudflare/src/auth/`、`routes/session.ts`、共有セッションDTO、frontend session client、必要な権限migration・Worker設定。認証方式に伴う外部設定はこの段階で限定して行う。

**確認:** 未認証更新401、Display更新403、他大会403、期限切れ・失効・CSRF拒否。既存read-only APIは互換性テストを通す。

### M1.3：更新・保存の共通基盤

**依存:** M1.2。参加者登録の最初のD1書き込みに先行。

- event単位DOを全更新の窓口とし、awaitをまたぐ操作を明示的に直列化。DOを置くだけで自動的に安全とは扱わない。
- コマンドにrequestId・expectedVersion・対象ID・payloadを定義。actorはセッションから取得。
- 同一requestId/同一内容は既存応答を返す。同一ID/異なる内容は拒否。古いversionは409と最新stateを返す。
- domain変更・event_state・operation_log・command_receiptsをD1の原子的保存にまとめる。sceneは演出遷移のときだけ変更し、versionは確定更新ごとに増やす。
- 条件付きUPDATEが0件でもbatchは自動rollbackしない点に対応。競合時にdomain更新だけ成立しない設計を結合テストする。
- 永続状態の真実源はD1。DO停止・保存直後の応答断からreceiptで回復できる。WebSocket配信は後段で追加可能。

**変更対象:** 新規 `cloudflare/src/commands/`、`repositories/`、`objects/EventCoordinator.ts`、Worker route、DO binding/class migration、必要な新SQL。0002は既存のreceipt保存先として再利用。

**確認:** 同時2要求・再送・異なるpayload・旧version・途中失敗で、DB更新とversionが一度だけ成立。mock以外にローカルD1/DOで検証。

### M2.1：Adminから文字情報だけをD1へ登録

**依存:** M1.3。最初の業務機能の実装単位。

- 対象は既存検証大会。名前・rating・entry_noの登録と一覧取得に限定する。
- `POST/GET /api/events/:id/participants` を追加。UUID生成、名前・rating・受付状態、所属eventとenvironment、再送重複を検証。
- 写真なし／登録途中は明示し、抽選対象の可否を決める。二重タップと再読み込みで重複しない。
- 新CF Adminの登録フォームを接続。旧RegistrationPanelを全面置換せず、保存処理を注入できる形へ分離する。

**変更対象:** 新規 participants route/repository/command、ParticipantDTO、CF Adminのフォーム・一覧。`registrationApi.ts` は旧providerとして残す。

**確認:** 1名登録→画面再読込→D1 SELECTで同じID・名前・rating。Display権限での登録拒否、他大会・不正値・再送を検証。R2はまだ変更されない。

### M2.2：写真撮影→R2→再表示

**依存:** M2.1。

- `CameraCapture.tsx` と `faceCrop.ts` の撮影・顔crop処理を再利用。DB操作をimportするCameraCaptureは保存callback/adapterに切り離す。
- 原写真／顔cropのupload intent、容量・MIME・画像検証、R2保存、metadata commitを実装。新migrationで未完了状態と回収対象を記録する。
- R2とD1は同一トランザクションにできない。片方失敗時の再試行・補償・期限付き回収を用意し、未完了写真で登録完了扱いにしない。
- 非公開R2の顔画像を認可付きAPIで配信。撮り直しはrevision付きキーで保存し、新commitまで旧画像を保持。cache更新・失効を確認。

**変更対象:** 新規 portrait/upload route・service・repository・migration、WorkerのR2 Env型、CF版registration adapter、CameraCaptureと一覧、`faceUrl`／`teamFaces` のCF用解決。

**確認:** 実写1名で撮影→保存→再読込→別ブラウザで同じ顔。模擬カメラで自動検証、実カメラで手動検証。二枚目失敗・撮り直し・権限外GET・容量超過で整合性を確認。

### M3：抽選結果・チーム・bracketをD1へ保存

**依存:** M2.2。まず8名、次に16/32名。

- `draw.ts` と `bracket/manager.ts` の計算を共有・サーバー側再利用。Worker runtimeでbrackets-managerの互換性を先に検証。
- プレビューと確定を分け、保存済みreveal_orderで演出を再生する。再読込で再抽選しない。
- draw_sessions・teams・team_members・matches・events.bracket_snapshot・state・ログ・receiptを一貫して保存する。
- managerの整数match IDとD1のTEXT match IDの対応を維持。大会をまたぐチーム／参加者参照を拒否。
- サンプル32名のCF投入は専用rehearsal操作。ローカル保存データを暗黙に本番へuploadしない。

**変更対象:** 新規 draw service/repository/command、read model API、`drawApi.ts`／DrawPanelのadapter、`syncMatchesFromSnapshot.ts` のサーバー版、bracket/写真DTO。

**確認:** 8/16/32名の漏れ・重複・rating編成、奇数trio/bye、再送、保存途中失敗、再生やり直し。32名の処理量がD1のstatement/parameter制限内に収まるかも実測する。

### M4：勝敗確定・undo・scene/version更新

**依存:** M3。

- `progression.ts` の計算をWorkerへ移し、勝敗・snapshot・matches・current ID・state・ログ・receiptを一括保存。
- undoはブラウザから任意snapshotを送る方式にしない。サーバー保存済みの直前操作を対象にし、次試合が進んだ場合などの拒否条件を定義。
- NEXT MATCH最低5秒をサーバー時刻で検証し、STARTは手動。スキップで勝敗を変更しない。
- scene_seqとversionを分離。演出リプレイ・一時停止・seekが二重の勝敗確定を起こさないようにする。
- GF reset・最終勝者・優勝保持を確認し、優勝表示と写真削除を分離する。

**変更対象:** 新規 progression/scene command・service・undo repository、`progressionApi.ts`／useProgression／MatchControlのCF adapter、`sceneMachine.ts` の共有化、必要なログschema差分。

**確認:** 8/16/32名完走、GF reset、undo後の全read model照合、複数Admin、連打・再送・保存後応答断、finished後の写真保持。

### M5：Displayへの反映と演出接続

**依存:** M3/M4。段階的に行う。

1. まずCF Displayでstate・bracket・チーム・写真をGETし、短いpolling／明示更新で反映を確認。取得は読取だけでD1を書き換えない。
2. DO WebSocketと再接続時の最新state取得へ拡張。古いversionを破棄し、通信断から復帰する。
3. DrawScene／ResultSceneのDB更新をCF表示経路から取り除く。Admin／サーバーが遷移を所有し、必要な完了ackはversion付きで冪等にする。旧Supabase経路の動作は維持。
4. 実チーム・写真・更新前後のbracketを共有演出へ接続。次試合が直前勝者を含まない場合、未確定、最終試合を分岐する。
5. 開始時刻・時計差・playback位置を扱い、再接続で過去の衝突SEを連発しない。音声・素材失敗時は静的／無音で続行。

**変更対象:** 新規CF read-model hook／subscription、CF Display、`useEventState.ts`／useBracketDisplayのprovider境界、`DrawScene.tsx`／`ResultScene.tsx` のcallback分離、`PostMatchStage.tsx`、必要なPlayer/音声adapter。

**確認:** Adminの更新→別Displayのversion一致、2台の再接続・リロード、Display不在でも進行、Displayから更新が送られないこと。NEXT MATCH保持・手動STARTと優勝分岐の画面録画。

### M6：provider切替・運用リハーサル

**依存:** M1～M5。

- 全機能が揃ったCF大会だけに旧Admin／Displayの導線を切替。SupabaseとCFのproviderは大会単位で固定。
- `AdminPage.tsx` の大会メタ情報更新、`DisplayPage.tsx` のevents取得、PlaylistPlayer／MediaManager／eventCleanup／rehearsalActionsの直接Supabase呼び出しも棚卸しする。
- 広告・プレイリストなど当日不要な機能はCF画面で未対応と明示する。使わない機能が裏でSupabaseへアクセスしないことを確認。
- 写真cleanupは処理状態を保存して再試行可能にする。表彰後の別操作で削除し、DB/R2/cacheを照合。
- 会場端末・音響・ネットワークで30分以上確認し、当日手順・バックアップ・手動進行・復旧手順を更新。

**確認:** 実写8名とサンプル32名の通し、Supabase通信0、CF画面にSupabase環境変数不要、認証失効・通信断・復旧、写真削除は使い捨て検証データのみ。本番環境への公開・切替はこの合格後に対象を明示して行う。

## 5. 全体順序と段階ごとの見える成果

| 順番 | 最小単位 | 見える成果 | 書き込み先 |
|---|---|---|---|
| 1 | M1.1 読取接続 | 新しい画面に実D1の大会名・scene・version | なし |
| 2 | M1.2 認証 | 運営とDisplayの権限を分離 | セッション／権限管理 |
| 3 | M1.3 共通保存 | 再送・競合・保存失敗を一貫して処理 | 検証用D1、DO |
| 4 | M2.1 文字登録 | Adminから名前・ratingを登録して再表示 | D1 |
| 5 | M2.2 写真 | 実写1名を別ブラウザで表示 | R2＋D1 |
| 6 | M3 抽選 | 写真付きチームと保存済みbracket | D1 |
| 7 | M4 進行 | 勝敗・undo・scene更新・優勝 | D1 |
| 8 | M5 Display | 別画面への最新状態反映・演出 | 読取／配信 |
| 9 | M6 切替 | Cloudflareだけで運用リハーサル | 検証環境全体 |

## 6. 実装着手時に確定する設定・判断

- M1.1: 使用する公開Worker URL、remote用Display資格情報のサーバー側設定元。local用.dev.varsと公開Secretsが同じとは仮定しない。秘密値はチャットに貼らずローカル設定で扱う。
- M1.2: Admin認証と大会権限、Displayペアリング、同一origin公開経路。新しい依存パッケージが必要なら導入対象と影響を示して事前確認。
- M2.2: 実写の取扱い・保存期間・削除責任者。R2の公開URLは有効化しない。
- M5/M6: 1出力分配／独立Displayの構成、音声を出す端末、同期精度と会場解像度。

これらは後段の完了に必要な判断であり、今回の調査・計画提出を止める条件ではない。

## 7. 回帰確認・中断・復旧

- 基準テスト: `npm run test:rehearsal`、`npm run build`、`npm run cf:typecheck`。CFのtsconfigは現在index.tsのみがinclude対象なので、分割時は新Worker実装全体の型検査範囲を明示する。
- unitで認可・DTO・進行計算を確認し、ローカルD1/R2/DOで保存と再送を結合検証。mock成功をremote成功と扱わない。
- 各段階の認証付き手動／E2E確認と、既存プレビュー3画面の回帰確認を行う。実カメラ・会場音響は模擬入力と別に確認。
- 最初の読取画面はrouteと開発proxyを外せば戻せる。旧画面・DBには変更がない。
- 更新開始後は書き込み停止→version・ログ・バックアップ確保→schema互換の安定版へ復帰→整合性確認の順。旧Supabaseへ自動切替しない。
- 公開Workerの更新時はhealth/state契約を回帰確認。新migrationは互換的に追加し、実D1を消して復旧しない。

## 8. 根拠となるファイル

- Worker契約: `cloudflare/src/index.ts`、`index.test.ts`、`cloudflare/migrations/0001_tournament.sql`／`0002_command_receipts.sql`。
- Supabase境界: `src/lib/event.ts`、`supabase.ts`、`hooks/useActiveEvent.ts`、`hooks/useAdminPasscode.ts`。
- 登録: `src/features/registration/registrationApi.ts`、`CameraCapture.tsx`、`faceCrop.ts`。
- 抽選・進行: `draw/draw.ts`、`draw/drawApi.ts`、`bracket/manager.ts`、`progression/progression.ts`、`progressionApi.ts`、`useProgression.ts`、`scene/syncMatchesFromSnapshot.ts`。
- scene・Display: `scene/useEventState.ts`、`sceneActions.ts`、`routes/DisplayPage.tsx`、`presentation/scenes/DrawScene.tsx`／`ResultScene.tsx`。
- ローカル比較用: `rehearsal/localTournament.ts`、`routes/LocalRehearsalPage.tsx`、`presentation/postMatch/`。

[Cloudflare実環境の記録](docs/CLOUDFLARE_REQUIRED_ACTIONS.md)／[読取API手順](docs/CLOUDFLARE_API_RUNBOOK.md)／[演出確認手順](docs/REHEARSAL_PREVIEW_GUIDE.md)。
# 2026-10-30 更新版依頼：公開受付からChampionまでの環境整理

実行計画と調査結果の正本は[ENVIRONMENT_CONSOLIDATION.md](docs/ENVIRONMENT_CONSOLIDATION.md)。旧計画・既存変更を保持する。

- [x] 更新版依頼を再読。scripts/config/route/entry/auth/assetsとAdmin白画面原因を照合。
- [x] Cloudflare APIで既存8 Workerのdeploy版・D1/R2/ASSETS/Secret名を読み取り棚卸し。新Workerなし。
- [x] トップを大会開始＋受付・運営・Displayへ整理。開発ツールを折り畳み、旧入口は非表示。
- [x] localhostの7 routeでdirect/reload、トップ、開発ツール、接続確認成功。受付編集・写真差替え・別session・logoutの既存E2Eも成功。
- [x] 27ファイル181 unit tests、型検査とbuild成功。
- [x] 既存canonical Workerだけへdeployし、公開7 routeと8人の模擬カメラ連続登録・Championを確認。D1参加者8件・R2写真8件とAPIのbyte一致・完了試合3件を照合。競合409と中断再開は記録。
- [x] 実スマートフォン受付用の空大会を準備し、最終結果を確認済み/未確認/未実装で引き渡す。
- [ ] 実スマートフォンの撮影・登録（ユーザー実機での結果待ち。PC模擬カメラとは区別）。
# 連動が分かる公開版・デプロイ準備（ユーザー依頼 2026-10-30）

1. **導線の正本化**：TOP→Rehearsalを主経路にする。ログイン後に大会を作る操作と、既存runを開く操作をはっきり示す。旧Supabase版、旧検証route/previewを通常メニューから隠す。コード・データは削除しない。
2. **連動を画面で説明**：Rehearsalへスマホ受付→D1/R2→Admin command→同じrunのDisplay反映を図示。大会ID・各画面のrun付きURL、推奨端末、5秒ポーリングを表示。3端末で開くリンクにrunを確実に引き継ぐ。
3. **手動と自動を分離**：実データで手動テストする手順と、模擬勝者を記録する自動全通しの影響を分けて表示。現在の状態に対応する次操作を案内。自動進行中にDisplayが書込みをしないことを確認。
4. **操作画面の範囲整理**：通常のトップ・受付・Admin・Display・Rehearsalのみを主導線として保持。個別演出・接続確認は折り畳み開発ツール。旧Supabaseの通常入口を露出させない。
5. **デプロイ前確認**：関連する画面・同run接続・一連の手動/自動進行の検査、build/typecheck/test、既存canonical Workerのdry-runを実施。公開環境には今回書き込まない。
6. **引渡し**：再現command、反映データ経路、各画面URLの役割、確認結果、未解決の実機事項をdocsへ記載し、公開前のレビュー可能な状態で止める。

### 実施状況（2026-10-30）

- [x] Main entryから共有大会のRehearsalを主経路にし、受付・Admin・Displayをrun付きで開く表示に変更。
- [x] D1参加者/R2写真・Admin進行API・Displayの共有状態・約5秒更新をRehearsalで説明。状態ごとの次操作、達成ステップ、対戦数を表示。
- [x] 実データ手動運営と、自動Team A模擬勝者全通しを折りたたみで明確に分離。
- [x] Legacy/Supabaseを標準route/nav/buildから除外。個別画面と開発ツールは折りたたみ導線に配置。既存コード・依存・Workerは保管。
- [x] localhostの新導線→空run作成→別PCセッション→4名受付→Admin一覧反映→受付終了→ペア発表を通し確認（runは環境verification証跡参照）。
- [x] build成功。27ファイル・181件の回帰テストと2 Worker config deploy dry-run成功。
- [x] 実環境へはdeployしない。今回の変更は公開前レビューで止める。
