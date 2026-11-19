import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import face from '../assets/placeholder_face.svg';
import { buildDoubleElimination, toStageData } from '../features/bracket/manager';
import type { StageData } from '../features/bracket/layout';
import BracketView from '../features/bracket/BracketView';
import AnimatedBracketAdvance from './AnimatedBracketAdvance';
import type { DrawState } from './DrawControl';
import { buildVenueAdvances, type VenueAdvance } from './venueAdvance';
import { appendPairCelebration } from '../features/presentation/backdrop/appendPresentationBackdrop';
import ChampionBoard from '../features/presentation/ceremony/ChampionBoard';
import type { CeremonyTeam } from '../features/presentation/ceremony/CeremonyFrame';
import PodiumBoard from '../features/presentation/ceremony/PodiumBoard';
import ThanksBoard from '../features/presentation/ceremony/ThanksBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import LosersIntro from '../features/presentation/scenes/LosersIntro';
import {
  LOSERS_INTRO_TITLE_SEC,
  LOSERS_INTRO_TOTAL_SEC,
} from '../features/presentation/losersIntroTiming';
import OpeningBracketTour from '../features/presentation/scenes/OpeningBracketTour';
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
  ['advance', '進行'],
  ['winners', 'ウィナーズ'],
  ['losers', 'ルーザーズ'],
  ['pair', 'ペア確定'],
  ['vs', 'VS'],
  ['semi', 'セミファイナル'],
  ['final', 'ファイナル'],
  ['again', 'ファイナルアゲイン'],
  ['losers-intro', 'ルーザーズ導入（5秒＋表5秒）'],
  ['bracket-focus', '表の寄り（消化後）'],
  ['winner', 'WINNER'],
  ['champion', '優勝'],
  ['podium', '表彰台'],
  ['thanks', '終了の挨拶'],
] as const;

type ViewId = (typeof VIEWS)[number][0];

function roster(): FixtureTeam[] {
  return Array.from({ length: TEAM_COUNT }, (_, index) => {
    const number = index + 1;
    const left = index * 2 + 1;
    const right = left + 1;
    return {
      id: `team-${number}`,
      name: `仮ペア${String(number).padStart(2, '0')}`,
      members: [`仮参加者${String(left).padStart(2, '0')}`, `仮参加者${String(right).padStart(2, '0')}`],
      faces: [face, face],
    };
  });
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
        <BracketView data={data} boardSide={side} omitCompleted={omitCompleted} {...maps} />
      </div>
    </div>
  );
}

function LosersIntroSequence({ data, teams, replay }: { data: StageData; teams: FixtureTeam[]; replay: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const next = (performance.now() - started) / 1000;
      setElapsed(next);
      if (next < LOSERS_INTRO_TOTAL_SEC + 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replay]);
  if (elapsed < LOSERS_INTRO_TITLE_SEC) {
    return <LosersIntro startAt={elapsed} audioEnabled={false} durationSec={LOSERS_INTRO_TITLE_SEC} />;
  }
  if (elapsed < LOSERS_INTRO_TOTAL_SEC) {
    return (
      <div className="losers-bracket-fade relative h-full min-h-[60vh]">
        <BracketBoard data={data} teams={teams} side="losers" omitCompleted />
      </div>
    );
  }
  return (
    <p className="m-6 text-slate-200">
      本番では {LOSERS_INTRO_TOTAL_SEC} 秒経過後に VS へ切り替わります。もう一度で最初から再生します。
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
          onNote(`${last.label} · 終了試合は非表示＋レイアウト詰め`);
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
        members={team.members.map((name, index) => ({ id: `${team.id}-${index}`, displayName: name, faceUrl: face }))}
      />
    </div>
  );
}

function advanceState(teams: FixtureTeam[], step: VenueAdvance): DrawState {
  const participants = teams.flatMap((team) => team.members.map((name, index) => ({
    id: `${team.id}-${index}`,
    eventId: 'venue-check',
    name,
    rating: null,
    portraitUrl: face,
    photoUrl: face,
    portraitContentType: 'image/svg+xml',
    portraitSource: 'automated-test' as const,
    createdAt: '',
    version: 1,
    updatedAt: '',
    presentationPortraitUrl: face,
  })));
  return {
    eventId: 'venue-check',
    title: '表示確認',
    checkinStatus: 'closed',
    checkinRevision: 0,
    scene: 'bracket',
    version: 1,
    sceneSeq: 1,
    elapsedSeconds: 0,
    durationSec: 6,
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

function AdvancePlay({ teams, replay, onNote }: { teams: FixtureTeam[]; replay: number; onNote(note: string): void }) {
  const [steps, setSteps] = useState<VenueAdvance[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setIndex(0);
    setSteps([]);
    buildVenueAdvances(teams.map((team) => team.id)).then((next) => {
      if (!cancelled) setSteps(next);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '進行を組めませんでした。');
    });
    return () => { cancelled = true; };
  }, [replay, teams]);
  useEffect(() => {
    if (index >= steps.length - 1) return undefined;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 6400);
    return () => window.clearTimeout(timer);
  }, [index, steps.length]);
  const step = steps[index];
  const state = useMemo(() => (step ? advanceState(teams, step) : null), [step, teams]);
  useEffect(() => { onNote(step ? `${step.label} · ${step.teamA}` : ''); }, [onNote, step]);
  if (error) return <p role="alert">{error}</p>;
  if (!step || !state) return <p role="status">進行を組んでいます…</p>;
  const winner = teams.find((team) => team.id === step.winnerTeamId);
  const loser = teams.find((team) => team.id === step.loserTeamId);
  if (!winner || !loser) return null;
  return (
    <AnimatedBracketAdvance
      key={`${replay}-${step.matchId}`}
      state={state}
      winnerOverlay={<WinnerBoard contained settled team={ceremony(winner)} opponent={ceremony(loser)} dropLabel={step.kind === 'winner' ? 'ルーザーへ→' : '敗退→'} />}
    />
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
  if (view === 'advance') return <AdvancePlay key={replay} teams={teams} replay={replay} onNote={onNote} />;
  if (view === 'winners' || view === 'losers') return <BracketBoard data={data} teams={teams} side={view} />;
  if (view === 'pair') return <PairHold key={replay} team={left} />;
  if (view === 'losers-intro') return <LosersIntroSequence key={replay} data={data} teams={teams} replay={replay} />;
  if (view === 'bracket-focus') return <BracketFocusPlay key={replay} teams={teams} replay={replay} onNote={onNote} />;
  if (view === 'thanks') return <ThanksBoard />;
  if (view === 'winner') return <WinnerBoard key={replay} team={ceremony(left)} opponent={ceremony(right)} />;
  if (view === 'champion') return <ChampionBoard key={replay} team={ceremony(left)} />;
  if (view === 'podium') return <PodiumBoard key={replay} first={ceremony(left)} second={ceremony(right)} third={ceremony(third)} />;
  const callout: VsCallout | null = view === 'semi' ? 'semifinal' : view === 'final' ? 'final' : view === 'again' ? 'final-again' : null;
  const roundLabel = view === 'semi' ? '準決勝' : view === 'final' ? '決勝' : view === 'again' ? '決勝' : '1回戦';
  return <VsBoard key={replay} left={ceremony(left)} right={ceremony(fourth)} roundLabel={roundLabel} callout={callout} />;
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
    const teams = roster();
    let cancelled = false;
    buildDoubleElimination(teams.map((team) => team.id)).then((snapshot) => {
      if (!cancelled) setReady({ data: toStageData(snapshot), teams });
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '仮の大会を組めませんでした。');
    });
    return () => { cancelled = true; };
  }, []);
  if (!view) {
    return (
      <section className="venue-check-menu">
        <p className="eyebrow">40人 · ダブルイリミネーション</p>
        <h1>表示を確認する</h1>
        <p>仮の20組です。各演出は別の窓で開きます。受付の入力や、進行中の大会には影響しません。</p>
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
