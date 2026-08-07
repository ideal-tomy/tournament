import { supabase } from '../../lib/supabase';
import type { EventStateRow, Scene } from '../../types';
import { canTransition } from './sceneMachine';
import {
  MATCH_PRESENTATION_TIMING,
  presentationDeadlineIso,
  presentationRemainingMs,
} from '../presentation/matchPresentationTiming';

export interface TransitionOpts {
  payload?: Record<string, unknown>;
  awaitingOperator?: boolean;
  currentMatchId?: string | null;
  presentationMode?: 'full' | 'short' | 'lite';
  /** 定義外遷移を許可（終了・緊急復帰など） */
  force?: boolean;
  /** 同シーンでも seq を上げる（スキップ等） */
  bumpEvenIfSame?: boolean;
}

async function fetchState(eventId: string): Promise<EventStateRow | null> {
  const { data, error } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data as EventStateRow | null;
}

export async function transitionScene(
  eventId: string,
  to: Scene,
  opts: TransitionOpts = {},
): Promise<EventStateRow> {
  const current = await fetchState(eventId);
  if (!current) {
    const { data, error } = await supabase
      .from('event_state')
      .insert({
        event_id: eventId,
        scene: to,
        scene_seq: 1,
        scene_started_at: new Date().toISOString(),
        scene_payload: opts.payload ?? {},
        awaiting_operator: opts.awaitingOperator ?? false,
        current_match_id: opts.currentMatchId ?? null,
        presentation_mode: opts.presentationMode ?? 'full',
      })
      .select('*')
      .single();
    if (error || !data) throw error ?? new Error('event_state 作成に失敗');
    return data as EventStateRow;
  }

  const from = current.scene as Scene;
  if (!canTransition(from, to, opts.force)) {
    await supabase.from('operation_log').insert({
      event_id: eventId,
      action: 'scene_change_rejected',
      target_table: 'event_state',
      target_id: eventId,
      before_data: current,
      after_data: { attempted: to },
    });
    throw new Error(`許可されていないシーン遷移: ${from} → ${to}`);
  }

  const sameScene = from === to;
  if (sameScene && !opts.bumpEvenIfSame && opts.payload == null) {
    return current;
  }

  const next: Record<string, unknown> = {
    scene: to,
    scene_seq: current.scene_seq + 1,
    scene_started_at: new Date().toISOString(),
    scene_payload: opts.payload ?? (sameScene ? current.scene_payload : {}),
    awaiting_operator: opts.awaitingOperator ?? false,
  };
  if (opts.currentMatchId !== undefined) {
    next.current_match_id = opts.currentMatchId;
  }
  if (opts.presentationMode) {
    next.presentation_mode = opts.presentationMode;
  }

  const { data, error } = await supabase
    .from('event_state')
    .update(next)
    .eq('event_id', eventId)
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('event_state 更新に失敗');

  await supabase.from('operation_log').insert({
    event_id: eventId,
    action: 'scene_change',
    target_table: 'event_state',
    target_id: eventId,
    before_data: current,
    after_data: data,
  });

  return data as EventStateRow;
}

/** 古いシーンの cleanup が最新状態を上書きしないための条件付き遷移。 */
export async function transitionSceneIfCurrent(
  eventId: string,
  expectedScene: Scene,
  expectedSeq: number,
  to: Scene,
  opts: TransitionOpts = {},
): Promise<EventStateRow | null> {
  if (!canTransition(expectedScene, to, opts.force)) {
    throw new Error(`許可されていないシーン遷移: ${expectedScene} → ${to}`);
  }

  const next: Record<string, unknown> = {
    scene: to,
    scene_seq: expectedSeq + 1,
    scene_started_at: new Date().toISOString(),
    scene_payload: opts.payload ?? {},
    awaiting_operator: opts.awaitingOperator ?? false,
  };
  if (opts.currentMatchId !== undefined) next.current_match_id = opts.currentMatchId;
  if (opts.presentationMode) next.presentation_mode = opts.presentationMode;

  const { data, error } = await supabase
    .from('event_state')
    .update(next)
    .eq('event_id', eventId)
    .eq('scene', expectedScene)
    .eq('scene_seq', expectedSeq)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as EventStateRow | null) ?? null;
}

export async function requestForceComplete(eventId: string): Promise<void> {
  const current = await fetchState(eventId);
  if (!current) return;
  await transitionScene(eventId, current.scene as Scene, {
    payload: { ...(current.scene_payload as object), forceComplete: true },
    awaitingOperator: current.awaiting_operator,
    currentMatchId: current.current_match_id,
    bumpEvenIfSame: true,
    force: true,
  });
}

export async function setPresentationMode(
  eventId: string,
  mode: 'full' | 'short' | 'lite',
): Promise<void> {
  const current = await fetchState(eventId);
  if (!current) return;
  await supabase
    .from('event_state')
    .update({
      presentation_mode: mode,
      scene_seq: current.scene_seq + 1,
    })
    .eq('event_id', eventId);
}

export async function openVsCard(
  eventId: string,
  matchUuid: string | null,
): Promise<void> {
  await transitionScene(eventId, 'vs_card', {
    awaitingOperator: true,
    currentMatchId: matchUuid,
    payload: {
      matchId: matchUuid,
      minCloseAt: presentationDeadlineIso(MATCH_PRESENTATION_TIMING.vsMinimumHold),
    },
  });
}

export async function closeVsCard(eventId: string): Promise<void> {
  const current = await fetchState(eventId);
  if (!current || current.scene !== 'vs_card') {
    throw new Error('対戦カードは現在表示されていません');
  }
  const payload = current.scene_payload as { minCloseAt?: string } | null;
  const remaining = presentationRemainingMs(payload?.minCloseAt);
  if (remaining > 0) {
    throw new Error(`NEXT MATCH は最低5秒表示します（あと${Math.ceil(remaining / 1000)}秒）`);
  }
  await transitionScene(eventId, 'match_live', {
    awaitingOperator: false,
  });
}
