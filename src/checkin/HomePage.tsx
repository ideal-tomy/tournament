export default function HomePage() {
  return <section className="home-doors">
    <a className="home-door is-live" href="/start">
      <span className="eyebrow">本番</span>
      <strong>大会を始める</strong>
      <span>受付 · 運営 · 会場モニター</span>
    </a>
    <a className="home-door" href="/venue-check">
      <span className="eyebrow">40人</span>
      <strong>表示を確認する</strong>
      <span>各演出を、仮の大会ですぐ開く</span>
    </a>
  </section>;
}
