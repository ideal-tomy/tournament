import BracketView from '../features/bracket/BracketView';
import { toStageData } from '../features/bracket/stageData';
import { ratedName, toPresentationTeam } from './presentationAdapter';
import type { CourtSpotlight, DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import AnimatedBracketAdvance from './AnimatedBracketAdvance';
import VsBoard from '../features/presentation/vsBoard/VsBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import ChampionBoard from '../features/presentation/ceremony/ChampionBoard';
import PodiumBoard from '../features/presentation/ceremony/PodiumBoard';
import ThanksBoard from '../features/presentation/ceremony/ThanksBoard';
import LosersIntro from '../features/presentation/scenes/LosersIntro';
import OpeningBracketTour from '../features/presentation/scenes/OpeningBracketTour';
import { LOSERS_INTRO_TITLE_SEC, LOSERS_INTRO_TOTAL_SEC } from '../features/presentation/losersIntroTiming';
import { getOpenTierMatches } from '../features/progression/tiers';
import { getActiveWinnersTeamIds } from '../features/progression/winnersAlive';
import type { BracketBoardSide } from '../features/bracket/layout';
import CourtBoards from './CourtBoards';

function boardSideFor(state: DrawState): BracketBoardSide {
  return state.flow?.boardSide ?? 'winners';
}

function dropLabelFor(kind: string | undefined) {
  return kind === 'winner' ? 'ルーザーへ→' : '敗退→';
}

function winnersRail(state: DrawState) {
  if (!state.bracket || boardSideFor(state) !== 'losers') return null;
  const ids = getActiveWinnersTeamIds(toStageData(state.bracket));
  const teams = ids.map((id) => state.teams.find((team) => team.id === id)).filter((team): team is NonNullable<typeof team> => !!team);
  if (!teams.length) return null;
  return (
    <aside className="winners-rail" aria-label="ウィナーズに残っているチーム">
      <p className="winners-rail-title">WINNERS</p>
      <ul>
        {teams.map((team) => {
          const faces = team.memberIds.map((id) => {
            const person = state.participants.find((p) => p.id === id);
            return person ? portraitUrlFor(person) : '';
          });
          return (
            <li key={team.id}>
              <div className="winners-rail-faces">
                {faces.map((face, index) =>
                  face ? <img key={`${team.id}-${index}`} src={face} alt="" /> : <span key={`${team.id}-${index}`} className="winners-rail-empty">?</span>,
                )}
              </div>
              <span>{team.name}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function GrandFinalFeature({ state }: { state: DrawState }) {
  const match = state.flow?.currentMatch;
  if (!match?.teamA || !match?.teamB) return null;
  return (
    <div className="relative h-full min-h-[60vh] overflow-hidden bg-[#05070c]" aria-label="グランドファイナル">
      <p className="pointer-events-none absolute left-6 top-5 z-10 m-0 text-sm font-black tracking-[0.28em] text-slate-200">
        グランドファイナル
      </p>
      <VsBoard
        settled
        left={existingTeam(state, match.teamA)}
        right={existingTeam(state, match.teamB)}
        roundLabel="GRAND FINAL"
        callout={match.callout}
      />
    </div>
  );
}

export function SavedBracket({
  state,
  focusBottomTier = false,
}: {
  state: DrawState;
  focusBottomTier?: boolean;
}) {
  if (!state.bracket) return null;
  const data = toStageData(state.bracket);
  const side = boardSideFor(state);
  if (side === 'grand_final') {
    const feature = <GrandFinalFeature state={state} />;
    if (feature) return feature;
  }
  const current = state.flow?.currentMatch;
  const showcase =
    current &&
    (current.callout === 'semifinal' ||
      current.callout === 'losers-semifinal' ||
      current.callout === 'final' ||
      current.callout === 'final-again' ||
      current.kind === 'grand_final');
  const focusMatchIds = showcase
    ? [current.id]
    : focusBottomTier
      ? getOpenTierMatches(data).map((m) => m.id)
      : undefined;
  return (
    <div className={`persisted-bracket board-side-${side}`}>
      <h2>{side === 'losers' ? 'ルーザーズ' : side === 'grand_final' ? 'グランドファイナル' : 'ウィナーズ'}</h2>
      <div className="persisted-bracket-body">
        <BracketView
          data={data}
          boardSide={side}
          focusMatchIds={focusMatchIds}
          faceUrlByTeamId={Object.fromEntries(
            state.teams.map((team) => [
              team.id,
              team.memberIds.map((id) => {
                const p = state.participants.find((person) => person.id === id);
                return p ? portraitUrlFor(p) : '';
              }),
            ]),
          )}
          labelByTeamId={Object.fromEntries(state.teams.map((team) => [team.id, team.name]))}
          memberNamesByTeamId={Object.fromEntries(
            state.teams.map((team) => [
              team.id,
              team.memberIds.map((id) => {
                const p = state.participants.find((person) => person.id === id);
                return p ? ratedName(p) : '';
              }),
            ]),
          )}
        />
        {winnersRail(state)}
      </div>
    </div>
  );
}

function existingTeam(state: DrawState, id: string | null | undefined) {
  const team = state.teams.find((t) => t.id === id);
  if (!team) throw new Error('確定チームが見つかりません。');
  const people = team.memberIds.map((memberId) => {
    const p = state.participants.find((person) => person.id === memberId);
    if (!p) throw new Error('確定参加者が見つかりません。');
    return p;
  });
  const value = toPresentationTeam(people);
  return { ...value, name: team.name, faces: people.map((p) => portraitUrlFor(p)) };
}

/** A board's start or result, played full screen with the same scenes as a single board. */
function CourtSpotlightView({ state, spot }: { state: DrawState; spot: CourtSpotlight }) {
  if (spot.kind === 'losers-intro') {
    if (spot.elapsed < LOSERS_INTRO_TITLE_SEC) {
      return <LosersIntro key={`${spot.id}-title`} startAt={spot.elapsed} audioEnabled durationSec={LOSERS_INTRO_TITLE_SEC} />;
    }
    return (
      <div key={`${spot.id}-bracket`} className="relative h-full min-h-[60vh]">
        <SavedBracket state={{ ...state, flow: { ...state.flow!, boardSide: 'losers' } }} />
      </div>
    );
  }
  const label = [`台 ${spot.board}`, spot.match.final ? 'FINAL' : spot.match.roundName].filter(Boolean).join(' · ');
  if (spot.kind === 'vs') {
    return (
      <VsBoard
        key={spot.id}
        left={existingTeam(state, spot.match.teamA)}
        right={existingTeam(state, spot.match.teamB)}
        roundLabel={label}
        callout={spot.match.callout}
        startAt={spot.elapsed}
        audioEnabled
      />
    );
  }
  const team = existingTeam(state, spot.winnerTeamId);
  const opponent = existingTeam(state, spot.loserTeamId);
  const drop = dropLabelFor(spot.match.kind);
  if (spot.elapsed < spot.winnerSec || !spot.resultPresentation) {
    return (
      <WinnerBoard
        key={`${spot.id}-winner`}
        team={team}
        opponent={opponent}
        dropLabel={drop}
        startAt={spot.elapsed}
        audioEnabled
      />
    );
  }
  const advance: DrawState = {
    ...state,
    scene: 'bracket',
    elapsedSeconds: spot.elapsed - spot.winnerSec,
    flow: {
      ...state.flow!,
      phase: 'bracket_update',
      resultPresentation: spot.resultPresentation,
      winnerTeamId: spot.winnerTeamId,
      loserTeamId: spot.loserTeamId,
      boardSide: spot.match.kind === 'loser' ? 'losers' : spot.match.kind === 'grand_final' ? 'grand_final' : 'winners',
    },
  };
  return (
    <AnimatedBracketAdvance
      key={`${spot.id}-bracket`}
      state={advance}
      winnerOverlay={<WinnerBoard contained settled team={team} opponent={opponent} dropLabel={drop} />}
    />
  );
}

function placeTeams(state: DrawState, ids: string[] | undefined) {
  return (ids ?? []).map((id) => existingTeam(state, id));
}

export default function FlowPresentation({ state, controlledTime }: { state: DrawState; controlledTime?: number }) {
  try {
    if (state.scene === 'bracket') {
      if (state.flow?.phase === 'bracket_update' && state.flow.resultPresentation && state.flow.winnerTeamId) {
        const winner = existingTeam(state, state.flow.winnerTeamId);
        const loser = existingTeam(state, state.flow.loserTeamId);
        const match = state.flow.resultPresentation.match;
        return (
          <AnimatedBracketAdvance
            state={state}
            controlledTime={controlledTime}
            winnerOverlay={
              <WinnerBoard
                contained
                settled
                team={winner}
                opponent={loser}
                dropLabel={dropLabelFor(match.kind)}
              />
            }
          />
        );
      }
      if (!state.flow?.completedMatches && state.bracket) {
        const data = toStageData(state.bracket);
        const faceUrlByTeamId = Object.fromEntries(
          state.teams.map((team) => [
            team.id,
            team.memberIds.map((id) => {
              const p = state.participants.find((person) => person.id === id);
              return p ? portraitUrlFor(p) : '';
            }),
          ]),
        );
        const labelByTeamId = Object.fromEntries(state.teams.map((team) => [team.id, team.name]));
        const memberNamesByTeamId = Object.fromEntries(
          state.teams.map((team) => [
            team.id,
            team.memberIds.map((id) => {
              const p = state.participants.find((person) => person.id === id);
              return p ? ratedName(p) : '';
            }),
          ]),
        );
        const tourTeams = state.teams.map((team) => ({
          id: team.id,
          name: team.name,
          faces: faceUrlByTeamId[team.id] ?? [],
          members: memberNamesByTeamId[team.id] ?? [],
        }));
        return (
          <OpeningBracketTour
            data={data}
            teams={tourTeams}
            faceUrlByTeamId={faceUrlByTeamId}
            labelByTeamId={labelByTeamId}
            memberNamesByTeamId={memberNamesByTeamId}
            startAt={controlledTime ?? state.elapsedSeconds}
          />
        );
      }
      return <SavedBracket state={state} />;
    }
    if (state.scene === 'interval') {
      const courts = state.flow?.courts;
      if (courts?.spotlight) return <CourtSpotlightView state={state} spot={courts.spotlight} />;
      return courts?.showBracket ? <SavedBracket state={state} focusBottomTier /> : <CourtBoards state={state} teamOf={(id) => existingTeam(state, id)} />;
    }
    if (state.scene === 'finished') return <ThanksBoard />;
    if (state.scene === 'award') {
      const step = state.flow?.ceremony ?? 'champion';
      const placements = state.flow?.placements;
      const timing = { startAt: state.elapsedSeconds, controlledTime, audioEnabled: controlledTime == null };
      if (step === 'third' || step === 'second') {
        const teams = placeTeams(state, placements?.[step]);
        if (!teams.length) throw new Error('順位のチームが見つかりません。');
        return (
          <WinnerBoard
            key={state.sceneSeq}
            groups={teams}
            title={step === 'third' ? '3RD PLACE' : '2ND PLACE'}
            label={`${step === 'third' ? '3位' : '2位'} ${teams.map((team) => team.name).join('、')}`}
            {...timing}
          />
        );
      }
      if (step === 'podium') {
        return (
          <PodiumBoard
            key={state.sceneSeq}
            first={existingTeam(state, placements?.first ?? state.flow?.championTeamId)}
            second={placeTeams(state, placements?.second)}
            third={placeTeams(state, placements?.third)}
            {...timing}
          />
        );
      }
      return <ChampionBoard key={state.sceneSeq} team={existingTeam(state, state.flow?.championTeamId)} {...timing} />;
    }
    if (state.scene === 'vs_card' || state.scene === 'match_live') {
      const elapsed = controlledTime ?? state.elapsedSeconds;
      if (state.scene === 'vs_card' && state.flow?.losersIntroPending && elapsed < LOSERS_INTRO_TOTAL_SEC) {
        if (elapsed < LOSERS_INTRO_TITLE_SEC) {
          return <LosersIntro key={`losers-intro-${state.sceneSeq}`} startAt={elapsed} audioEnabled={controlledTime == null} durationSec={LOSERS_INTRO_TITLE_SEC} />;
        }
        return (
          <div key={`losers-bracket-${state.sceneSeq}`} className="relative h-full min-h-[60vh]">
            <SavedBracket state={{ ...state, flow: { ...state.flow!, boardSide: 'losers' } }} />
          </div>
        );
      }
      const left = existingTeam(state, state.flow?.currentMatch?.teamA);
      const right = existingTeam(state, state.flow?.currentMatch?.teamB);
      const round = [
        state.flow?.currentMatch?.final ? 'FINAL' : state.flow?.currentMatch?.roundName,
        state.scene === 'match_live' ? '試合中' : '試合開始を待っています',
      ]
        .filter(Boolean)
        .join(' · ');
      const vsStart =
        state.scene === 'vs_card' && state.flow?.losersIntroPending
          ? Math.max(0, elapsed - LOSERS_INTRO_TOTAL_SEC)
          : elapsed;
      return (
        <VsBoard
          key={state.sceneSeq}
          left={left}
          right={right}
          roundLabel={round}
          callout={state.flow?.currentMatch?.callout}
          settled={state.scene === 'match_live'}
          startAt={vsStart}
          audioEnabled={controlledTime == null && state.scene === 'vs_card'}
        />
      );
    }
    if (state.scene === 'result') {
      const winner = existingTeam(state, state.flow?.winnerTeamId);
      const loser = existingTeam(state, state.flow?.loserTeamId);
      const match = state.flow?.resultPresentation?.match ?? state.flow?.currentMatch;
      return (
        <WinnerBoard
          key={state.sceneSeq}
          team={winner}
          opponent={loser}
          dropLabel={dropLabelFor(match?.kind)}
          startAt={state.elapsedSeconds}
          controlledTime={controlledTime}
          audioEnabled={controlledTime == null}
        />
      );
    }
    return null;
  } catch (reason) {
    return <p role="alert" className="error">{reason instanceof Error ? reason.message : '大会データを表示できません。'}</p>;
  }
}
