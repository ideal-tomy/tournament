import { useEffect, useMemo, useState } from 'react';
import BracketView from '../bracket/BracketView';
import { buildTeamVisuals } from '../bracket/teamFaces';
import {
  getMatchBracketKind,
  getMatchRoundLabel,
  getNextMatch,
  getSlotTeamUuid,
} from './progression';
import { useProgression } from './useProgression';

interface MatchControlProps {
  eventId: string;
  onStatusChange?: () => void;
}

const BRACKET_LABEL: Record<'winner' | 'loser' | 'grand_final', string> = {
  winner: 'Winners Bracket',
  loser: 'Losers Bracket',
  grand_final: 'Grand Final',
};

export default function MatchControl({ eventId, onStatusChange }: MatchControlProps) {
  const { state, loading, error, busy, canUndo, confirmWinner, undo, skipEffect, reload } =
    useProgression(eventId);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [faces, setFaces] = useState<Record<string, string[]>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string[]>>({});
  const [pendingSlot, setPendingSlot] = useState<0 | 1 | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    void buildTeamVisuals(eventId).then((v) => {
      setLabels(v.labelByTeamId);
      setFaces(v.faceUrlByTeamId);
      setMemberNames(v.memberNamesByTeamId);
    });
  }, [eventId, state?.snapshot]);

  const currentMatch = useMemo(() => {
    if (!state?.stageView) return null;
    if (state.status === 'finished') return null;
    const id = state.currentMatchId ?? getNextMatch(state.stageView)?.id;
    if (id == null) return null;
    return state.stageView.match.find((m) => m.id === id) ?? getNextMatch(state.stageView);
  }, [state]);

  const slotLabels = useMemo(() => {
    if (!state?.stageView || !currentMatch) return ['—', '—'];
    const left = getSlotTeamUuid(state.stageView, currentMatch, 0);
    const right = getSlotTeamUuid(state.stageView, currentMatch, 1);
    return [
      left ? (labels[left] ?? left.slice(0, 8)) : 'BYE / 未定',
      right ? (labels[right] ?? right.slice(0, 8)) : 'BYE / 未定',
    ];
  }, [state, currentMatch, labels]);

  async function handleConfirm() {
    if (!currentMatch || pendingSlot == null) return;
    if (!window.confirm(`${slotLabels[pendingSlot]} の勝利で確定しますか？`)) return;

    try {
      await confirmWinner(currentMatch.id, pendingSlot);
      setPendingSlot(null);
      setStatusMsg('勝敗を確定しました');
      onStatusChange?.();
    } catch {
      /* error shown via hook */
    }
  }

  if (loading) {
    return <p className="text-slate-600">進行状態を読み込み中…</p>;
  }

  if (!state) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>ブラケット未生成</p>
        <p className="text-sm mt-2">抽選タブでチーム編成・ブラケット生成を先に実行してください</p>
      </div>
    );
  }

  if (state.status === 'finished') {
    const champLabel = state.championTeamId
      ? (labels[state.championTeamId] ?? state.championTeamId)
      : '—';
    return (
      <div className="space-y-4 text-center py-6">
        <p className="text-2xl font-black text-emerald-700">大会終了</p>
        <p className="text-lg">
          優勝: <span className="font-bold">{champLabel}</span>
        </p>
        {canUndo && (
          <button
            type="button"
            onClick={() => void undo().then(() => onStatusChange?.())}
            disabled={busy}
            className="rounded-lg border-2 border-amber-500 text-amber-800 px-6 py-3 font-bold disabled:opacity-50"
          >
            1 手戻す (undo)
          </button>
        )}
        <button
          type="button"
          onClick={reload}
          className="block mx-auto text-sm text-slate-500 underline"
        >
          状態を再読み込み
        </button>
      </div>
    );
  }

  const bracketKind = currentMatch
    ? getMatchBracketKind(state.stageView, currentMatch)
    : null;
  const roundNum = currentMatch ? getMatchRoundLabel(state.stageView, currentMatch) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          残り試合: <strong>{state.remainingMatches}</strong>
        </span>
        <span className="capitalize">状態: {state.status}</span>
      </div>

      {currentMatch && (
        <div className="rounded-xl border-2 border-slate-800 bg-slate-50 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {bracketKind ? BRACKET_LABEL[bracketKind] : '—'} · R{roundNum}
          </p>
          <p className="text-sm text-slate-400 mt-1">試合 #{currentMatch.id + 1}</p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {([0, 1] as const).map((slot) => {
              const hasPlayer =
                slot === 0
                  ? currentMatch.opponent1?.id != null
                  : currentMatch.opponent2?.id != null;
              const selected = pendingSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={busy || !hasPlayer}
                  onClick={() => setPendingSlot(slot)}
                  className={`rounded-xl py-8 px-3 text-lg font-bold transition-colors ${
                    selected
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-300'
                      : 'bg-white border-2 border-slate-300 text-slate-800 hover:border-slate-500'
                  } disabled:opacity-40`}
                >
                  {slotLabels[slot]}
                  {selected && <span className="block text-sm font-normal mt-1">勝者候補</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={busy || pendingSlot == null || !currentMatch}
        className="w-full rounded-xl bg-slate-900 text-white py-5 text-xl font-black disabled:opacity-40"
      >
        {busy ? '処理中…' : '勝敗を確定'}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void undo().then(() => onStatusChange?.())}
          disabled={busy || !canUndo}
          className="flex-1 rounded-lg border-2 border-amber-500 text-amber-800 py-4 font-bold disabled:opacity-40"
        >
          1 手戻す
        </button>
        <button
          type="button"
          onClick={() => void skipEffect()}
          disabled={busy}
          className="flex-1 rounded-lg border border-slate-300 text-slate-600 py-4 font-medium disabled:opacity-40"
        >
          演出スキップ
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>
      )}
      {statusMsg && !error && (
        <p className="text-sm text-emerald-700">{statusMsg}</p>
      )}

      {state.stageView && (
        <div className="rounded-lg border border-slate-200 bg-slate-900 p-2 overflow-hidden">
          <p className="text-xs text-slate-400 mb-2 px-1">ブラケット俯瞰</p>
          <BracketView
            data={state.stageView}
            faceUrlByTeamId={faces}
            labelByTeamId={labels}
            memberNamesByTeamId={memberNames}
            currentMatchId={state.currentMatchId}
            compact
          />
        </div>
      )}
    </div>
  );
}
