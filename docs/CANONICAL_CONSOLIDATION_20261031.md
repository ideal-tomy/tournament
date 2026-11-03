# canonical統合の最終確認（2026-10-31）

## canonical環境

Worker: `tournament-through-rehearsal`。URL: https://tournament-through-rehearsal.pine-shaken.workers.dev 。今回公開version: `e50c2ab3-a248-4d60-8799-f744b0d33eab`。

既存の通しリハーサルWorkerは全route・認証・試合進行・D1/R2を既に備えており、これを継続する。新Workerは作成していない。既存Worker・D1・R2・過去runを削除していない。

## deploy

使用config: `cloudflare/checkin/wrangler.through-rehearsal.jsonc`。

唯一の通常公開command: `npm run deploy:rehearsal`（型検査→build→既存Workerのdeploy履歴を確認→固定名の既存Workerを更新）。`npm run deploy:check` は同じconfigだけをdry-runする。Worker名の自動生成はない。公開wrapperは `--name`・`--env` 等の上書きを拒否し、固定名と既存Workerへのアクセスを確認できない場合は停止する。wrapper dry-runと実際のdeployments listを検証済み。`npm run dev` はローカル専用configで公開しない。

旧7設定と旧ひな形は元の場所に `.disabled` を付けて保管した。復元しない限り過去のconfigパスを指定するcommandは失敗する。CI定義はない。旧検証script内の旧URLは過去の試験の記録であり、今後実行する入口ではない。旧初期構築runbookにも現行手順を追記した。

## Resources

D1 binding: `DB`。名前: `tournament-rehearsal-db`。ID: `0a7528e1-7f14-4e54-a896-4fbe2cf2c42c`。

R2 portraits: `PORTRAITS` → `tournament-rehearsal-portraits`（非公開）。R2 media: canonicalにはbindingなし。旧APIのみ `MEDIA` → `tournament-rehearsal-media` を参照。追加・削除なし。

Frontend: `vite.checkin.config.ts` → `dist-checkin` → `ASSETS`。API: `cloudflare/checkin/src/index.ts`。全画面とAPIが同じorigin。旧Supabase版は通常公開経路で使用しない。

## Worker一覧

Cloudflare APIの実測日時: 2026-10-31T09:08:11.075Z。各DB名はD1一覧とIDで照合。詳細は [workers.json](environment-verification/workers.json)。deploy元はWorker名・bindingとrepo configの対応であり、過去の実行コマンドやソースの完全一致を証明するものではない。canonicalの今回deployはCLI出力で確認した。過去全versionのbinding変遷は未確認。

| Worker | Deploy元 | 用途 | Frontend | API | D1 | R2 | 現在必要か |
|---|---|---|---|---|---|---|---|
| tournament-animation-preview | `cloudflare/wrangler.animation-preview.jsonc.disabled` | 旧検証 | 旧静的Preview | なし | なし | なし | 削除候補 |
| tournament-checkin-e2e | `cloudflare/checkin/wrangler.e2e.jsonc.disabled` | 旧検証 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | 削除候補 |
| tournament-checkin-rehearsal | `cloudflare/checkin/wrangler.jsonc.disabled` | 旧検証 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | 保留（旧通常受付の利用者確認が必要） |
| tournament-flow-e2e | `cloudflare/checkin/wrangler.flow-e2e.jsonc.disabled` | 旧検証 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | 削除候補 |
| tournament-match-loop-e2e | `cloudflare/checkin/wrangler.match-loop-e2e.jsonc.disabled` | 旧検証 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | 削除候補 |
| tournament-pair-gates-e2e | `cloudflare/checkin/wrangler.pair-gates-e2e.jsonc.disabled` | 旧検証 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | 削除候補 |
| tournament-rehearsal | `cloudflare/wrangler.jsonc.disabled` | 旧検証 | なし | 旧読取API | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | MEDIA: tournament-rehearsal-media, PORTRAITS: tournament-rehearsal-portraits | 削除候補 |
| tournament-through-rehearsal | `cloudflare/checkin/wrangler.through-rehearsal.jsonc` | 通し大会 | ASSETS / dist-checkin（repo対応） | checkin/src/index.ts（repo対応） | DB: tournament-rehearsal-db / 0a7528e1-7f14-4e54-a896-4fbe2cf2c42c | PORTRAITS: tournament-rehearsal-portraits | canonical |

各Workerの現在のD1/R2は同じ共有リソース（bindingがあるもの）であり、Workerを分けてもデータは隔離されない。今回canonicalの公開前後のDB/R2接続先は一致。削除候補は6 Worker。旧通常受付は外部利用の有無が不明なため保留。共有D1/R2はWorker削除候補に含めない。

## 古い写真問題

確認できた混入経路は、Rehearsalの「登録済み参加者をコピー」、生成サンプルの登録、`through-initialization` に残った写真付き登録の再送。旧Worker群は同じD1/R2を共有し、旧configの固定eventが旧参加者を返す。これらはコード上の再表示経路であり、ユーザーが見た個別の発生時刻・画像をログから特定したものではない。

修正: Rehearsalの新規準備を0名開始だけに限定。古い写真付きlocalStorageを読む処理を廃止し、新しい空run用キー `through-empty-initialization-v2` を使用。canonicalの `REHEARSAL_SOURCE_EVENT_ID` を除去し、旧大会コピーAPIは503、旧source写真の例外参照も無効化。古いlocalStorage自体はデータ保護のため消去しない。

run未指定は409、未作成runは404で、別eventへのfallbackはない。portrait URLのeventと明示runが違う場合も404に修正。DB queryとR2 keyはevent・participantで制約。参加者・teams・matchesは選択eventに紐づく。写真cacheはevent変更時に破棄するメモリのみ。sessionStorageやService Workerで別runを復元する実装はない。写真エラーは明示エラーで、sampleへのfallbackはない。FixtureStageはshow-preview専用。過去に意図的にサンプルを保存したrunは削除せず保持するため、その古いrunのURLでは当時のサンプルが引き続き見える。

cache: API・写真・HTMLは `Cache-Control: no-store`、frontend API/写真fetchも `cache: no-store`。`/assets/*` と `/tournament-effects/*` はASSETSのcache headerを保持するよう修正。旧実装の全response一律no-storeを解消。

## 検証

Unit: 27ファイル・182件成功（missing run、存在しないrun、写真のevent/run不一致、APIとstaticのcache分離を含む）。型検査・build・canonical dry-run成功。公開E2E結果は後述。

## 新規runテスト

run ID: `cf-through-405eb893-2b21-4583-b592-703c4e9c214a`。

初期participants: **0名**。スマホ相当390×844・touch・PC Edge模擬カメラで1名撮影登録後: **1名**。別ブラウザsessionの開いたままのDisplayに自動反映。追加登録後: **8名**。D1 8名、R2 8 object、写真APIとR2の全byte一致（480×480）。この試験の緑色の写真は今回の模擬カメラ撮影結果で、過去fixtureではない。

受付終了→ペア発表→Bracket→VS→試合開始→Winner→Bracket更新→Next Match→決勝→Champion。4チーム・3試合、finished。DisplayリロードでもChampion復元。模擬勝者は各試合のTeam Aであり、実試合の勝敗ではない。

全7画面の直アクセス/reload HTTP 200と認証後描画を確認。APIは同一origin。公開APIでrun未指定409・未作成run404・旧sourceコピー503・選択runの参加者8名だけ・API no-store・JS assets cache維持を確認。

証跡: [公開E2E JSON](environment-verification/consolidation-20261031/public/result.json)、[D1/R2照合](environment-verification/consolidation-20261031/public/data-audit.json)、[公開隔離・cache確認](environment-verification/consolidation-20261031/public/isolation.json)、[Champion](environment-verification/consolidation-20261031/public/champion.png)。

JS例外: 0件。想定外HTTP失敗: 0件。状態読取409: 7件。自動進行で回復したadvance409: 0件。実スマートフォン・Safari・実会場機材は今回未確認。

最初の試験scriptは旧UI由来の「開発ツール」selector重複で新規run作成前に停止。selectorを更新して上記を新規実行し、失敗を成功件数に含めていない。

## Route（同じ完了run）

| 画面 | URL |
|---|---|
| TOP | https://tournament-through-rehearsal.pine-shaken.workers.dev/?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |
| Check-in | https://tournament-through-rehearsal.pine-shaken.workers.dev/checkin?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |
| Admin | https://tournament-through-rehearsal.pine-shaken.workers.dev/admin?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |
| Display | https://tournament-through-rehearsal.pine-shaken.workers.dev/display?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |
| Rehearsal | https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |
| Animation Preview | https://tournament-through-rehearsal.pine-shaken.workers.dev/show-preview?run=cf-through-405eb893-2b21-4583-b592-703c4e9c214a |

## 旧Workerの扱い

- canonical: `tournament-through-rehearsal`。
- 削除候補: `tournament-animation-preview`、`tournament-checkin-e2e`、`tournament-flow-e2e`、`tournament-match-loop-e2e`、`tournament-pair-gates-e2e`、`tournament-rehearsal`。
- 保留: `tournament-checkin-rehearsal`。従来の通常大会・配布済みリンクの外部利用を確認してから判断する。

削除は実行していない。候補の名称は現行canonical機能で代替できることを示し、外部利用がゼロであることの証明ではない。D1/R2は共有なので削除しない。
