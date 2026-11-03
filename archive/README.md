# アーカイブ

現行デプロイに不要な旧資料と、移動時点の生成済みビルド出力を保管します。

- `docs/legacy-supabase/`: 旧Supabase受領資料。旧版の運用・実装コードはルートの `supabase/` と `src/` に残しています。
- `build-output/`: 移動時点の `dist/`、`dist-checkin/`、`dist-animation-preview/`。これらはビルドで再生成されます。

公開物はアーカイブ内のビルドを使わず、`npm run build` と `npm run deploy:rehearsal` で生成・配信します。
