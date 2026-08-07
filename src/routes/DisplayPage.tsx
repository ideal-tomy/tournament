import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EventIdBadge from '../components/EventIdBadge';
import { useBracketDisplay } from '../features/bracket/useBracketDisplay';
import BracketView from '../features/bracket/BracketView';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { displayMediaPreloader } from '../lib/media';
import { bracketTheme, kindToThemeKey } from '../styles/bracketTheme';
import { useEventState } from '../features/scene/useEventState';
import { shouldRestoreCompleted } from '../features/scene/sceneMachine';
import OpeningScene from '../features/presentation/scenes/OpeningScene';
import VsCardScene from '../features/presentation/scenes/VsCardScene';
import ResultScene from '../features/presentation/scenes/ResultScene';
import DrawScene from '../features/presentation/scenes/DrawScene';
import PlaylistPlayer from '../features/player/PlaylistPlayer';
import { supabase } from '../lib/supabase';
import {
  getMatchBracketKind,
  getMatchRoundLabel,
  getSlotTeamUuid,
} from '../features/progression/progression';
import type { BracketThemeKey, Scene } from '../types';
import type { BMMatch } from '../features/bracket/layout';

const STATUS_LABEL = {
  connecting: '接続中…',
  connected: '接続済み',
  disconnected: '切断',
  error: 'エラー',
} as const;

export default function DisplayPage() {
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === '1';

  const { event, loading, error, reload } = useActiveEvent();
  const {
    snapshot,
    faceUrlByTeamId,
    labelByTeamId,
    memberNamesByTeamId,
    currentMatchId,
    eventStatus,
    hasBracket,
    loading: bracketLoading,
    error: bracketError,
    reload: reloadBracket,
  } = useBracketDisplay(event?.id);

  const {
    state: eventState,
    loading: stateLoading,
    reload: reloadEventState,
    applyIncoming,
    channelStatus,
  } = useEventState(event?.id);
  const [started, setStarted] = useState(false);
  const [preloadPct, setPreloadPct] = useState(0);
  const [eventMeta, setEventMeta] = useState<{ title: string; subtitle: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!event?.id) return;
    void supabase
      .from('events')
      .select('title, subtitle')
      .eq('id', event.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEventMeta({
            title: data.title as string,
            subtitle: (data.subtitle as string | null) ?? null,
          });
        }
      });
  }, [event?.id]);

  useEffect(() => {
    if (!eventState) return;
    if (
      eventState.scene === 'bracket' ||
      eventState.scene === 'result' ||
      eventState.scene === 'match_live' ||
      eventState.scene === 'vs_card'
    ) {
      reloadBracket();
    }
  }, [eventState?.scene_seq, eventState?.scene, reloadBracket]);

  async function handleStart() {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        await ctx.resume();
        void ctx.close();
      }
    } catch {
      /* ignore */
    }
    setPreloadPct(30);
    await displayMediaPreloader.preloadDisplayAssets();
    setPreloadPct(100);
    setStarted(true);
  }

  const scene: Scene = eventState?.scene ?? 'idle';
  const restoreCompleted = shouldRestoreCompleted(scene, eventState?.scene_started_at ?? null);
  const forceComplete = Boolean(eventState?.scene_payload?.forceComplete);
  const drawPayload = eventState?.scene_payload as
    | { drawSessionId?: string; durationSec?: number }
    | undefined;
  const drawRestoreCompleted = useMemo(() => {
    if (scene !== 'draw' || !eventState?.scene_started_at) return false;
    const duration = Number(drawPayload?.durationSec);
    if (!Number.isFinite(duration) || duration <= 0) return restoreCompleted;
    return Date.now() - new Date(eventState.scene_started_at).getTime() >= duration * 1000;
  }, [scene, eventState?.scene_started_at, drawPayload?.durationSec, restoreCompleted]);

  const matchInfo = useMemo(() => {
    if (!snapshot || !eventState) return null;
    const payload = eventState.scene_payload as {
      bmMatchId?: number;
      winnerTeamId?: string;
      loserTeamId?: string;
      nextBmMatchId?: number | null;
      tournamentFinished?: boolean;
      championTeamId?: string | null;
    };
    let match: BMMatch | undefined;
    if (payload.bmMatchId != null) {
      match = snapshot.match.find((m) => m.id === payload.bmMatchId);
    } else if (currentMatchId != null) {
      match = snapshot.match.find((m) => m.id === currentMatchId);
    }
    if (!match) return null;
    const kind = getMatchBracketKind(snapshot, match);
    const key = kindToThemeKey(kind);
    const round = getMatchRoundLabel(snapshot, match);
    const a = getSlotTeamUuid(snapshot, match, 0);
    const b = getSlotTeamUuid(snapshot, match, 1);
    return {
      match,
      key,
      round,
      teamA: a,
      teamB: b,
      winnerId: payload.winnerTeamId ?? null,
      loserId: payload.loserTeamId ?? null,
      nextBmMatchId: payload.nextBmMatchId ?? null,
      tournamentFinished: payload.tournamentFinished ?? false,
      championTeamId: payload.championTeamId ?? null,
    };
  }, [snapshot, eventState, currentMatchId]);

  const isLoading = loading || stateLoading;

  if (!started) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 text-white"
        style={{ backgroundColor: bracketTheme.background }}
      >
        <h1 className="text-3xl font-black text-cyan-300">Display</h1>
        <p className="text-slate-400 text-sm">音声と素材の準備のため、開始をクリックしてください</p>
        {preloadPct > 0 && preloadPct < 100 && (
          <p className="text-xs text-slate-500">プリロード {preloadPct}%</p>
        )}
        <button
          type="button"
          onClick={() => void handleStart()}
          className="rounded-xl bg-cyan-600 px-10 py-4 text-xl font-bold"
        >
          開始
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen text-white flex flex-col ${isKiosk ? 'cursor-none select-none' : ''}`}
      style={{ backgroundColor: bracketTheme.background }}
    >
      <header className="px-6 py-3 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-cyan-300">
            {scene === 'opening' ? 'オープニング' : scene === 'draw' ? 'チーム抽選' : 'トーナメント表'}
          </h1>
          {event && (
            <p className="text-slate-400 text-sm mt-0.5">
              {eventMeta?.title ?? event.title}
              <span className="ml-2 text-cyan-500/80 text-xs">{scene}</span>
              {eventStatus === 'finished' && (
                <span className="ml-2 text-fuchsia-400 font-bold">— 終了</span>
              )}
              <span className="ml-3">
                <EventIdBadge eventId={event.id} />
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-mono text-slate-400">
            {STATUS_LABEL[channelStatus]} · seq {eventState?.scene_seq ?? '-'}
          </span>
          {!isKiosk && (
            <Link to="/" className="text-sm text-slate-400 hover:text-white">
              ホーム
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {isLoading && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-400">
            読み込み中…
          </p>
        )}
        {bracketError && <p className="p-4 text-red-400">{bracketError}</p>}

        {scene === 'idle' && (
          <div className="flex h-full min-h-[50vh] items-center justify-center text-slate-500">
            待機中
          </div>
        )}

        {scene === 'opening' && event && (
          <OpeningScene
            eventId={event.id}
            title={eventMeta?.title ?? event.title}
            subtitle={eventMeta?.subtitle ?? null}
          />
        )}

        {scene === 'interval' && event && (
          <PlaylistPlayer eventId={event.id} slot="interval" className="h-full min-h-[60vh]" />
        )}

        {scene === 'award' && event && (
          <PlaylistPlayer eventId={event.id} slot="award" className="h-full min-h-[60vh]" />
        )}

        {(scene === 'bracket' || scene === 'match_live') &&
          hasBracket &&
          snapshot && (
            <div className="h-full p-2">
              <BracketView
                data={snapshot}
                faceUrlByTeamId={faceUrlByTeamId}
                labelByTeamId={labelByTeamId}
                memberNamesByTeamId={memberNamesByTeamId}
                currentMatchId={currentMatchId}
              />
            </div>
          )}

        {scene === 'draw' && event && eventState && (
          <DrawScene
            key={`draw-${eventState.scene_seq}`}
            eventId={event.id}
            sceneSeq={eventState.scene_seq}
            drawSessionId={drawPayload?.drawSessionId}
            presentationMode={eventState.presentation_mode ?? 'full'}
            audioEnabled={eventState.audio_enabled ?? true}
            forceComplete={forceComplete}
            restoreCompleted={drawRestoreCompleted}
            onSceneUpdated={applyIncoming}
          />
        )}

        {scene === 'vs_card' && matchInfo && (
          <VsCardScene
            teamALabel={
              matchInfo.teamA ? (labelByTeamId[matchInfo.teamA] ?? matchInfo.teamA) : 'TBD'
            }
            teamBLabel={
              matchInfo.teamB ? (labelByTeamId[matchInfo.teamB] ?? matchInfo.teamB) : 'TBD'
            }
            teamAFaces={matchInfo.teamA ? (faceUrlByTeamId[matchInfo.teamA] ?? []) : []}
            teamBFaces={matchInfo.teamB ? (faceUrlByTeamId[matchInfo.teamB] ?? []) : []}
            bracketKey={matchInfo.key as BracketThemeKey}
            round={matchInfo.round}
            awaitingOperator={eventState?.awaiting_operator ?? false}
            restoreCompleted={restoreCompleted}
          />
        )}

        {scene === 'result' && matchInfo && event && eventState && (
          <ResultScene
            key={`result-${eventState.scene_seq}`}
            eventId={event.id}
            sceneSeq={eventState.scene_seq}
            winnerLabel={
              matchInfo.winnerId ? (labelByTeamId[matchInfo.winnerId] ?? 'Winner') : 'Winner'
            }
            loserLabel={
              matchInfo.loserId ? (labelByTeamId[matchInfo.loserId] ?? 'Loser') : 'Loser'
            }
            winnerFaces={matchInfo.winnerId ? (faceUrlByTeamId[matchInfo.winnerId] ?? []) : []}
            loserFaces={matchInfo.loserId ? (faceUrlByTeamId[matchInfo.loserId] ?? []) : []}
            bracketKey={matchInfo.key as BracketThemeKey}
            round={matchInfo.round}
            presentationMode={eventState.presentation_mode ?? 'full'}
            forceComplete={forceComplete}
            restoreCompleted={restoreCompleted}
            nextBmMatchId={matchInfo.nextBmMatchId}
            tournamentFinished={matchInfo.tournamentFinished}
            championTeamId={matchInfo.championTeamId}
            onSceneUpdated={applyIncoming}
          />
        )}

        {scene === 'finished' && (
          <div className="flex h-full min-h-[50vh] items-center justify-center text-3xl font-black text-fuchsia-300">
            FINISHED
          </div>
        )}

        {!hasBracket &&
          (scene === 'bracket' || scene === 'match_live') &&
          !bracketLoading && (
            <p className="p-8 text-center text-slate-500">ブラケット未生成</p>
          )}
      </main>

      {!isKiosk && (
        <button
          type="button"
          onClick={() => {
            reload();
            void reloadEventState();
            reloadBracket();
          }}
          className="fixed bottom-3 left-3 text-xs text-slate-600 underline"
        >
          再読込
        </button>
      )}
    </div>
  );
}
