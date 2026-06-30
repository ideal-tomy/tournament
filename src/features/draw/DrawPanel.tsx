import { useEffect, useState } from 'react';
import type { DrawStrategy } from './draw';
import {
  confirmDrawAndBuildBracket,
  previewDraw,
  resetBracket,
  type DrawPreviewTeam,
} from './drawApi';
import { useParticipants } from '../registration/useParticipants';
import { broadcast } from '../../lib/realtime';
import { fetchBracketSnapshot } from '../bracket/bracketApi';

interface DrawPanelProps {
  eventId: string;
  onBracketCreated: () => void;
}

export default function DrawPanel({ eventId, onBracketCreated }: DrawPanelProps) {
  const { participants, loading: loadingParticipants, refresh } = useParticipants(eventId);
  const [strategy, setStrategy] = useState<DrawStrategy>('trio');
  const [preview, setPreview] = useState<DrawPreviewTeam[] | null>(null);
  const [hasExistingBracket, setHasExistingBracket] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function checkBracket() {
    const snap = await fetchBracketSnapshot(eventId);
    setHasExistingBracket(snap != null && snap.match.length > 0);
  }

  useEffect(() => {
    void checkBracket();
  }, [eventId]);

  const nameMap = new Map(participants.map((p) => [p.id, p.name]));
  const participantIds = participants.map((p) => p.id);

  function runPreview() {
    setError(null);
    if (participantIds.length < 2) {
      setError('抽選には参加者が2名以上必要です');
      return;
    }
    setPreview(previewDraw(participantIds, nameMap, strategy));
    setStatus('抽選結果をプレビュー中。確定前なら再抽選できます。');
  }

  async function handleConfirm() {
    if (!preview?.length) {
      setError('先に抽選を実行してください');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const teams = preview.map((t) => t.memberIds);
      await confirmDrawAndBuildBracket(eventId, teams, strategy, nameMap);
      await broadcast(eventId, { type: 'bracket:updated', eventId });
      setHasExistingBracket(true);
      setPreview(null);
      setStatus('ブラケットを生成しました。表示端末を確認してください。');
      onBracketCreated();
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ブラケット生成に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('チームとブラケットを削除して抽選し直しますか？')) return;
    setBusy(true);
    setError(null);
    try {
      await resetBracket(eventId);
      await broadcast(eventId, { type: 'bracket:updated', eventId });
      setHasExistingBracket(false);
      setPreview(null);
      setStatus('ブラケットをリセットしました');
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リセットに失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-sm text-slate-600">
        参加者: <span className="font-bold text-slate-900">{participants.length}名</span>
        {loadingParticipants && ' (読込中…)'}
      </div>

      {hasExistingBracket && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          ブラケット生成済み。表示端末でトーナメント表を確認できます。
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">奇数人数の扱い</p>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 cursor-pointer">
            <input
              type="radio"
              name="odd_strategy"
              checked={strategy === 'trio'}
              onChange={() => setStrategy('trio')}
              disabled={hasExistingBracket}
            />
            <span className="text-sm">3名チーム (trio)</span>
          </label>
          <label className="flex-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 cursor-pointer">
            <input
              type="radio"
              name="odd_strategy"
              checked={strategy === 'bye'}
              onChange={() => setStrategy('bye')}
              disabled={hasExistingBracket}
            />
            <span className="text-sm">1名=BYE (bye)</span>
          </label>
        </div>
      </div>

      {!hasExistingBracket && (
        <button
          type="button"
          onClick={runPreview}
          disabled={participantIds.length < 2 || busy}
          className="w-full rounded-lg bg-slate-800 text-white py-4 font-bold disabled:opacity-40"
        >
          抽選実行
        </button>
      )}

      {preview && !hasExistingBracket && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="font-medium text-sm">抽選結果プレビュー ({preview.length} チーム)</p>
          <ul className="space-y-2 text-sm">
            {preview.map((team, i) => (
              <li key={i} className="rounded bg-slate-50 px-3 py-2">
                チーム {i + 1}: {team.memberNames.join(' & ')}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={runPreview}
              className="rounded-lg border border-slate-300 py-3 font-medium"
            >
              やり直し
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy}
              className="rounded-lg bg-emerald-600 text-white py-3 font-bold disabled:opacity-50"
            >
              {busy ? '生成中…' : '確定 → ブラケット生成'}
            </button>
          </div>
        </div>
      )}

      {hasExistingBracket && (
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={busy}
          className="w-full rounded-lg border border-red-300 text-red-700 py-3 text-sm disabled:opacity-50"
        >
          抽選・ブラケットをリセット
        </button>
      )}

      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
