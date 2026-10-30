import { scopedUrl } from './api';

export default function HomePage() {
  return <section className="card">
    <p className="eyebrow">TOURNAMENT / SHARED REHEARSAL</p>
    <h1>大会の連動確認</h1>
    <p>ここから大会を一つ準備します。受付・運営・Displayは、その大会のIDを共有して動きます。</p>
    <p><a className="button primary" href={scopedUrl('/rehearsal')}>全体の操作・連動を確認</a></p>
    <ol className="connection-flow" aria-label="連動の仕組み">
      <li><strong>スマホ受付</strong><span>名前・rating・写真を登録</span></li>
      <li><strong>共通の保存先</strong><span>参加者と試合状態はD1、写真は非公開R2</span></li>
      <li><strong>PC運営</strong><span>受付終了・ペア発表・試合結果を操作</span></li>
      <li><strong>会場Display</strong><span>同じ大会の状態を取得して表示</span></li>
    </ol>
    <p>実データで操作する場合は手動進行を選んでください。自動通し確認はTeam Aの模擬勝者で大会を最後まで進めます。</p>
    <details className="secondary-routes"><summary>個別画面を直接確認する</summary>
      <div className="actions" aria-label="個別操作画面">
        <a className="button" href={scopedUrl('/checkin')}>参加者受付</a>
        <a className="button" href={scopedUrl('/admin')}>運営画面</a>
        <a className="button" href={scopedUrl('/display')}>会場Display</a>
      </div>
    </details>
    <details className="secondary-routes"><summary>開発ツール</summary>
      <div className="actions">
        <a className="button" href={scopedUrl('/show-preview')}>Animation Preview</a>
        <a className="button" href={scopedUrl('/cloudflare-check')}>Cloudflare接続確認</a>
      </div>
    </details>
    <p>各端末で同じ確認コードを入力してください。Rehearsalから画面を開くと、同じ大会IDがURLに付いて連動します。</p>
  </section>;
}
