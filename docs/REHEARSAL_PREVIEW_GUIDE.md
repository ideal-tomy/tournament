# リハーサルで演出を確認するための手順

作成日: 2026-10-24。対象: 新規クローンした `ideal-tomy/tournament` の `c40cfb71ea1cce6905e535f72b216384bd6243b9`。

本書は現在のコードでできる演出確認と、その先に必要な作業を記す。写真撮影から大会完走までの実装は [PLAN.md](../PLAN.md) を参照する。演出・進行の設計方針は既存の [提案書](./TOURNAMENT_SHOW_DESIGN_AND_CONTROL_PROPOSAL.md) を継承する。

## 追加実装：今使えるローカルリハーサル（2026-10-24）

以下は基準commitへの追加変更。後述の初回調査記録より新しい状態。

```powershell
Set-Location 'C:\Users\ryoji\00myapp\ai_demo_workspace\tournament-latest-review-20261024'
npm run dev:rehearsal
```

- <http://127.0.0.1:5174/local-rehearsal>: サンプル8/16/32名、またはカメラ撮影→端末内登録→抽選一覧→NEXT MATCH→手動START→勝敗→優勝。undo・試合リセット・リロード復元あり。
- <http://127.0.0.1:5174/show-preview>: 単独の連続演出を再生・停止・シーク・スキップして調整。
- <http://127.0.0.1:5174/presentation>: ダーツ抽選などを含む操作説明用の固定サンプル。

連続演出プレビューには「同梱の顔写真で確認」を追加した。初期状態で同梱写真を使い、OFFにすると以前のplaceholderに切り替わる。

ローカル大会はこのoriginのlocalStorage（`tournament.local-rehearsal.v1`）にのみ保存する。実写は240pxの中央クロップ。登録し直す場合は撮り直して別登録できるが、登録済み参加者の編集・差し替えは未実装。撮影に同意した検証者の画像で試し、終了後は「端末内データ消去」で消去する。原写真のクラウド保存・顔検出・別端末同期・音声は含まない。

操作順：8名で準備→チーム抽選→対戦紹介→最低5秒保持→START→勝者を確定→結果確認→NEXT MATCH→START。大会エンジンは既存のダブルイリミネーション計算を再利用する。共有連続演出は、直前勝者が次試合に出る場合に実名・実画像で再生できる。それ以外は勝者と次対戦を分けて表示する。抽選一覧は静的表示であり、本番のダーツ抽選演出の接続は未完了。結果から次試合への移動も、この確認画面では手動で段階を確認する。

Cloudflare側のD1・R2に続き、Worker公開と認証付き読取も完了したとの報告を受領。初期接続を繰り返さず、次のアプリ実装は [PLAN.md](../PLAN.md) を参照。履歴と最新状態は [CLOUDFLARE_REQUIRED_ACTIONS.md](./CLOUDFLARE_REQUIRED_ACTIONS.md) に記録した。

追加実装の検証：81 unit tests成功。ブラウザ自動テストでは8名6試合完走、undo、リロード復元、連続演出の停止・スキップ、模擬カメラ4名登録と抽選成功。JS例外なし、Supabase／Cloudflareへのリクエストなし。実カメラ・会場音響は未検証。スクリーンショットは `docs/local-rehearsal-check/`。

以下は新規クローン直後の調査・プレビュー手順の記録。通常の起動は上の `npm run dev:rehearsal` を使う。

## 1. 先に使う画面を選ぶ

| 確認したいこと | 画面 | DB | 現在できること・限界 |
|---|---|---|---|
| 勝者→進出ライン→接近→光→VS→NEXT MATCHの連続演出 | `/show-preview` | 不要 | 共有ステージの試作。固定チーム・placeholder画像。音声、実試合、32名抽選は未接続 |
| 登録・抽選・試合開始などの操作説明 | `/presentation` | 不要 | 同梱サンプルによる説明画面。撮影・保存・実際の勝敗処理はしない |
| サンプル32名の登録・抽選・勝敗とDisplayを確認 | `/rehearsal` | Supabase必須 | 旧接続先が使えず、現在は失敗する。Cloudflareへは未接続 |
| 実写撮影から当日と同じ大会運用を確認 | 将来のCloudflare版Admin／Display／rehearsal | D1・R2・API等 | 未実装。[PLAN.md](../PLAN.md) のM1～M6で実現する |

最初は `/show-preview` を直接開く。`/rehearsal` や `/demo` でDBエラーを解消する必要はない。`/demo` も既存実装ではSupabase依存。

## 2. クローン結果と前回調査との照合

クローン先:

```text
C:\Users\ryoji\00myapp\ai_demo_workspace\tournament-latest-review-20261024
```

元の `tournament` フォルダは保持した。今回のクローンには元フォルダの未追跡文書・`.env.local`・秘密値をコピーしていない。

| 前回の調査事項 | クローンで再確認した結果 |
|---|---|
| 元フォルダは `6670797`、GitHubは1コミット先 | クローンHEADは `c40cfb7`。前回のGitHub確認と一致 |
| Cloudflareは読取専用APIまで | `cloudflare/src/index.ts` で確認。状態取得のみ。登録・写真・勝敗更新APIなし |
| 既存画面はSupabaseのまま | registration／draw／progression／rehearsal／cleanupの主要APIは旧版から変更なし |
| Supabase接続先のDNS障害 | 元フォルダで使用中だったホストは今回も `ENOTFOUND`。対照の `supabase.com` は解決成功 |
| DB不要のプレビューあり | `App.tsx` はlazy load。`ShowPreviewPage` と `PostMatchStage` はDB APIをimportしない |
| Cloudflareの実リソースは未確認 | 変わらず未確認。設定例のD1 IDだけで作成済みと判断しない |

今回補足できたこと: `/presentation` もDBを使わず、運営の流れを説明する用途で使える。`/show-preview` は現在の本番Display全体の再現ではなく、連続演出の試作である。

## 3. このPCで起動する

### 3.1 準備済みのもの

- クローン済み。Node `v22.14.0`、npm `11.1.0` を確認した。
- `node_modules` は元の `tournament/node_modules` を参照するWindows junction。新規パッケージのインストールはしていない。
- 両フォルダの `package-lock.json` は改行差があるが、解析した `packages` の内容は一致した。既存のインストール済みパッケージを再利用した検証であり、clean installの再現性確認ではない。
- `vite.review.local.ts` はこのPCだけの確認用設定。既存 `vite.config.ts` を読み、`resolve.preserveSymlinks: true` を追加する。Gitのローカル除外設定に登録済みで、クローン元には存在しない。
- Supabase環境変数・Cloudflare設定・秘密キーはこの演出プレビューには不要。

元フォルダの `node_modules` を移動・削除するとこの参照も使えなくなる。以後この共有環境で依存関係を変更する場合は元フォルダにも影響するため、独立した環境へ切り替える。

### 3.2 起動コマンド（PowerShell）

```powershell
Set-Location 'C:\Users\ryoji\00myapp\ai_demo_workspace\tournament-latest-review-20261024'
npm run dev -- --config vite.review.local.ts --host 127.0.0.1 --port 5174 --strictPort
```

ターミナルを開いたまま、ブラウザで直接アクセスする。

- 連続演出: <http://127.0.0.1:5174/show-preview>
- 操作説明: <http://127.0.0.1:5174/presentation>

`strictPort` のため5174が使用中なら停止する。既存プロセスを無断で終了せず、例えば5175へ変更してURLも合わせる。終了は起動したターミナルで `Ctrl+C`。

この手順は起動方法の記載であり、今回サーバーを起動したままにはしていない。

### 3.3 別のPCや独立環境で起動する場合

GitHubからのクローンには `node_modules` と `vite.review.local.ts` は含まれない。パッケージ導入の承認後、lockfileに沿って `npm ci` を実施し、標準設定で起動する。すでに存在するjunctionへ `npm ci` を実行しない。まず別の独立クローンを用意するか、参照先を保護して環境を切り離す。

```powershell
# 独立したクローンのルートで、パッケージ導入の承認後に実施
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

`/show-preview` と `/presentation` だけを確認する段階では `.env.example` をコピーする必要はない。ダミーのSupabase設定で `/rehearsal` を動かそうとしない。

## 4. 連続演出の確認手順

1. `/show-preview` を直接開き、「連続演出プレビュー」「ローカルサンプル専用」の表示を確認する。
2. 会場Display相当のブラウザサイズを1920×1080にし、ページ全体とステージの両方が見える状態にする。
3. モードを `full` にし、「最初から再生」を押す。
4. WINNER → BRACKET ADVANCE → OPPONENTS → IMPACT／VS → NEXT MATCHの順序を確認する。
5. 顔カードが途中で消えないこと、接近より前に光が出ないこと、光が繰り返されないことを確認する。
6. NEXT MATCH到達後、30秒待っても勝手に試合が始まらないことを確認する。
7. 再生途中で一時停止し、停止中に時間が進まないことを確認。再開して途中から進むことを確認する。
8. スライダーで前後の位置を確認する。シーク後は停止状態になる。
9. 「演出スキップ → NEXT MATCH」で最終表示へ進み、勝敗データへの処理が発生しないことを確認する。
10. `short`、`lite` に切り替え、先頭へ戻って停止することを確認してから再生する。liteでは衝突の光を省略する。
11. `/presentation` で登録から勝敗入力・次試合までの説明を確認する。ここで操作できても実登録の成功とは扱わない。

現在のタイミング値（`postMatch/timing.ts`。合意済みの本番尺ではない）:

| モード | 進出開始 | 接近開始 | 衝突 | NEXT MATCH保持へ到達 |
|---|---:|---:|---:|---:|
| full | 4.0秒 | 6.0秒 | 8.0秒 | 9.5秒 |
| short | 2.8秒 | 4.2秒 | 5.6秒 | 6.65秒 |
| lite | 2.0秒 | 3.0秒 | 4.0秒（光なし） | 5.0秒 |

この試作では4人ともplaceholder画像。サンプル32名の実画像、ダーツによる抽選、実ブラケット座標、優勝分岐、会場音声は別の確認になる。

## 5. 確認結果の残し方

スクリーンショット・画面録画は、同じcommit、モード、解像度で比較する。操作ボタンが見える記録と、会場に投影する範囲の記録を区別する。

```text
確認日:
commit: c40cfb7
URL / モード / 解像度 / ブラウザ:
確認者:
WINNER→進出→接近→衝突→VS: OK / NG
顔の継続表示・衝突回数: OK / NG
停止・再開・シーク・スキップ: OK / NG
NEXT MATCHを30秒保持: OK / NG
画像欠落・文字切れ:
問題の秒数・再現操作:
スクリーンショット／録画の保存先:
```

音声は「未接続」と記録し、無音を音声確認合格にしない。実機の操作・見た目の確認は今回未実施。

## 6. 失敗したときの切り分け

| 症状 | 確認・対応 |
|---|---|
| `vite.review.local.ts` がない | このPCの確認用ファイル。別クローンでは独立環境の標準起動手順を使う |
| `vite` 等が見つからない | `node_modules` の参照先が存在するか確認。新規導入が必要なら承認後に独立環境で実施 |
| GSAPの解決エラー | junction再利用時は上記確認用設定を指定。標準の `npm test` はこの構成で1 suiteの解決に失敗した |
| ポートが使用中 | ポートとアクセスURLを同時に変更する |
| Supabase設定エラー | `/show-preview` を直接開いているか、古いアプリや別ポートでないか確認。再現する場合はconsoleの最初のエラーを記録 |
| リハーサル失敗と出る | `/rehearsal` はDB依存。演出試作は `/show-preview`、実運用リハーサルはPLANの実装後 |
| アニメーションが軽い／光が出ない | lite選択とOSの「動きを減らす」を確認。初期モードはOS設定でliteになる |
| 音が出ない | このプレビューは音声未接続。会場音響確認はPLAN M5/M6へ |
| Cloudflareのhealthだけ成功 | 状態APIが実D1を読めるかは別。写真・更新機能の完成証拠にもならない |

## 7. 実際の32名リハーサルへ進む条件

演出試作の確認だけで、現行 `/rehearsal` のエラーは解消しない。Cloudflareへ移行する方針では次を完了する。

1. 既存D1・R2・Workerの所在と適用状況を確認する（PLAN M0）。
2. 運営・Displayの認証と権限、状態取得をつなぐ（M1）。
3. 実写撮影・登録・再撮影・別端末表示を実装する（M2）。
4. 32名の登録とチーム抽選をAPIへ接続する（M3）。
5. 勝敗確定・undo・手動START・優勝までを接続する（M4）。
6. 本番演出・同期・音声・復旧をつなぎ、実機で通す（M5/M6）。

## 8. 今回の検証記録

| 検証 | 結果 |
|---|---|
| 新規clone、commit、主要ファイルの照合 | 完了 |
| 最新コードのテスト | 確認用設定 `resolve.preserveSymlinks: true` で16ファイル74テスト成功 |
| `npm run cf:typecheck` | 成功 |
| `npm run build` | 成功。Supabase環境変数なしでビルド |
| ブラウザ操作・スクリーンショット・会場実機 | 未実施。本書の手順4で確認する |
| Cloudflare remote D1／R2／Worker、写真登録、実大会完走 | 未実施・業務機能は未実装 |

今回の再検証コマンド:

```powershell
npm test -- --config vite.review.local.ts
npm run cf:typecheck
npm run build
```

WorkerテストのD1はmockであり、74件成功はCloudflare実接続の成功を意味しない。コード本体・依存定義・秘密値・公開環境は変更していない。
