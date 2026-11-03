import { scopedUrl } from './api';

export default function HomePage() {
  return <section className="card home-entry">
    <p className="eyebrow">TOURNAMENT / DAY OF EVENT</p>
    <h1>当日運用の入口</h1>
    <p>
      スマホで参加者を撮影登録し、運営がボタンで演出を開始し、会場モニターが同じ大会の状態に連動します。まず大会を1つ準備し、表示される3つのURLを配布してください。
    </p>
    <p><a className="button primary" href={scopedUrl('/rehearsal')}>大会を準備して連動を確認</a></p>
    <ol className="connection-flow" aria-label="当日の流れ">
      <li><strong>1. 準備（PC）</strong><span>Rehearsalで空の大会を1つ作る。出てきた run 付きURLをその日の正本にする。</span></li>
      <li><strong>2. 受付（スマホ）</strong><span>参加者が名前・rating・写真を登録する。</span></li>
      <li><strong>3. 運営（スマホ可）</strong><span>受付終了でペア自動確定 → ペア発表開始 → 試合操作。</span></li>
      <li><strong>4. 会場（モニター）</strong><span>Displayだけを開き、演出を表示する（操作しない）。</span></li>
    </ol>
    <p className="hint">詳細手順はリポジトリ内 <code>docs/DAY_OF_EVENT.md</code> を参照してください。</p>
    <details className="secondary-routes"><summary>個別画面（大会ID run 付きで開くこと）</summary>
      <div className="actions" aria-label="個別操作画面">
        <a className="button" href={scopedUrl('/checkin')}>参加者受付</a>
        <a className="button" href={scopedUrl('/admin')}>大会運営</a>
        <a className="button" href={scopedUrl('/display')}>会場Display</a>
      </div>
      <p>run なしで開くと別大会になるか、大会選択の案内になります。Rehearsal から開いてください。</p>
    </details>
    <details className="secondary-routes"><summary>開発ツール</summary>
      <div className="actions">
        <a className="button" href={scopedUrl('/show-preview')}>Animation Preview</a>
        <a className="button" href={scopedUrl('/cloudflare-check')}>Cloudflare接続確認</a>
      </div>
    </details>
    <p>各端末で同じ確認コードを入力します。自動全通し（模擬勝者）は確認用です。当日の実データでは使わず、Adminで手動進行してください。</p>
  </section>;
}
