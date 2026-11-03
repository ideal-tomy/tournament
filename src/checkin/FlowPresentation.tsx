import BracketView from '../features/bracket/BracketView';
import { toStageData } from '../features/bracket/stageData';
import { toPresentationTeam } from './presentationAdapter';
import type { DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import AnimatedBracketAdvance from './AnimatedBracketAdvance';
import VsBoard from '../features/presentation/vsBoard/VsBoard';
import WinnerBoard from '../features/presentation/ceremony/WinnerBoard';
import ChampionBoard from '../features/presentation/ceremony/ChampionBoard';

export function SavedBracket({state}:{state:DrawState}){
 if(!state.bracket)return null;
 return <div className="persisted-bracket"><h2>確定ペアのBracket</h2><BracketView data={toStageData(state.bracket)}
  faceUrlByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.memberIds.map(id=>(()=>{const p=state.participants.find(p=>p.id===id);return p?portraitUrlFor(p):'';})())]))}
  labelByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.name]))}
  memberNamesByTeamId={Object.fromEntries(state.teams.map(team=>[team.id,team.memberIds.map(id=>state.participants.find(p=>p.id===id)?.name??'')]))}/></div>;
}
function existingTeam(state:DrawState,id:string|null|undefined){
 const team=state.teams.find(t=>t.id===id);if(!team)throw new Error('確定チームが見つかりません。');
 const people=team.memberIds.map(id=>{const p=state.participants.find(p=>p.id===id);if(!p)throw new Error('確定参加者が見つかりません。');return p;});
 const value=toPresentationTeam(people);return {...value,name:team.name,faces:people.map(p=>portraitUrlFor(p))};
}
export default function FlowPresentation({state,controlledTime}:{state:DrawState;controlledTime?:number}){
 try{
  if(state.scene==='bracket'){
   if(state.flow?.phase==='bracket_update'&&state.flow.resultPresentation&&state.flow.winnerTeamId){const left=existingTeam(state,state.flow.winnerTeamId),right=existingTeam(state,state.flow.loserTeamId);return <AnimatedBracketAdvance state={state} controlledTime={controlledTime} winnerOverlay={<WinnerBoard contained settled team={left} opponent={right}/>}/>;}
   return <SavedBracket state={state}/>;
  }
  if(state.scene==='award'||state.scene==='finished')return <ChampionBoard key={state.sceneSeq} team={existingTeam(state,state.flow?.championTeamId)} settled={state.scene==='finished'} startAt={state.elapsedSeconds} controlledTime={controlledTime} audioEnabled={controlledTime==null&&state.scene==='award'}/>;
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
