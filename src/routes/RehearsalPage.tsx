import { Link } from 'react-router-dom';

export default function RehearsalPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold">リハーサルモード</h1>
        <p className="text-slate-400 mt-4">
          Phase 6 で本実装予定。ダミーデータによる通し確認はここに配置します。
        </p>
        <Link to="/admin" className="inline-block mt-6 text-cyan-400 underline">
          運営画面へ
        </Link>
      </div>
    </div>
  );
}
