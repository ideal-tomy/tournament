# 既存Cloudflare Worker棚卸し

Cloudflare APIからの読取。Secretは名前だけ取得し値は保存しない。deploy元と用途はrepo configから照合。旧Workerの全route実動作を再試験した一覧ではない。

| Worker | 目的 | deploy元 | 最新稼働version | D1 | R2 | Static Assets | Secret名 | Route（repo実装） |
|---|---|---|---|---|---|---|---|---|
| tournament-animation-preview | 旧演出素材Preview | cloudflare/wrangler.animation-preview.jsonc | 268a6cc6-6ed3-452d-b10f-7197277a6d6d | なし | なし | bindingなし（configで静的assets配信） | なし | 静的Preview |
| tournament-checkin-e2e | 旧撮影登録E2E | cloudflare/checkin/wrangler.e2e.jsonc | fed07725-dcf6-475b-9407-f776b84042cc | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | /checkin /display /api/* |
| tournament-checkin-rehearsal | 通常大会の受付・進行（今回更新しない） | cloudflare/checkin/wrangler.jsonc | 5a6faa66-35e4-49da-8c36-ca783dc6d705 | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | /checkin /admin /display /show-preview /api/* |
| tournament-flow-e2e | 旧抽選・進行E2E | cloudflare/checkin/wrangler.flow-e2e.jsonc | f73a5399-964b-46e4-8ea6-dda3c28b756d | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | 受付・運営・Display・API |
| tournament-match-loop-e2e | 旧試合ループE2E | cloudflare/checkin/wrangler.match-loop-e2e.jsonc | fc5db064-2fdc-4043-8709-f0e2db6a9380 | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | 受付・運営・Display・API |
| tournament-pair-gates-e2e | 旧ペア発表gate E2E | cloudflare/checkin/wrangler.pair-gates-e2e.jsonc | e897a6cd-1f0c-4b37-88c3-7003e0347e69 | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | 受付・運営・Display・API |
| tournament-rehearsal | 旧token認証API | cloudflare/wrangler.jsonc（gitignore） | 250492aa-f2ca-4486-940b-fa18391a2c2b | tournament-rehearsal-db | tournament-rehearsal-media,tournament-rehearsal-portraits | なし | ADMIN_API_TOKEN,DISPLAY_API_TOKEN | /api/health /api/events/* |
| tournament-through-rehearsal | 今後のcanonical | cloudflare/checkin/wrangler.through-rehearsal.jsonc | 46b3c10b-88ed-43ff-9cb4-38ae082f9065 | tournament-rehearsal-db | tournament-rehearsal-portraits | ASSETS | REHEARSAL_ACCESS_CODE,SESSION_SECRET | / /checkin /admin /display /rehearsal /show-preview /cloudflare-check /match-transition /api/* |

各version・照会日時・binding詳細は[workers.json](workers.json)。旧6検証Workerと通常受付Workerを変更・削除せず維持。複数Workerは過去の機能別検証が由来であり、今後の操作URLはthroughだけに統一する。
