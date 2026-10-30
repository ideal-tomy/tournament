import { useCallback, useEffect, useRef } from 'react';
import PostMatchStage, { type StageControls } from '../features/presentation/postMatch/PostMatchStage';
import { postMatchTiming } from '../features/presentation/postMatch/timing';
import FixtureStage from '../preview/FixtureStage';
import BracketView from '../features/bracket/BracketView';
import { toStageData } from '../features/bracket/stageData';
import { toPresentationTeam } from './presentationAdapter';
import type { DrawState } from './DrawControl';
import { portraitUrlFor } from './portraitCache';
import AnimatedBracketAdvance from './AnimatedBracketAdvance';
import {computeBracketLayout} from '../features/bracket/layout';

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
function Timeline({state,left,right,champion=false,controlledTime}:{state:DrawState;left:ReturnType<typeof existingTeam>;right?:ReturnType<typeof existingTeam>;champion?:boolean;controlledTime?:number}){
 const controls=useRef<StageControls>(null),done=useRef(false);
 const timing=postMatchTiming('full');
 const start=champion||state.scene==='result'?0:timing.approach;
 const end=champion?5:state.scene==='result'?timing.advance-.01:timing.hold;
 const initial=useRef(state.scene==='match_live'||state.scene==='finished'?end:Math.min(end,start+state.elapsedSeconds));
 const onProgress=useCallback((time:number)=>{if(time>=end-.001&&!done.current){done.current=true;controls.current?.seek(end);}},[end]);
 useEffect(()=>{controls.current?.seek(initial.current);if(controlledTime==null&&initial.current<end){done.current=false;controls.current?.play();}},[end]);
 useEffect(()=>{if(controlledTime!=null)controls.current?.seek(state.scene==='match_live'?end:Math.min(end,start+controlledTime));},[controlledTime,end,start]);
 const entry=useRef((()=>{if(!state.flow?.resultPresentation||state.scene==='result'||!state.bracket)return undefined;const layout=computeBracketLayout(toStageData(state.bracket)),match=layout.byId[state.flow.currentMatch?.id??-1];if(!match)return undefined;const viewport=16/9,scale=Math.min(viewport/layout.width,1/layout.height);return match.slots.map(slot=>({x:((viewport-layout.width*scale)/2+slot.center.x*scale)/viewport*100,y:((1-layout.height*scale)/2+slot.center.y*scale)*100})) as [{x:number;y:number},{x:number;y:number}];})());
 return champion?<FixtureStage ref={controls} scene="champion" mode="full" team={left} eventLabel={state.title} onProgress={onProgress}/>:<PostMatchStage ref={controls} mode="full" winnerTeam={left} opponentTeam={right} eventLabel={state.title} entryPositions={entry.current} onProgress={onProgress}/>;
}
export default function FlowPresentation({state,controlledTime}:{state:DrawState;controlledTime?:number}){
 try{
  if(state.scene==='bracket'){
   if(state.flow?.phase==='bracket_update'&&state.flow.resultPresentation&&state.flow.winnerTeamId){const left=existingTeam(state,state.flow.winnerTeamId),right=existingTeam(state,state.flow.loserTeamId);return <AnimatedBracketAdvance state={state} controlledTime={controlledTime} winnerOverlay={<Timeline state={{...state,scene:'result',elapsedSeconds:3.99}} left={left} right={right} controlledTime={3.99}/>}/>;}
   return <SavedBracket state={state}/>;
  }
  if(state.scene==='award'||state.scene==='finished')return <Timeline key={state.sceneSeq} state={state} champion left={existingTeam(state,state.flow?.championTeamId)}/>;
  if(['vs_card','match_live','result'].includes(state.scene)){
   const left=existingTeam(state,state.scene==='result'?state.flow?.winnerTeamId:state.flow?.currentMatch?.teamA);
   const right=existingTeam(state,state.scene==='result'?state.flow?.loserTeamId:state.flow?.currentMatch?.teamB);
   return <><p className="match-phase" role="status">{state.flow?.currentMatch?.roundName?`${state.flow.currentMatch.roundName} · `:state.flow?.currentMatch?.final?'FINAL · ':''}{state.scene==='match_live'?'試合中':state.scene==='result'?'結果確定・Bracket更新':state.flow?.canStart?'試合開始を待っています':'NEXT MATCH / VS'}</p>
    {state.scene!=='result'&&state.flow?.resultPresentation?<div className="audience-vs"><div className="audience-vs-bracket"><SavedBracket state={state}/></div><Timeline key={state.sceneSeq} state={state} left={left} right={right} controlledTime={controlledTime}/></div>:<Timeline key={state.sceneSeq} state={state} left={left} right={right} controlledTime={controlledTime}/>}</>;
  }
  return null;
 }catch(reason){return <p role="alert" className="error">{reason instanceof Error?reason.message:'大会データを表示できません。'}</p>;}
}
