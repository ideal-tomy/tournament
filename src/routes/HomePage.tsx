import { Link } from 'react-router-dom';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === '1';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-3xl font-black tracking-tight text-cyan-300">
          ダーツ大会
        </h1>
        <p className="text-slate-400 mt-3 text-sm leading-relaxed">
          ライブ進行・トーナメント表・VS 演出のデモです。
          {isDemoMode && (
            <span className="block mt-2 text-amber-300/90">
              デモモード — ログイン不要で体験できます。
            </span>
          )}
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">
            体験メニュー
          </h2>

          <Link
            to="/demo"
            className="block rounded-xl border-2 border-cyan-500/60 bg-cyan-950/40 hover:border-cyan-400 p-5 transition-colors shadow-lg shadow-cyan-950/30"
          >
            <p className="text-lg font-bold text-cyan-200">試合進行 × 演出体験</p>
            <p className="text-sm text-slate-400 mt-1">
              ログイン不要 · サンプル 32 名 · Display 演出までワンクリック
            </p>
          </Link>

          <Link
            to="/admin"
            className="block rounded-xl border border-slate-700 bg-slate-900 hover:border-cyan-500/50 p-5 transition-colors"
          >
            <p className="text-lg font-bold text-white">参加者登録体験（運営）</p>
            <p className="text-sm text-slate-400 mt-1">
              顔写真付きで参加者を登録 → 抽選 → 本番と同じ運営フロー
            </p>
          </Link>

          <Link
            to="/rehearsal"
            className="block rounded-xl border border-emerald-800/60 bg-emerald-950/40 hover:border-emerald-500/50 p-5 transition-colors"
          >
            <p className="text-lg font-bold text-emerald-200">リハーサル（サンプル 32 名）</p>
            <p className="text-sm text-slate-400 mt-1">
              サンプルデータで演出・Display を何度でも確認。終了してもデータは残ります。
            </p>
          </Link>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xs font-black tracking-widest text-slate-500 uppercase">
            表示端末
          </h2>
          <Link
            to="/display?rehearsal=1"
            className="block text-center rounded-lg bg-fuchsia-800 hover:bg-fuchsia-700 py-3 font-bold text-sm"
          >
            Display — 最新リハーサル
          </Link>
          <Link
            to="/display"
            className="block text-center rounded-lg bg-slate-800 hover:bg-slate-700 py-3 font-bold text-sm"
          >
            Display — 最新本番イベント
          </Link>
        </section>
      </div>
    </div>
  );
}
