# 公開演出Previewの操作・更新手順

2026-10-24。サンプル演出の確認専用。実際の参加登録・試合運用は行わない。

## 公開URL

https://tournament-animation-preview.pine-shaken.workers.dev/

| 確認対象 | URL |
|---|---|
| Draw | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=draw |
| Result | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=result |
| Bracket advance | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=bracket |
| VS | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=vs |
| NEXT MATCH | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=next |
| Champion | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=champion |
| 通し再生（自動再生） | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=all&autoplay=1 |
| モニターで優勝演出（自動再生） | https://tournament-animation-preview.pine-shaken.workers.dev/?scene=champion&controls=0&autoplay=1 |

モードは `mode=full`／`short`／`lite`、長い名前は `fixture=long`。未指定時はfull、端末の動きを減らす設定が有効な場合はlite。音声はない。

## 操作

1. 同じURLをPC・スマホ・会場モニターで開く。シーンを選び「最初から再生」を押す。
2. 一時停止・再開・確認位置のスライダーで調整したい場面を確認する。再生完了後も「最初から再生」で繰返し確認できる。
3. 全体の通し再生はDraw → Result → Bracket advance → VS → NEXT MATCH。NEXT MATCHで停止する。「優勝演出へ進む」でChampionを確認する。試合開始処理はない。
4. 「モニター表示」で操作パネルを隠す。「操作を表示」で戻る。16:9を保ち、1920×1080・倍率100%では舞台が画面全体に収まる。全画面API非対応端末はモニター表示か端末側の全画面機能を使う。
5. スマホは縦・横の両方で確認する。舞台は16:9で縮小するため、顔や文字の細部は横向きが適している。

端末ごとに再生は独立する。URLは選択シーン・モード・長い名前・操作表示の設定を保持するが、再生位置の同期はしない。通し再生のURLを再読込すると先頭へ戻る。

## 演出の範囲

- Result／Bracket advance／VS／NEXT MATCHは既存 `PostMatchStage` の表示を再利用。
- Bracket advanceは模式図であり、実大会の勝ち上がりデータに接続していない。
- Drawはダーツ・カード反転・ペア成立、Championは優勝タイトル・メンバー・紙吹雪のfixture専用実装。本番DrawSceneとは別の描画実装なので、完全一致の回帰検証にはならない。
- 顔は同梱のプレースホルダー。撮影、upload、端末保存、DBアクセスはない。

## ローカルでの修正・確認

新規依存は追加していない。既存依存が利用できる作業環境で実行する。

```powershell
npm run build:animation-preview
npm run preview:animation-preview
```

http://127.0.0.1:4175/ で公開用出力を確認できる。ビルドはTypeScript検査、専用Vite出力、混入検査の順。通常の `npm run build` は従来アプリ用であり、公開Previewには `dist-animation-preview/` だけを使う。

主な変更先は `src/preview/PreviewApp.tsx`（操作・シーン選択）、`FixtureStage.tsx`（Draw・Champion）、`preview.css`（見た目）、`fixtures.ts`（サンプル）。既存の共通 `PostMatchStage` を変更すると従来の確認画面にも影響するため、専用側で調整できるものは専用側で扱う。

## Cloudflare側の設定・再公開

初回公開済み。新しいDB・R2・Secret設定は不要。

- Worker名: `tournament-animation-preview`
- 設定: `cloudflare/wrangler.animation-preview.jsonc`
- 初回公開Version: `268a6cc6-6ed3-452d-b10f-7197277a6d6d`
- 公開対象: 専用出力の静的ファイルだけ。既存 `tournament-rehearsal` Workerは更新しない。
- Secrets、D1、R2、Supabase環境変数は追加しない。
- 独自ドメイン設定は不要。現在のworkers.dev URLを使用する。

修正後、認証済みの既存Wranglerで再公開する場合:

```powershell
npm run build:animation-preview
wrangler deploy --config cloudflare/wrangler.animation-preview.jsonc --experimental-autoconfig=false
```

既存の `cloudflare/wrangler.jsonc` を指定しない。`dist-animation-preview/_headers` が配信時のCSP（`connect-src 'none'`）とカメラ・マイク無効設定を定義する。これは公開閲覧を制限する認証ではなく、URLを知る人は閲覧できる。公開素材はサンプルだけを置く。

## 検証記録

専用build、通常build、既存135 unit testsが成功。ビルド出力のアプリ依存を許可リストで制限し、Admin／Display／API／Supabase SDKの混入を防ぐ。秘密設定値の出力混入チェックも成功（値は出力しない）。既存Admin／Display、2つの確認画面、演出共通部品、Supabase、本番Worker・migration・lockfileの変更なし。

自動ブラウザ試験: `scripts/verify-animation-preview.cjs`。インストール済みPlaywrightとChromiumを使用し、追加インストールなしで実施。6シーンの再生・停止・再開・skip、通し再生のNEXT MATCH停止、優勝への手動移動、再読込、未知のquery、reduced-motion、長い名前、幅360／390／844／1366／1440／1920を確認する。

- [ローカル結果](animation-preview-verification/local/result.json)
- [公開URL結果](animation-preview-verification/public/result.json)
- [1920×1080の公開画面](animation-preview-verification/public/monitor-1920.png)
- [390px幅の公開画面](animation-preview-verification/public/responsive-390.png)

公開URLでも上記の自動試験が成功。JSエラー、外部通信、書込み要求、素材取得失敗は0件。HTTP 200とCSP／Permissions-Policyの反映、`/admin`・`/display`・`/api/health`・秘密設定ファイルのパスが404になることを確認した。公開CSPが動的evalを禁止するため、試験の待機処理は画面のstatus要素を使い、公開ポリシーは緩めていない。

実物のiPhone Safari・Android Chrome・会場モニターによる確認は未実施。スマホ幅の自動検証はChromiumのviewport変更であり、実機検証とは区別する。
