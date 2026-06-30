import { faceUrl, deleteParticipant, updateParticipantRating } from './registrationApi';
import type { ParticipantRow } from '../../types';

interface ParticipantListProps {
  participants: ParticipantRow[];
  loading: boolean;
  onRetake: (p: ParticipantRow) => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function ParticipantList({
  participants,
  loading,
  onRetake,
  onDeleted,
  onUpdated,
}: ParticipantListProps) {
  async function handleDelete(p: ParticipantRow) {
    if (!window.confirm(`「${p.name}」を削除しますか？`)) return;
    try {
      await deleteParticipant(p);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  async function handleEditRating(p: ParticipantRow) {
    const raw = window.prompt(
      `「${p.name}」のレーティングを入力`,
      p.rating != null ? String(p.rating) : '',
    );
    if (raw == null) return;
    const n = Number(raw.trim());
    if (!Number.isFinite(n) || n <= 0) {
      alert('正の数値を入力してください');
      return;
    }
    try {
      await updateParticipantRating(p.id, Math.round(n * 10) / 10);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました');
    }
  }

  if (loading && participants.length === 0) {
    return <p className="text-sm text-slate-500">読み込み中…</p>;
  }

  if (participants.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-300 rounded-lg">
        まだ参加者がいません
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {participants.map((p) => {
        const url = faceUrl(p.face_crop_path);
        return (
          <div
            key={p.id}
            className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="aspect-square bg-slate-100 relative">
              {url ? (
                <img src={url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                  画像なし
                </div>
              )}
              <span className="absolute top-1 right-1 rounded bg-slate-900/75 text-white text-xs px-2 py-0.5">
                {p.rating != null ? `R ${p.rating}` : 'R —'}
              </span>
            </div>
            <div className="p-2">
              <p className="font-medium text-sm truncate" title={p.name}>
                {p.name}
              </p>
              <div className="flex gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => void handleEditRating(p)}
                  className="flex-1 text-xs rounded bg-blue-50 text-blue-800 py-2 hover:bg-blue-100"
                >
                  レート
                </button>
                <button
                  type="button"
                  onClick={() => onRetake(p)}
                  className="flex-1 text-xs rounded bg-slate-100 py-2 hover:bg-slate-200"
                >
                  撮り直し
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(p)}
                  className="flex-1 text-xs rounded bg-red-50 text-red-700 py-2 hover:bg-red-100"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
