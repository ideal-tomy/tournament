import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import face from '../assets/placeholder_face.svg';
import { api } from './api';
import { repairStoredPng } from './portraitCache';
import { buildDoubleElimination, toStageData } from '../features/bracket/manager';
import type { StageData } from '../features/bracket/layout';
import BracketView from '../features/bracket/BracketView';
import LosersColumnBoard from '../features/bracket/LosersColumnBoard';
import { computeBracketLayout } from '../features/bracket/layout';
import AnimatedBracketAdvance from './AnimatedBracketAdvance';
import type { DrawState } from './DrawControl';
import { buildVenueAdvances, buildVenueAdvancesToEnd, type VenueAdvance } from './venueAdvance';
import { appendPairCelebration } from '../features/presentation/backdrop/appendPresentationBackdrop';
import ChampionBoard from '../features/presentation/ceremony/ChampionBoard';
import type { CeremonyTeam } from '../features/presentation/ceremony/CeremonyFrame';
import PodiumBoard from '../features/presentation/ceremony/PodiumBoard';
import ThanksBoard from '../features/presentation/ceremony/ThanksBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import { WINNER_ADVANCE_SEC } from '../features/presentation/advanceTiming';
import {
  LOSERS_INTRO_BRACKET_SEC,
} from '../features/presentation/losersIntroTiming';
import type { DrawPresentationData } from '../features/draw/presentationTypes';
import { drawSeconds, estimateDrawDurationMs, estimateTeamSummaryMs } from '../features/presentation/drawAnimationTiming';
import OpeningBracketTour from '../features/presentation/scenes/OpeningBracketTour';
import DrawStage from '../features/presentation/scenes/DrawStage';
import PairConfirmed from '../features/presentation/scenes/PairConfirmed';
import VsBoard, { type VsCallout } from '../features/presentation/vsBoard/VsBoard';

const TEAM_COUNT = 20;

interface FixtureTeam {
  id: string;
  name: string;
  members: string[];
  faces: string[];
}

const VIEWS = [
  ['tour', '開幕のトーナメント'],
  ['draw', 'ペア発表（1人目）'],
  ['teams', 'チーム一覧の周回'],
  ['advance', '勝ち上がり（線と顔）'],
  ['winners', 'ウィナーズ'],
  ['losers', 'ルーザーズの進行'],
  ['pair', 'ペア確定'],
  ['vs', 'VS'],
  ['semi', 'セミファイナル'],
  ['final', 'ファイナル'],
  ['again', 'ファイナルアゲイン'],
  ['losers-intro', 'ルーザーズ導入（表5秒）'],
  ['bracket-focus', '表の寄り（消化後）'],
  ['winner', 'WINNER'],
  ['champion', '優勝'],
  ['podium', '表彰台'],
  ['thanks', '終了の挨拶'],
] as const;

type ViewId = (typeof VIEWS)[number][0];

function roster(photos: string[] = []): FixtureTeam[] {
  const pool = photos.length ? photos : [face];
  return Array.from({ length: TEAM_COUNT }, (_, index) => {
    const number = index + 1;
    const left = index * 2 + 1;
    const right = left + 1;
    return {
      id: `team-${number}`,
      name: `仮ペア${String(number).padStart(2, '0')}`,
      members: [`仮参加者${String(left).padStart(2, '0')}`, `仮参加者${String(right).padStart(2, '0')}`],
      faces: [pool[(index * 2) % pool.length], pool[(index * 2 + 1) % pool.length]],
    };
  });
}

/** 保存済みの顔写真。足りない枠は同じ写真を繰り返す。失敗しても仮の顔で続ける。 */
async function albumFaces(): Promise<string[]> {
  const body = await api<{ portraits: { portraitUrl: string; version: number }[] }>('/api/rehearsal/portrait-pool');
  const loaded = await Promise.all(body.portraits.slice(0, TEAM_COUNT * 2).map(async (person) => {
    const response = await fetch(`${person.portraitUrl}?version=${person.version}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const portrait = blob.type === 'image/png' ? new Blob([repairStoredPng(bytes)], { type: blob.type }) : blob;
    return URL.createObjectURL(portrait);
  }));
  return loaded.filter((url): url is string => url != null);
}

function drawPresentation(teams: FixtureTeam[]): DrawPresentationData {
  return {
    sessionId: 'venue-check',
    teamSize: 2,
    teamLabels: teams.map((team) => team.name),
    participants: teams.flatMap((team) => team.members.map((name, index) => ({
      id: `${team.id}-${index}`,
      displayName: name,
      faceUrl: team.faces[index] ?? face,
    }))),
  };
}

/** チーム一覧の帯が動き始める直後。カード紹介を飛ばして周回だけ見る。 */
function teamsLoopStart(teamCount: number): number {
  const total = estimateDrawDurationMs(teamCount * 2, 'full', teamCount, 'show') / 1000;
  const summary = estimateTeamSummaryMs(teamCount, 'show') / 1000;
  return Math.max(0, total - summary + drawSeconds('summaryEnter', 'show') + 0.15);
}

function ceremony(team: FixtureTeam): CeremonyTeam {
  return { name: team.name, members: team.members, faces: team.faces };
}

function currentView(): ViewId | null {
  const value = new URLSearchParams(location.search).get('view');
  return VIEWS.some(([id]) => id === value) ? value as ViewId : null;
}

function bracketMaps(teams: FixtureTeam[]) {
  return {
    faceUrlByTeamId: Object.fromEntries(teams.map((team) => [team.id, team.faces])),
    labelByTeamId: Object.fromEntries(teams.map((team) => [team.id, team.name])),
    memberNamesByTeamId: Object.fromEntries(teams.map((team) => [team.id, team.members])),
  };
}

function BracketBoard({
  data,
  teams,
  side,
  omitCompleted = false,
}: {
  data: StageData;
  teams: FixtureTeam[];
  side: 'winners' | 'losers';
  omitCompleted?: boolean;
}) {
  const maps = bracketMaps(teams);
  return (
    <div className="persisted-bracket">
      <h2>{side === 'losers' ? 'ルーザーズ' : 'ウィナーズ'}</h2>
      <div className="persisted-bracket-body">
        {side === 'losers' ? (
          <LosersColumnBoard
            data={data}
            faceUrlByTeamId={maps.faceUrlByTeamId}
            labelByTeamId={maps.labelByTeamId}
            focusRound={omitCompleted ? null : 1}
          />
        ) : (
          <BracketView
            data={data}
            boardSide={side}
            omitCompleted={false}
            activeRound={omitCompleted}
            {...maps}
          />
        )}
      </div>
    </div>
  );
}

function LosersIntroSequence({ teams, replay }: { teams: FixtureTeam[]; replay: number }) {
  const [data, setData] = useState<StageData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setElapsed(0);
    buildVenueAdvances(teams.map((team) => team.id), 16).then((steps) => {
      const entered = steps.find((step) => computeBracketLayout(toStageData(step.after), undefined, 'losers').matches.length > 0);
      if (!cancelled && entered) setData(toStageData(entered.after));
    }).catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [replay, teams]);
  useEffect(() => {
    if (!data) return;
    setElapsed(0);
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const next = (performance.now() - started) / 1000;
      setElapsed(next);
      if (next < LOSERS_INTRO_BRACKET_SEC + 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [data, replay]);
  if (!data) return <p role="status">ルーザーズに入った組を組んでいます…</p>;
  if (elapsed < LOSERS_INTRO_BRACKET_SEC) {
    return (
      <div className="losers-bracket-fade relative h-full min-h-[60vh]">
        <BracketBoard data={data} teams={teams} side="losers" omitCompleted />
      </div>
    );
  }
  return (
    <p className="m-6 text-slate-200">
      本番では初回のルーザーズ試合開始のあと、表を {LOSERS_INTRO_BRACKET_SEC} 秒出してから VS へ切り替わります。もう一度で最初から再生します。
    </p>
  );
}

function BracketFocusPlay({ teams, replay, onNote }: { teams: FixtureTeam[]; replay: number; onNote(note: string): void }) {
  const [data, setData] = useState<StageData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    buildVenueAdvances(teams.map((team) => team.id), 10)
      .then((steps) => {
        if (cancelled || steps.length === 0) return;
        const last = steps[steps.length - 1];
        if (!cancelled) {
          setData(toStageData(last.after));
          onNote(`${last.label} · 消化済みは残し、いまの段を初戦と同じ大きさで中央へ`);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '進行を組めませんでした。');
      });
    return () => { cancelled = true; };
  }, [replay, teams, onNote]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">消化後の表を組んでいます…</p>;
  return <BracketBoard data={data} teams={teams} side="winners" omitCompleted />;
}

function PairHold({ team }: { team: FixtureTeam }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = root?.querySelector('.draw-pair-stage');
    if (!root || !stage) return;
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(stage, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 0);
    appendPairCelebration(tl, root, stage, { at: 0, hold: 30, exit: 0.01 });
    tl.seek(1.6, false);
    return () => { tl.kill(); };
  }, [team.id]);
  return (
    <div ref={rootRef} className="venue-pair">
      <PairConfirmed
        teamNumber={1}
        teamLabel={team.name}
        members={team.members.map((name, index) => ({ id: `${team.id}-${index}`, displayName: name, faceUrl: team.faces[index] ?? face }))}
      />
    </div>
  );
}

function advanceState(teams: FixtureTeam[], step: VenueAdvance, revealedMatchIds: number[]): DrawState {
  const participants = teams.flatMap((team) => team.members.map((name, index) => {
    const photo = team.faces[index] ?? face;
    return {
    id: `${team.id}-${index}`,
    eventId: 'venue-check',
    name,
    rating: null,
    portraitUrl: photo,
    photoUrl: photo,
    portraitContentType: 'image/jpeg',
    portraitSource: 'uploaded' as const,
    createdAt: '',
    version: 1,
    updatedAt: '',
    presentationPortraitUrl: photo,
    };
  }));
  return {
    eventId: 'venue-check',
    title: '表示確認',
    checkinStatus: 'closed',
    checkinRevision: 0,
    scene: 'bracket',
    version: 1,
    sceneSeq: 1,
    elapsedSeconds: 0,
    durationSec: WINNER_ADVANCE_SEC,
    canComplete: false,
    session: null,
    participants,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberIds: team.members.map((_, index) => `${team.id}-${index}`),
      seed: 0,
    })),
    bracket: step.after,
    flow: {
      phase: 'bracket_update',
      currentMatch: null,
      boardSide: step.kind === 'loser' ? 'losers' : step.kind === 'grand_final' ? 'grand_final' : 'winners',
      resultPresentation: {
        beforeBracket: step.before,
        match: { id: step.matchId, teamA: step.teamA, teamB: step.teamB, round: step.round, kind: step.kind, final: false },
        winnerTeamId: step.winnerTeamId,
      },
      winnerTeamId: step.winnerTeamId,
      loserTeamId: step.loserTeamId,
      revealedMatchIds,
      championTeamId: null,
      lastMatchId: step.matchId,
      canGameStart: false,
      canAnnounce: false,
      canStart: false,
      canScore: false,
      canAdvance: false,
      completedMatches: 1,
    },
  } as DrawState;
}

function losersStepNote(step: VenueAdvance, index: number, total: number): string {
  const end = index >= total - 1 ? ' · ルーザーズはここまで' : '';
  return `${step.label} · ${step.teamA}${end}`;
}

function AdvancePlay({ teams, replay, onNote, kind }: { teams: FixtureTeam[]; replay: number; onNote(note: string): void; kind?: 'winner' | 'loser' }) {
  const [steps, setSteps] = useState<VenueAdvance[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setIndex(0);
    setSteps([]);
    setPaused(false);
    const load = kind === 'loser'
      ? buildVenueAdvancesToEnd(teams.map((team) => team.id)).then((next) => next.filter((step) => step.kind === 'loser'))
      : buildVenueAdvances(teams.map((team) => team.id), 6).then((next) => (kind ? next.filter((step) => step.kind === kind) : next));
    load.then((picked) => {
      if (!cancelled) {
        if (picked.length === 0) setError('その場面の試合を組めませんでした。');
        else {
          const total = picked.length;
          setSteps(picked.map((step, stepIndex) => {
            const place = step.kind === 'loser' ? 'ルーザーズ' : step.kind === 'grand_final' ? 'グランドファイナル' : 'ウィナーズ';
            return { ...step, label: `${place} ${step.round}回戦 · ${stepIndex + 1}/${total}` };
          }));
        }
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '進行を組めませんでした。');
    });
    return () => { cancelled = true; };
  }, [kind, replay, teams]);
  useEffect(() => {
    if (paused || index >= steps.length - 1) return undefined;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), (WINNER_ADVANCE_SEC + 1.2) * 1000);
    return () => window.clearTimeout(timer);
  }, [index, steps.length, paused]);
  const step = steps[index];
  const revealedMatchIds = useMemo(() => steps.slice(0, index).map((item) => item.matchId), [steps, index]);
  const state = useMemo(() => (step ? advanceState(teams, step, revealedMatchIds) : null), [step, teams, revealedMatchIds]);
  useEffect(() => {
    if (!step) {
      onNote('');
      return;
    }
    onNote(kind === 'loser' ? losersStepNote(step, index, steps.length) : `${step.label} · ${step.teamA}`);
  }, [onNote, step, kind, index, steps.length]);
  if (error) return <p role="alert">{error}</p>;
  if (!step || !state) return <p role="status">進行を組んでいます…</p>;
  const winner = teams.find((team) => team.id === step.winnerTeamId);
  const loser = teams.find((team) => team.id === step.loserTeamId);
  if (!winner || !loser) return null;
  return (
    <>
      <div className="venue-check-nav" role="navigation" aria-label={kind === 'loser' ? 'ルーザーズ進行' : '勝ち上がり進行'}>
        <button type="button" disabled={index <= 0} onClick={() => { setPaused(true); setIndex((value) => Math.max(0, value - 1)); }}>前へ</button>
        <button type="button" disabled={index >= steps.length - 1} onClick={() => { setPaused(true); setIndex((value) => Math.min(steps.length - 1, value + 1)); }}>次へ</button>
        <button type="button" onClick={() => setPaused((value) => !value)}>{paused ? '再生' : '一時停止'}</button>
      </div>
      <AnimatedBracketAdvance
        key={`${replay}-${step.matchId}-${index}`}
        state={state}
        winnerOverlay={<WinnerBoard contained settled team={ceremony(winner)} opponent={ceremony(loser)} dropLabel={step.kind === 'winner' ? 'ルーザーへ→' : '敗退→'} />}
      />
    </>
  );
}

function Scene({ view, data, teams, replay, onNote }: { view: ViewId; data: StageData; teams: FixtureTeam[]; replay: number; onNote(note: string): void }) {
  const [left, right, third, fourth] = teams;
  if (!left || !right || !third || !fourth) return null;
  const labels = Object.fromEntries(teams.map((team) => [team.id, team.name]));
  const faces = Object.fromEntries(teams.map((team) => [team.id, team.faces]));
  const members = Object.fromEntries(teams.map((team) => [team.id, team.members]));
  if (view === 'tour') {
    return (
      <OpeningBracketTour
        key={replay}
        data={data}
        teams={teams.map((team) => ({ id: team.id, name: team.name, faces: team.faces, members: team.members }))}
        faceUrlByTeamId={faces}
        labelByTeamId={labels}
        memberNamesByTeamId={members}
      />
    );
  }
  if (view === 'draw' || view === 'teams') {
    return (
      <div className="live-draw-stage">
        <DrawStage
          key={replay}
          eventId="venue-check"
          sceneSeq={replay}
          data={drawPresentation(teams)}
          presentationMode="full"
          timingPreset="show"
          audioEnabled
          startAtSeconds={view === 'teams' ? teamsLoopStart(teams.length) : 0}
        />
      </div>
    );
  }
  if (view === 'advance') return <AdvancePlay key={replay} teams={teams} replay={replay} onNote={onNote} />;
  if (view === 'losers') return <AdvancePlay key={replay} teams={teams} replay={replay} onNote={onNote} kind="loser" />;
  if (view === 'winners') return <BracketBoard data={data} teams={teams} side={view} />;
  if (view === 'pair') return <PairHold key={replay} team={left} />;
  if (view === 'losers-intro') return <LosersIntroSequence key={replay} teams={teams} replay={replay} />;
  if (view === 'bracket-focus') return <BracketFocusPlay key={replay} teams={teams} replay={replay} onNote={onNote} />;
  if (view === 'thanks') return <ThanksBoard />;
  if (view === 'winner') return <WinnerBoard key={replay} team={ceremony(left)} opponent={ceremony(right)} />;
  if (view === 'champion') return <ChampionBoard key={replay} team={ceremony(left)} />;
  if (view === 'podium') return <PodiumBoard key={replay} first={ceremony(left)} second={ceremony(right)} third={ceremony(third)} />;
  const callout: VsCallout | null = view === 'semi' ? 'semifinal' : view === 'final' ? 'final' : view === 'again' ? 'final-again' : null;
  const roundLabel = view === 'semi' ? '準決勝' : view === 'final' ? '決勝' : view === 'again' ? '決勝' : '1回戦';
  return <VsBoard key={replay} audioEnabled left={ceremony(left)} right={ceremony(fourth)} roundLabel={roundLabel} callout={callout} />;
}

function Stage({ label, note, onReplay, children }: { label: string; note?: string; onReplay(): void; children: ReactNode }) {
  return (
    <div className="venue-check-stage">
      <div className="venue-check-tools">
        <a href="/venue-check">一覧</a>
        <button type="button" onClick={onReplay}>もう一度</button>
        {note && <span>{note}</span>}
      </div>
      <div className="venue-check-frame" aria-label={label}>{children}</div>
    </div>
  );
}

/** 受付へ40人を入れなくても、本番と同じ画面をすぐ開く。大会の保存データは変えない。 */
export default function VenueCheckPage() {
  const view = currentView();
  const [replay, setReplay] = useState(0);
  const [ready, setReady] = useState<{ data: StageData; teams: FixtureTeam[] } | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    let cancelled = false;
    const photos: string[] = [];
    Promise.all([
      buildDoubleElimination(roster().map((team) => team.id)),
      albumFaces().catch(() => [] as string[]),
    ]).then(([snapshot, faces]) => {
      if (cancelled) {
        for (const url of faces) URL.revokeObjectURL(url);
        return;
      }
      photos.push(...faces);
      setReady({ data: toStageData(snapshot), teams: roster(faces) });
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '仮の大会を組めませんでした。');
    });
    return () => {
      cancelled = true;
      for (const url of photos) URL.revokeObjectURL(url);
    };
  }, []);
  if (!view) {
    return (
      <section className="venue-check-menu">
        <p className="eyebrow">40人 · ダブルイリミネーション</p>
        <h1>表示を確認する</h1>
        <p>仮の20組です。顔は保存済みの写真を使います。各演出は別の窓で開きます。受付の入力や、進行中の大会には影響しません。</p>
        <p>ペア発表は1人目から、チーム一覧は周回の途中から開きます。VS以降はアナウンスが鳴ります。勝ち上がりは前へ・次へで、まだ演出前の線と顔を止められます。</p>
        {error && <p role="alert">{error}</p>}
        <ul>
          {VIEWS.map(([id, label]) => (
            <li key={id}><a href={`/venue-check?view=${id}`} target="_blank" rel="noreferrer">{label}</a></li>
          ))}
        </ul>
      </section>
    );
  }
  const label = VIEWS.find(([id]) => id === view)?.[1] ?? '';
  return (
    <Stage label={label} note={note} onReplay={() => setReplay((value) => value + 1)}>
      {error && <p role="alert">{error}</p>}
      {!ready && !error && <p role="status">40人の表を組んでいます…</p>}
      {ready && <Scene view={view} data={ready.data} teams={ready.teams} replay={replay} onNote={setNote} />}
    </Stage>
  );
}
