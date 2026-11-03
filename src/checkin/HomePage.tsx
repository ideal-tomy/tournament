export default function HomePage() {
  return <section className="home-doors">
    <a className="home-door is-live" href="/start">
      <span className="eyebrow">本番</span>
      <strong>大会を始める</strong>
      <span>受付 · 運営 · 会場モニター</span>
    </a>
    <a className="home-door" href="/rehearsal">
      <span className="eyebrow">確認用</span>
      <strong>演出を確認する</strong>
      <span>演出の再生 · 自動の通し確認</span>
    </a>
  </section>;
}
