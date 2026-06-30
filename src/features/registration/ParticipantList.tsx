import { faceUrl, deleteParticipant } from './registrationApi';
import type { ParticipantRow } from '../../types';

interface ParticipantListProps {
  participants: ParticipantRow[];
  loading: boolean;
  onRetake: (p: ParticipantRow) => void;
  onDeleted: () => void;
}

export default function ParticipantList({
  participants,
  loading,
  onRetake,
  onDeleted,
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
            <div className="aspect-square bg-slate-100">
              {url ? (
                <img src={url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                  画像なし
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="font-medium text-sm truncate" title={p.name}>
                {p.name}
              </p>
              <div className="flex gap-1 mt-2">
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
