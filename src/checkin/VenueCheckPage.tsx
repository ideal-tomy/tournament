import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import face from '../assets/placeholder_face.svg';
import { buildDoubleElimination, toStageData } from '../features/bracket/manager';
import type { StageData } from '../features/bracket/layout';
import BracketView from '../features/bracket/BracketView';
import { appendPairCelebration } from '../features/presentation/backdrop/appendPresentationBackdrop';
import ChampionBoard from '../features/presentation/ceremony/ChampionBoard';
import type { CeremonyTeam } from '../features/presentation/ceremony/CeremonyFrame';
import PodiumBoard from '../features/presentation/ceremony/PodiumBoard';
import ThanksBoard from '../features/presentation/ceremony/ThanksBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import LosersIntro from '../features/presentation/scenes/LosersIntro';
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
  ['winners', 'ウィナーズ'],
  ['losers', 'ルーザーズ'],
  ['pair', 'ペア確定'],
  ['vs', 'VS'],
  ['semi', 'セミファイナル'],
  ['final', 'ファイナル'],
  ['again', 'ファイナルアゲイン'],
  ['losers-intro', 'ルーザーズ導入'],
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

function BracketBoard({ data, teams, side }: { data: StageData; teams: FixtureTeam[]; side: 'winners' | 'losers' }) {
  return (
    <div className="persisted-bracket">
      <h2>{side === 'losers' ? 'ルーザーズ' : 'ウィナーズ'}</h2>
      <div className="persisted-bracket-body">
        <BracketView
          data={data}
          boardSide={side}
          faceUrlByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.faces]))}
          labelByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.name]))}
          memberNamesByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.members]))}
        />
      </div>
    </div>
  );
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

function Scene({ view, data, teams, replay }: { view: ViewId; data: StageData; teams: FixtureTeam[]; replay: number }) {
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
  if (view === 'winners' || view === 'losers') return <BracketBoard data={data} teams={teams} side={view} />;
  if (view === 'pair') return <PairHold key={replay} team={left} />;
  if (view === 'losers-intro') return <LosersIntro key={replay} audioEnabled={false} />;
  if (view === 'thanks') return <ThanksBoard />;
  if (view === 'winner') return <WinnerBoard key={replay} team={ceremony(left)} opponent={ceremony(right)} />;
  if (view === 'champion') return <ChampionBoard key={replay} team={ceremony(left)} />;
  if (view === 'podium') return <PodiumBoard key={replay} first={ceremony(left)} second={ceremony(right)} third={ceremony(third)} />;
  const callout: VsCallout | null = view === 'semi' ? 'semifinal' : view === 'final' ? 'final' : view === 'again' ? 'final-again' : null;
  const roundLabel = view === 'semi' ? '準決勝' : view === 'final' ? '決勝' : view === 'again' ? '決勝' : '1回戦';
  return <VsBoard key={replay} left={ceremony(left)} right={ceremony(fourth)} roundLabel={roundLabel} callout={callout} />;
}

function Stage({ label, onReplay, children }: { label: string; onReplay(): void; children: ReactNode }) {
  return (
    <div className="venue-check-stage">
      <div className="venue-check-tools">
        <a href="/venue-check">一覧</a>
        <button type="button" onClick={onReplay}>もう一度</button>
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
    <Stage label={label} onReplay={() => setReplay((value) => value + 1)}>
      {error && <p role="alert">{error}</p>}
      {!ready && !error && <p role="status">40人の表を組んでいます…</p>}
      {ready && <Scene view={view} data={ready.data} teams={ready.teams} replay={replay} />}
    </Stage>
  );
}
