import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface MediaRow {
  id: string;
  title: string;
  kind: string;
  source: string;
  storage_path: string | null;
  external_url: string | null;
  preload: boolean;
}

interface PlaylistItemRow {
  id: string;
  order_no: number;
  duration_sec: number | null;
  is_locked: boolean;
  is_enabled: boolean;
  media_id: string;
  media_title?: string;
}

interface MediaManagerProps {
  eventId: string;
}

export default function MediaManager({ eventId }: MediaManagerProps) {
  const [assets, setAssets] = useState<MediaRow[]>([]);
  const [items, setItems] = useState<PlaylistItemRow[]>([]);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const { data: media } = await supabase
      .from('media_assets')
      .select('id, title, kind, source, storage_path, external_url, preload')
      .order('created_at', { ascending: false })
      .limit(50);
    setAssets((media ?? []) as MediaRow[]);

    let { data: pls } = await supabase
      .from('playlists')
      .select('id')
      .eq('event_id', eventId)
      .eq('slot', 'opening')
      .maybeSingle();

    if (!pls) {
      const { data: created } = await supabase
        .from('playlists')
        .insert({
          event_id: eventId,
          slot: 'opening',
          name: 'Opening',
          is_loop: true,
        })
        .select('id')
        .single();
      pls = created;
    }

    const pid = (pls?.id as string) ?? null;
    setPlaylistId(pid);
    if (!pid) {
      setItems([]);
      return;
    }

    const { data: rows } = await supabase
      .from('playlist_items')
      .select('id, order_no, duration_sec, is_locked, is_enabled, media_id, media:media_assets(title)')
      .eq('playlist_id', pid)
      .order('order_no', { ascending: true });

    setItems(
      (rows ?? []).map((r) => {
        const media = Array.isArray(r.media) ? r.media[0] : r.media;
        return {
          id: r.id as string,
          order_no: Number(r.order_no),
          duration_sec: r.duration_sec as number | null,
          is_locked: Boolean(r.is_locked),
          is_enabled: Boolean(r.is_enabled),
          media_id: r.media_id as string,
          media_title: (media as { title?: string } | null)?.title,
        };
      }),
    );
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addExternal() {
    if (!externalUrl.trim() || !title.trim() || !playlistId) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: media, error } = await supabase
        .from('media_assets')
        .insert({
          title: title.trim(),
          kind: 'video',
          source: 'external',
          external_url: externalUrl.trim(),
        })
        .select('id')
        .single();
      if (error || !media) throw error ?? new Error('登録失敗');

      const last = items[items.length - 1];
      const orderNo = last ? Number(last.order_no) + 1 : 1;
      const { error: itemErr } = await supabase.from('playlist_items').insert({
        playlist_id: playlistId,
        media_id: media.id,
        order_no: orderNo,
        duration_sec: 15,
        is_locked: false,
        is_enabled: true,
      });
      if (itemErr) throw itemErr;
      setTitle('');
      setExternalUrl('');
      setMsg('広告を追加しました（外部 URL は自動再生が失敗する可能性があります）');
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '追加に失敗');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!playlistId || !title.trim()) {
      setMsg('タイトルを入力してください');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const path = `events/${eventId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('tournament-media')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const { data: media, error } = await supabase
        .from('media_assets')
        .insert({
          title: title.trim(),
          kind,
          source: 'storage',
          storage_path: path,
          mime_type: file.type,
          preload: true,
        })
        .select('id')
        .single();
      if (error || !media) throw error ?? new Error('登録失敗');

      const last = items[items.length - 1];
      const orderNo = last ? Number(last.order_no) + 1 : 1;
      await supabase.from('playlist_items').insert({
        playlist_id: playlistId,
        media_id: media.id,
        order_no: orderNo,
        duration_sec: kind === 'image' ? 8 : null,
        is_locked: false,
        is_enabled: true,
      });
      setTitle('');
      setMsg('アップロードしました');
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'アップロード失敗');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: PlaylistItemRow) {
    if (item.is_locked) return;
    if (!window.confirm('この項目を削除しますか？')) return;
    await supabase.from('playlist_items').delete().eq('id', item.id);
    await reload();
  }

  async function moveItem(item: PlaylistItemRow, dir: -1 | 1) {
    if (item.is_locked) return;
    const idx = items.findIndex((i) => i.id === item.id);
    const swap = items[idx + dir];
    if (!swap || swap.is_locked) return;
    const mid = (Number(item.order_no) + Number(swap.order_no)) / 2;
    // swap by exchanging order_no
    await supabase.from('playlist_items').update({ order_no: swap.order_no }).eq('id', item.id);
    await supabase.from('playlist_items').update({ order_no: item.order_no }).eq('id', swap.id);
    void mid;
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">オープニング・広告メディア</h2>
        <p className="text-sm text-slate-500 mt-1">
          注意事項（is_locked）は削除できません。外部 URL は自動再生が失敗する可能性があります。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <label className="block text-sm font-medium">
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          外部 URL（YouTube 等）
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void addExternal()}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-40"
          >
            外部 URL を追加
          </button>
          <label className="rounded-lg border border-slate-300 px-4 py-2 font-medium cursor-pointer">
            ファイルをアップロード
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
              }}
            />
          </label>
        </div>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-2">プレイリスト（opening）</h3>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate">
                {item.media_title ?? item.media_id}
                {item.is_locked && (
                  <span className="ml-2 text-xs text-amber-700">ロック</span>
                )}
              </span>
              <button
                type="button"
                disabled={item.is_locked}
                onClick={() => void moveItem(item, -1)}
                className="px-2 py-1 rounded border disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={item.is_locked}
                onClick={() => void moveItem(item, 1)}
                className="px-2 py-1 rounded border disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={item.is_locked}
                onClick={() => void removeItem(item)}
                className="px-2 py-1 rounded border border-red-200 text-red-700 disabled:opacity-30"
              >
                削除
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-slate-500">項目がありません（seed の注意事項を確認）</li>
          )}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold text-slate-700 mb-2">登録済みメディア（直近）</h3>
        <ul className="text-xs text-slate-500 space-y-1 max-h-40 overflow-auto">
          {assets.map((a) => (
            <li key={a.id}>
              {a.title} · {a.source}/{a.kind}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
