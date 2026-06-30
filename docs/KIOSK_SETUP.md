# キオスク設定（表示端末）

会場の大画面・サブモニター用 Chrome キオスク手順。

## 前提

- Vercel 等にデプロイ済み（または会場 LAN 内の PC で `npm run preview`）
- 表示 URL: `https://<your-domain>/display?eventId=<イベントUUID>&kiosk=1`
- `kiosk=1` でカーソル非表示・運営リンク非表示

## Windows — Chrome キオスク

1. Chrome を最新版に更新
2. ショートカットを作成し、リンク先を次の形式にする:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=https://your-app.vercel.app/display?eventId=YOUR_EVENT_ID&kiosk=1
```

3. ショートカットをダブルクリックで起動
4. 終了: `Alt+F4`（当日運営者のみ知らせる）

## フルスクリーン（キオスク以外）

通常 Chrome で URL を開き **F11** でフルスクリーン。

## OS 設定

| 項目 | 推奨 |
|---|---|
| スリープ | オフ（電源プラン） |
| 画面オフ | なし |
| 自動更新 | 表示端末の Chrome は手動更新（大会前に確認） |
| ネットワーク | 会場 Wi-Fi 固定。Display PC は有線 LAN 推奨 |

## 接続確認

Display ヘッダー右の **接続済み** 表示を確認。切断時は **再接続中** と表示され、自動復帰後に表が再読込されます。

## トラブル時

1. ページをリロード（F5）— `eventId` は URL に残る
2. Admin「疎通」タブで Ping 送信 → Display の表が更新されるか確認
3. それでもダメなら Wi-Fi 再接続 → Chrome 再起動
