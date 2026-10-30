import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, scopedUrl, type Participant } from './api';
import type { BracketSnapshot } from '../features/bracket/manager';
import type { DrawPresentationData } from '../features/draw/presentationTypes';
import DrawStage from '../features/presentation/scenes/DrawStage';
import FlowPresentation, { SavedBracket } from './FlowPresentation';
import { toPresentationParticipant } from './presentationAdapter';
import { preparePortraits, portraitUrlFor } from './portraitCache';

export interface DrawState {
 format?:string; timingPreset?:'show'|'fast';
 flow: {resultPresentation?:{beforeBracket:BracketSnapshot;match:{id:number;teamA:string;teamB:string;round:number;kind:string;final:boolean};winnerTeamId:string}|null;phase:string;currentMatch:{id:number;teamA:string;teamB:string;round:number;roundName?:string;kind:string;final:boolean}|null;winnerTeamId:string|null;loserTeamId:string|null;championTeamId:string|null;lastMatchId:number|null;canGameStart:boolean;canAnnounce:boolean;canStart:boolean;canScore:boolean;canAdvance:boolean;completedMatches:number}|null;
 eventId:string;title:string;checkinStatus:string;checkinRevision:number;scene:string;version:number;sceneSeq:number;
 elapsedSeconds:number;durationSec:number;canComplete:boolean;
 session:{id:string;revealOrder:string[];committedAt:string}|null;
 participants:Participant[];teams:{id:string;name:string;memberIds:string[];seed:number}[];bracket:BracketSnapshot|null;
}
function useDraw(onAuthRequired:()=>void,sessionVersion:number,administration:boolean,automaticAdvance:boolean){
 const [state,setState]=useState<DrawState|null>(null),[error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{let cancelled=false,fetching=false;const controller=new AbortController();
  async function poll(){if(fetching||cancelled||document.hidden)return;fetching=true;try{
   let next=await api<DrawState>('/api/draw/state',{signal:controller.signal});
   if(administration&&automaticAdvance&&next.flow?.canAdvance)next=await api<DrawState>('/api/tournament/advance',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),expectedVersion:next.version}),signal:controller.signal});
   next=await preparePortraits(next,controller.signal);
   if(!cancelled){setState(previous=>previous&&previous.version===next.version&&previous.checkinRevision===next.checkinRevision&&previous.flow?.canStart===next.flow?.canStart&&previous.flow?.canGameStart===next.flow?.canGameStart?previous:next);setError('');}
  }catch(reason){if(reason instanceof ApiError&&['VERSION_CONFLICT','SCENE_NOT_FINISHED'].includes(reason.code))return;if(!cancelled){setError(reason instanceof Error?reason.message:'Draw状態を取得できませんでした。');if(reason instanceof ApiError&&reason.status===401)onAuthRequired();}}finally{fetching=false;}}
  void poll();const timer=setInterval(()=>void poll(),1000);const visible=()=>void poll();document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[onAuthRequired,sessionVersion,revision,administration,automaticAdvance]);
 return {state,error,refresh:useCallback(()=>setRevision(v=>v+1),[])};
}
export default function DrawControl({administration,onAuthRequired,sessionVersion,onActiveChange,automaticAdvance=false}:{administration:boolean;onAuthRequired():void;sessionVersion:number;onActiveChange?(active:boolean):void;automaticAdvance?:boolean}){
 const {state,error,refresh}=useDraw(onAuthRequired,sessionVersion,administration,automaticAdvance);
 const [busy,setBusy]=useState(false),[commandError,setCommandError]=useState(''),[photoError,setPhotoError]=useState(false);
 const operation=useRef<{path:string;body:{requestId:string;expectedVersion:number;winnerSlot?:number}}|null>(null);
 const closeCommand=useRef<{requestId:string;expectedRevision:number}|null>(null);
 const command=useRef<{requestId:string;expectedVersion:number}|null>(null);
 const presentation=useMemo(()=>{
  if(!state?.session)return null;
  try{
   const byId=new Map(state.participants.map(p=>[p.id,p]));
   const participants=state.session.revealOrder.map(id=>{const p=byId.get(id);if(!p)throw new Error('確定参加者が見つかりません。');const adapted=toPresentationParticipant(p);return {id:adapted.id,displayName:adapted.displayName,faceUrl:portraitUrlFor(p),rating:adapted.rating};});
   return {data:{sessionId:state.session.id,teamSize:2,participants} satisfies DrawPresentationData,error:''};
  }catch(reason){return {data:null,error:reason instanceof Error?reason.message:'演出データが不正です。'};}
 },[state]);
 async function closeReception(){if(!state||busy)return;setBusy(true);setCommandError('');closeCommand.current??={requestId:crypto.randomUUID(),expectedRevision:state.checkinRevision};
  try{await api('/api/checkin/close',{method:'POST',body:JSON.stringify(closeCommand.current)});closeCommand.current=null;refresh();}
  catch(reason){setCommandError(reason instanceof Error?reason.message:'受付終了に失敗しました。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500)closeCommand.current=null;}}
  finally{setBusy(false);}}
 async function start(){if(!state||busy)return;setBusy(true);setCommandError('');command.current??={requestId:crypto.randomUUID(),expectedVersion:state.version};
  try{await api('/api/draw/start',{method:'POST',body:JSON.stringify(command.current)});command.current=null;refresh();}
  catch(reason){setCommandError(reason instanceof Error?reason.message:'Draw開始に失敗しました。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500)command.current=null;}}
  finally{setBusy(false);}}
 async function operate(action:'advance'|'game-start'|'start'|'winner',winnerSlot?:number){
  if(!state||busy)return;setBusy(true);setCommandError('');
  operation.current??={path:`/api/tournament/${action}`,body:{requestId:crypto.randomUUID(),expectedVersion:state.version,...(winnerSlot==null?{}:{winnerSlot})}};
  try{await api(operation.current.path,{method:'POST',body:JSON.stringify(operation.current.body)});operation.current=null;refresh();}
  catch(reason){setCommandError(reason instanceof Error?reason.message:'処理に失敗しました。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500){operation.current=null;refresh();}}}
  finally{setBusy(false);}
 }
 useEffect(()=>onActiveChange?.(!!state?.session),[state?.session?.id,onActiveChange]);
 const onComplete=useCallback(()=>refresh(),[refresh]);
 return <section className={administration?'card draw-operations':'draw-monitor'} data-draw-scene={state?.scene??'loading'} data-draw-version={state?.version??0}>
  {administration&&<><h2>大会運営</h2><p>受付終了で参加者とペアを固定し、運営の操作で発表・ゲーム開始へ進みます。</p><p>対象 {state?.participants.length??0}名 · 受付{state?.checkinStatus==='closed'?'終了':'中'}</p>
   {state?.checkinStatus==='open'&&<button className="primary" disabled={busy} onClick={()=>{if(closeCommand.current||window.confirm(`${state.participants.length}名で受付を終了し、ペアを確定しますか？`))void closeReception();}}>{closeCommand.current?'受付終了を再試行':'受付終了'}</button>}
   {state?.checkinStatus==='closed'&&!state.session&&<button disabled={busy} onClick={()=>void closeReception()}>ペア確定を再試行</button>}
   {state?.session&&state.scene==='idle'&&<button className="primary" disabled={busy||state?.checkinStatus!=='closed'} onClick={()=>{if(command.current||window.confirm(`${state?.participants.length}名の確定ペアを会場Displayで発表しますか？`))void start();}}>{busy?'保存中…':command.current?'同じペア発表開始を再試行':'ペア発表開始'}</button>}
   {state?.session&&<><p>ペア確定済み：{state.session.id}</p><p>Displayの状態：{state.scene==='idle'?'ペア発表開始待ち':state.scene==='draw'?'ペア発表中（操作待ち）':state.scene} · version {state.version}</p><ol>{state.teams.map(team=><li key={team.id}>Pair {team.seed+1}：{team.name}</li>)}</ol></>}
   {state?.scene==='bracket'&&state.flow?.phase!=='bracket_update'&&<button className="primary" disabled={busy||!state.flow?.canGameStart||!!operation.current} onClick={()=>void operate('game-start')}>ゲームスタート</button>}
   {state?.flow?.currentMatch&&<div className="current-match"><h2>{state.flow.currentMatch.final?'FINAL':'対戦'} · {state.flow.currentMatch.roundName??`Round ${state.flow.currentMatch.round}`} · Match #{state.flow.currentMatch.id+1}</h2>
    <div className="current-teams">{(['teamA','teamB'] as const).map((side,index)=>{const team=state.teams.find(t=>t.id===state.flow!.currentMatch![side]);return team&&<section key={side} aria-label={`Team ${index===0?'A':'B'}`}><h3>Team {index===0?'A':'B'}：{team.name}</h3>{team.memberIds.map(id=>{const person=state.participants.find(p=>p.id===id);return person&&<figure key={id}><img src={`${person.portraitUrl}?version=${person.version}`} alt={person.name} width={88} height={88}/><figcaption>{person.name}</figcaption></figure>;})}</section>;})}</div>
    {state.scene==='vs_card'&&<button className="primary" disabled={busy||!state.flow.canStart||!!operation.current} onClick={()=>void operate('start')}>試合開始</button>}
    {state.scene==='match_live'&&<><p>勝者を確定してください。</p>{([0,1] as const).map(slot=>{const id=slot===0?state.flow!.currentMatch!.teamA:state.flow!.currentMatch!.teamB;const team=state.teams.find(t=>t.id===id)!;return <button key={id} disabled={busy||!!operation.current} onClick={()=>{if(window.confirm(`${team.name}の勝利を確定しますか？`))void operate('winner',slot);}}>{team.name} の勝利を確定</button>;})}</>}
   </div>}
   {state?.scene==='result'&&<p>勝者：{state.teams.find(t=>t.id===state.flow?.winnerTeamId)?.name}。表示が終わったら運営担当者が次の試合へ進めます。</p>}
   {state?.flow?.phase==='bracket_update'&&<p role="status">勝ち上がりを表示中です。表示が終わったら「次の試合へ進む」を押してください。</p>}
   {['award','finished'].includes(state?.scene??'')&&<p>CHAMPION：{state?.teams.find(t=>t.id===state.flow?.championTeamId)?.name}</p>}
   {state?.flow?.canAdvance&&<button className="primary" disabled={busy||!!operation.current} onClick={()=>void operate('advance')}>次の試合へ進む</button>}
   {operation.current&&!busy&&<button onClick={()=>void operate(operation.current!.path.split('/').at(-1) as 'advance'|'game-start'|'start'|'winner',operation.current!.body.winnerSlot)}>同じ操作を再試行</button>}
   <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">会場Displayを開く</a>
  </>}
  {(error||commandError||presentation?.error||photoError)&&<p role="alert" className="error">{error||commandError||presentation?.error||'保存写真を読み込めません。接続を確認してください。'}<button onClick={()=>{setPhotoError(false);refresh();}}>再読み込み</button></p>}
  {!administration&&(!state?.session||state.scene==='idle'?<div className="card"><h1>大会開始待機</h1><p>{state?.checkinStatus==='closed'?'受付が終了しました。ペア発表開始をお待ちください。':'参加者を受け付けています。大会開始までお待ちください。'}</p></div>:state.scene==='draw'&&presentation?.data&&!photoError?<div className="live-draw-stage" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement)setPhotoError(true);}}>
   <DrawStage key={`${state.session.id}-${state.sceneSeq}`} eventId={state.eventId} sceneSeq={state.sceneSeq} data={presentation.data} presentationMode="full" timingPreset={state.timingPreset} audioEnabled={false} startAtSeconds={state.elapsedSeconds} onComplete={onComplete}/>
  </div>:<div className="tournament-stage" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement)setPhotoError(true);}}><FlowPresentation key={state.sceneSeq} state={state}/></div>)}
  {administration&&state?.bracket&&<SavedBracket state={state}/>}

 </section>;
}
