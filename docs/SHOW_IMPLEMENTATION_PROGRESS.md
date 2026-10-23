# 演出改善の実装記録

## 2026-10-12：Phase 1の最小プロトタイプ

基準commit：`66707979c403b507daf11d7601ba1a93f3a76adc`。開始時点で既存60テスト成功。作業開始前から存在する文書整理の変更はそのまま保持。

`/show-preview` に本番データと独立したサンプル専用画面を追加。Supabaseへの依存・書き込みなし。既存画面を遅延ロードし、この画面だけならSupabase環境変数なしで利用できる。

### 実装方式

既存ResultSceneとVsCardSceneのcrossfadeは変更量が少ないが、同じ顔が再マウントされる。推奨方式の共有ステージを採用し、同じ勝者カードをWIN、進出、VSまで継続して表示。単一GSAP timelineでライン描画、左右接近、1回の光、VS、無期限のNEXT MATCH保持を制御。pause/resume/seek/skipはローカルの表示だけに作用する。

full/short/lite、時間指定、先頭再生を追加。モード変更は停止・先頭リセット。OSのreduced-motionでは初期値をliteにする。liteは衝突の光を省略。画像は同梱placeholder、背景・光はCSSで構成し外部素材のロード待ちをなくす。音声は未接続。

### 確認手順

1. `npm run dev` → `/show-preview` を開く。
2. 最初から再生。勝者→ライン→左右接近→光→VSの順序を確認。
3. 一時停止、再開、スライダー、スキップを確認。
4. NEXT MATCHのまま保持され、試合が自動開始しないことを確認。
5. full/short/liteを切り替える。1920×1080など会場解像度で確認。

### 完了していない検証

Phase 0の8/16/32名大会の現行録画、実機音響、ブラウザE2E、見た目の合意は未完了。この段階は演出構造の試作で、本番ブラケットの正確な座標や、直前の勝者を含まない次試合・最終試合への分岐は未接続。

### 次の段階

Cloudflare Worker認証・認可、D1原子的保存、requestId/version、Durable Object調停、非公開R2を実装する。接続後にDisplayの永続scene更新を廃止し、本番Show Controlに共有ステージを組み込む。Cloudflareアカウント作成済みでもリソース・認証は別途設定が必要。移行完了までは現行Supabaseを維持する。

会場の1出力分配／独立Display、Admin認証方式、写真配信方式はその段階で確定する。既存scene名・旧EffectOrchestrator資産は保持。旧系統のライン・衝突の意図だけを試作へ反映し、旧タイマー・mount制御は再利用しない。

ロールバックは追加ルート・ホーム導線・追加postMatchファイルを外すだけでよく、DBの変更はない。
