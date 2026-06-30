import { useState } from 'react';
import { Link } from 'react-router-dom';
import RegistrationPanel from '../features/registration/RegistrationPanel';
import DrawPanel from '../features/draw/DrawPanel';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { useAdminPasscode } from '../hooks/useAdminPasscode';
import { broadcast } from '../lib/realtime';

type AdminTab = 'registration' | 'draw' | 'debug';

export default function AdminPage() {
  const { authorized, passcodeInput, setPasscodeInput, submit, error: passError } =
    useAdminPasscode();
  const { event, loading, error, reload } = useActiveEvent();
  const [tab, setTab] = useState<AdminTab>('registration');
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);
  const [drawKey, setDrawKey] = useState(0);

  async function handlePing() {
    if (!event) return;
    setPinging(true);
    setPingStatus(null);
    try {
      await broadcast(event.id, { type: 'bracket:updated', eventId: event.id });
      setPingStatus(`Ping 送信完了 (${new Date().toLocaleTimeString('ja-JP')})`);
    } catch (e) {
      setPingStatus(
        e instanceof Error ? e.message : 'Ping 送信に失敗しました',
      );
    } finally {
      setPinging(false);
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-bold mb-4">運営ログイン</h1>
          <label className="block text-sm text-slate-600 mb-1">パスコード</label>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full rounded border border-slate-300 px-3 py-2 mb-2"
            autoFocus
          />
          {passError && <p className="text-sm text-red-600 mb-2">{passError}</p>}
          <button
            type="button"
            onClick={submit}
            className="w-full rounded bg-slate-800 text-white py-3 font-medium"
          >
            入室
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'registration', label: '参加者登録' },
    { id: 'draw', label: '抽選' },
    { id: 'debug', label: '疎通' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">運営</h1>
          <p className="text-sm text-slate-600 mt-1">
            <Link
              to={event ? `/display?eventId=${event.id}` : '/display'}
              className="text-blue-600 underline"
              target="_blank"
            >
              表示端末を開く
            </Link>
          </p>
        </header>

        {loading && <p className="text-slate-600">イベント読み込み中…</p>}
        {error && (
          <div className="rounded bg-red-50 border border-red-200 p-4 mb-4">
            <p className="text-red-800 font-medium">エラー</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded bg-red-800 text-white px-4 py-2 text-sm"
            >
              再試行
            </button>
          </div>
        )}

        {event && (
          <>
            <div className="rounded-lg bg-white px-4 py-3 shadow mb-4 text-sm">
              <span className="text-slate-500">イベント:</span>{' '}
              <span className="font-medium">{event.name}</span>
              <span className="text-slate-400 ml-2">({event.status})</span>
            </div>

            <div className="flex gap-2 mb-4">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-lg py-3 font-medium text-sm ${
                    tab === t.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              {tab === 'registration' && <RegistrationPanel eventId={event.id} />}

              {tab === 'draw' && (
                <DrawPanel
                  key={drawKey}
                  eventId={event.id}
                  onBracketCreated={() => setDrawKey((k) => k + 1)}
                />
              )}

              {tab === 'debug' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 font-mono break-all">{event.id}</p>
                  <button
                    type="button"
                    onClick={() => void handlePing()}
                    disabled={pinging}
                    className="w-full rounded-lg bg-emerald-600 text-white py-4 text-lg font-bold disabled:opacity-50"
                  >
                    {pinging ? '送信中…' : 'Ping 送信 (Realtime)'}
                  </button>
                  {pingStatus && (
                    <p
                      className={`text-sm ${pingStatus.includes('失敗') ? 'text-red-600' : 'text-emerald-700'}`}
                    >
                      {pingStatus}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
