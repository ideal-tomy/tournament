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
import { getOpenTierMatches } from '../features/progression/tiers';
import CourtBoards from './CourtBoards';

export function SavedBracket({state,focusBottomTier=false}:{state:DrawState;focusBottomTier?:boolean}){
 if(!state.bracket)return null;
 const data=toStageData(state.bracket),focusMatchIds=focusBottomTier?getOpenTierMatches(data).map(m=>m.id):undefined;
 return <div className="persisted-bracket"><h2>確定ペアのBracket</h2><BracketView data={data} focusMatchIds={focusMatchIds}
  faceUrlByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.memberIds.map(id=>(()=>{const p=state.participants.find(p=>p.id===id);return p?portraitUrlFor(p):'';})())]))}
  labelByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.name]))}
  memberNamesByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.memberIds.map(id=>{const p=state.participants.find(p=>p.id===id);return p?ratedName(p):'';})]))}/></div>;
}
function existingTeam(state:DrawState,id:string|null|undefined){
 const team=state.teams.find(t=>t.id===id);if(!team)throw new Error('確定チームが見つかりません。');
 const people=team.memberIds.map(id=>{const p=state.participants.find(p=>p.id===id);if(!p)throw new Error('確定参加者が見つかりません。');return p;});
 const value=toPresentationTeam(people);return {...value,name:team.name,faces:people.map(p=>portraitUrlFor(p))};
}
/** A board's start or result, played full screen with the same scenes as a single board. */
function CourtSpotlightView({state,spot}:{state:DrawState;spot:CourtSpotlight}){
 const label=[`台 ${spot.board}`,spot.match.final?'FINAL':spot.match.roundName].filter(Boolean).join(' · ');
 if(spot.kind==='vs')return <VsBoard key={spot.id} left={existingTeam(state,spot.match.teamA)} right={existingTeam(state,spot.match.teamB)} roundLabel={label} startAt={spot.elapsed} audioEnabled/>;
 const team=existingTeam(state,spot.winnerTeamId),opponent=existingTeam(state,spot.loserTeamId);
 if(spot.elapsed<spot.winnerSec||!spot.resultPresentation)return <WinnerBoard key={`${spot.id}-winner`} team={team} opponent={opponent} startAt={spot.elapsed} audioEnabled/>;
 const advance:DrawState={...state,scene:'bracket',elapsedSeconds:spot.elapsed-spot.winnerSec,flow:{...state.flow!,phase:'bracket_update',resultPresentation:spot.resultPresentation,winnerTeamId:spot.winnerTeamId,loserTeamId:spot.loserTeamId}};
 return <AnimatedBracketAdvance key={`${spot.id}-bracket`} state={advance} winnerOverlay={<WinnerBoard contained settled team={team} opponent={opponent}/>}/>;
}
/** Single elimination ranks both semi-final losers 3rd; they are introduced together. */
function placeTeam(state:DrawState,ids:string[]|undefined){
 const teams=(ids??[]).map(id=>existingTeam(state,id));
 if(teams.length<2)return teams[0];
 return {name:teams.map(t=>t.name).join(' ／ '),members:teams.flatMap(t=>t.members),faces:teams.flatMap(t=>t.faces),participantIds:teams.flatMap(t=>t.participantIds)};
}
export default function FlowPresentation({state,controlledTime}:{state:DrawState;controlledTime?:number}){
 try{
  if(state.scene==='bracket'){
   if(state.flow?.phase==='bracket_update'&&state.flow.resultPresentation&&state.flow.winnerTeamId){const left=existingTeam(state,state.flow.winnerTeamId),right=existingTeam(state,state.flow.loserTeamId);return <AnimatedBracketAdvance state={state} controlledTime={controlledTime} winnerOverlay={<WinnerBoard contained settled team={left} opponent={right}/>}/>;}
   return <SavedBracket state={state}/>;
  }
  if(state.scene==='interval'){
   const courts=state.flow?.courts;
   if(courts?.spotlight)return <CourtSpotlightView state={state} spot={courts.spotlight}/>;
   return courts?.showBracket?<SavedBracket state={state} focusBottomTier/>:<CourtBoards state={state} teamOf={id=>existingTeam(state,id)}/>;
  }
  if(state.scene==='finished')return <ThanksBoard/>;
  if(state.scene==='award'){
   const step=state.flow?.ceremony??'champion',placements=state.flow?.placements;
   const timing={startAt:state.elapsedSeconds,controlledTime,audioEnabled:controlledTime==null};
   if(step==='third'||step==='second'){
    const team=placeTeam(state,placements?.[step]);if(!team)throw new Error('順位のチームが見つかりません。');
    return <WinnerBoard key={state.sceneSeq} team={team} title={step==='third'?'3RD PLACE':'2ND PLACE'} label={`${step==='third'?'3位':'2位'} ${team.name}`} {...timing}/>;
   }
   if(step==='podium')return <PodiumBoard key={state.sceneSeq} first={existingTeam(state,placements?.first??state.flow?.championTeamId)} second={placeTeam(state,placements?.second)} third={placeTeam(state,placements?.third)} {...timing}/>;
   return <ChampionBoard key={state.sceneSeq} team={existingTeam(state,state.flow?.championTeamId)} {...timing}/>;
  }
  if(state.scene==='vs_card'||state.scene==='match_live'){
   const left=existingTeam(state,state.flow?.currentMatch?.teamA);
   const right=existingTeam(state,state.flow?.currentMatch?.teamB);
   const round=[state.flow?.currentMatch?.final?'FINAL':state.flow?.currentMatch?.roundName,state.scene==='match_live'?'試合中':'試合開始を待っています'].filter(Boolean).join(' · ');
   return <VsBoard key={state.sceneSeq} left={left} right={right} roundLabel={round} settled={state.scene==='match_live'} startAt={controlledTime??state.elapsedSeconds} audioEnabled={controlledTime==null&&state.scene==='vs_card'}/>;
  }
  if(state.scene==='result'){
   const left=existingTeam(state,state.flow?.winnerTeamId);
   const right=existingTeam(state,state.flow?.loserTeamId);
   return <WinnerBoard key={state.sceneSeq} team={left} opponent={right} startAt={state.elapsedSeconds} controlledTime={controlledTime} audioEnabled={controlledTime==null}/>;
  }
  return null;
 }catch(reason){return <p role="alert" className="error">{reason instanceof Error?reason.message:'大会データを表示できません。'}</p>;}
}
