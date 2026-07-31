import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export type PlaylistSlot = 'opening' | 'interval' | 'standby' | 'award';

interface PlaylistItemView {
  id: string;
  order_no: number;
  duration_sec: number | null;
  media: {
    id: string;
    kind: string;
    source: string;
    storage_path: string | null;
    external_url: string | null;
    has_alpha: boolean;
    sponsor_id: string | null;
  };
}

interface PlaylistPlayerProps {
  eventId: string;
  slot: PlaylistSlot;
  className?: string;
}

function mediaUrl(item: PlaylistItemView): string | null {
  if (item.media.source === 'external') return item.media.external_url;
  if (item.media.storage_path) {
    return supabase.storage
      .from('tournament-media')
      .getPublicUrl(item.media.storage_path).data.publicUrl;
  }
  return null;
}

export default function PlaylistPlayer({ eventId, slot, className }: PlaylistPlayerProps) {
  const [items, setItems] = useState<PlaylistItemView[]>([]);
  const [index, setIndex] = useState(0);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: playlists } = await supabase
        .from('playlists')
        .select('id')
        .eq('slot', slot)
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .order('event_id', { ascending: false, nullsFirst: false })
        .limit(1);

      const playlistId = playlists?.[0]?.id as string | undefined;
      if (!playlistId) {
        if (!cancelled) setItems([]);
        return;
      }

      const { data: rows } = await supabase
        .from('playlist_items')
        .select(
          'id, order_no, duration_sec, media:media_assets(id, kind, source, storage_path, external_url, has_alpha, sponsor_id)',
        )
        .eq('playlist_id', playlistId)
        .eq('is_enabled', true)
        .order('order_no', { ascending: true });

      if (cancelled) return;
      const mapped = (rows ?? [])
        .map((r) => {
          const media = Array.isArray(r.media) ? r.media[0] : r.media;
          if (!media) return null;
          return {
            id: r.id as string,
            order_no: Number(r.order_no),
            duration_sec: r.duration_sec as number | null,
            media: media as PlaylistItemView['media'],
          };
        })
        .filter(Boolean) as PlaylistItemView[];
      setItems(mapped);
      setIndex(0);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, slot]);

  const logImpression = useCallback(
    async (item: PlaylistItemView, durationMs: number, completed: boolean) => {
      await supabase.from('ad_impressions').insert({
        event_id: eventId,
        playlist_item_id: item.id,
        media_id: item.media.id,
        sponsor_id: item.media.sponsor_id,
        duration_ms: durationMs,
        is_completed: completed,
      });
    },
    [eventId],
  );

  const advance = useCallback(async () => {
    const item = items[index];
    if (item) {
      const elapsed = Date.now() - startedAt.current;
      await logImpression(item, elapsed, true);
    }
    startedAt.current = Date.now();
    setIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
  }, [items, index, logImpression]);

  useEffect(() => {
    const item = items[index];
    if (!item) return;
    startedAt.current = Date.now();
    if (item.media.kind === 'image' || item.media.source === 'external') {
      const sec = item.duration_sec ?? 8;
      const t = window.setTimeout(() => void advance(), sec * 1000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [items, index, advance]);

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-black text-slate-400 ${className ?? ''}`}>
        プレイリストなし
      </div>
    );
  }

  const current = items[index];
  const url = mediaUrl(current);

  return (
    <div className={`relative overflow-hidden bg-black ${className ?? ''}`}>
      {current.media.source === 'external' && url ? (
        <iframe
          title={current.id}
          src={url}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media"
        />
      ) : current.media.kind === 'video' && url ? (
        <video
          key={current.id}
          src={url}
          className="h-full w-full object-contain"
          autoPlay
          muted
          playsInline
          onEnded={() => void advance()}
        />
      ) : url ? (
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-500">素材なし</div>
      )}
    </div>
  );
}
