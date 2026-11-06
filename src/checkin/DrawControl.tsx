import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, scopedUrl, type Participant } from './api';
import type { BracketSnapshot } from '../features/bracket/manager';
import type { DrawPresentationData } from '../features/draw/presentationTypes';
import DrawStage from '../features/presentation/scenes/DrawStage';
import FlowPresentation, { SavedBracket } from './FlowPresentation';
import { toPresentationParticipant } from './presentationAdapter';
import { portraitUrlFor } from './portraitCache';
import { useTournamentState } from './useTournamentState';
import { preloadPresentationAssets } from './preloadPresentationAssets';
import { currentReview, reviewState, reviewUrl } from './reviewPlayback';
import PresentationBedUnlock from '../features/presentation/backdrop/PresentationBedUnlock';
import { resolveVenueBed, usePresentationBed } from '../features/presentation/backdrop/presentationBed';
import VenueOpening from './VenueOpening';

const reviewDone = () => {};

export interface FlowMatch {id:number;teamA:string;teamB:string;round:number;roundName?:string;kind:string;final:boolean}
export interface CourtBoard {board:number;matchId:number|null;stage:'idle'|'call'|'live'|'result';startedAt:string|null;winnerTeamId?:string|null;loserTeamId?:string|null;showing:boolean;match:FlowMatch|null}
export type ResultPresentation={beforeBracket:BracketSnapshot;match:{id:number;teamA:string;teamB:string;round:number;kind:string;final:boolean};winnerTeamId:string};
export interface CourtSpotlight {id:string;kind:'vs'|'winner';board:number;match:FlowMatch;elapsed:number;winnerSec:number;winnerTeamId:string|null;loserTeamId:string|null;resultPresentation:ResultPresentation|null}
export type CeremonyStep='third'|'second'|'champion'|'podium';
export interface Placements {first:string;second:string[];third:string[]}
export interface DrawState {
 format?:string; timingPreset?:'show'|'fast'; openingVersion?:string|null;
 flow: {ceremony?:CeremonyStep|null;placements?:Placements|null;resultPresentation?:ResultPresentation|null;phase:string;currentMatch:FlowMatch|null;courts?:{count:number;showBracket:boolean;spotlight:CourtSpotlight|null;boards:CourtBoard[]}|null;winnerTeamId:string|null;loserTeamId:string|null;championTeamId:string|null;lastMatchId:number|null;canGameStart:boolean;canAnnounce:boolean;canStart:boolean;canScore:boolean;canAdvance:boolean;completedMatches:number}|null;
 eventId:string;title:string;checkinStatus:string;checkinRevision:number;scene:string;version:number;sceneSeq:number;
 elapsedSeconds:number;durationSec:number;canComplete:boolean;
 session:{id:string;revealOrder:string[];committedAt:string}|null;
 participants:Participant[];teams:{id:string;name:string;memberIds:string[];seed:number}[];bracket:BracketSnapshot|null;
}
export default function DrawControl({administration,onAuthRequired,sessionVersion,onActiveChange,automaticAdvance=false}:{administration:boolean;onAuthRequired():void;sessionVersion:number;onActiveChange?(active:boolean):void;automaticAdvance?:boolean}){
 const {state,error,refresh}=useTournamentState(onAuthRequired,sessionVersion,{automaticAdvance:administration&&automaticAdvance});
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
 async function pairAutomatically(){if(!state||busy)return;setBusy(true);setCommandError('');command.current??={requestId:crypto.randomUUID(),expectedVersion:state.version};
  try{await api('/api/draw/pairs',{method:'POST',body:JSON.stringify({...command.current,mode:'auto'})});command.current=null;refresh();}
  catch(reason){setCommandError(reason instanceof Error?reason.message:'ペアを確定できませんでした。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500)command.current=null;}}
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
 const showOpening=!administration&&!currentReview()&&(!state||!state.session||state.scene==='idle');
 useEffect(()=>onActiveChange?.(!!state?.session||showOpening),[state?.session?.id,showOpening,onActiveChange]);
 useEffect(()=>{if(!administration)preloadPresentationAssets();},[administration]);
 const bedScene=state?.scene==='interval'&&state.flow?.courts?.spotlight?.kind==='winner'?'result':state?.scene;
 const bedTrack=administration||!state?null:resolveVenueBed({review:currentReview(),scene:bedScene,hasSession:!!state.session,photoError});
 usePresentationBed(bedTrack,!administration);
 const onComplete=useCallback(()=>refresh(),[refresh]);
 return <section className={administration?'card draw-operations':'draw-monitor'} data-draw-scene={state?.scene??'loading'} data-draw-version={state?.version??0}>
  {administration&&<><h2>大会運営（確認用）</h2><p>受付終了で参加者を固定し、ペアを確定してから発表・ゲーム開始へ進みます。</p><p>対象 {state?.participants.length??0}名 · 受付{state?.checkinStatus==='closed'?'終了':'中'}</p>
   {state?.checkinStatus==='open'&&<button className="primary" disabled={busy} onClick={()=>{if(closeCommand.current||window.confirm(`${state.participants.length}名で受付を終了しますか？`))void closeReception();}}>{closeCommand.current?'受付終了を再試行':'受付終了'}</button>}
   {state?.checkinStatus==='closed'&&!state.session&&<button className="primary" disabled={busy} onClick={()=>void pairAutomatically()}>自動でペアを確定</button>}
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
   {state?.session&&<div className="actions"><span>保存済みデータで演出だけ再生</span>{([['draw','ペア発表'],['vs','VS'],['winner','WINNER'],['champion','CHAMPION']] as const).map(([scene,label])=><a key={scene} className="button" href={reviewUrl(scene)} target="_blank" rel="noreferrer">{label}</a>)}</div>}
   {state?.flow?.canAdvance&&<button className="primary" disabled={busy||!!operation.current} onClick={()=>void operate('advance')}>次の試合へ進む</button>}
   {operation.current&&!busy&&<button onClick={()=>void operate(operation.current!.path.split('/').at(-1) as 'advance'|'game-start'|'start'|'winner',operation.current!.body.winnerSlot)}>同じ操作を再試行</button>}
   <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">会場Displayを開く</a>
  </>}
  {(error||commandError||presentation?.error||photoError)&&<p role="alert" className="error">{error||commandError||presentation?.error||'保存写真を読み込めません。接続を確認してください。'}<button onClick={()=>{setPhotoError(false);refresh();}}>再読み込み</button></p>}
  {!administration&&(currentReview()&&state?.session&&presentation?.data&&!photoError?currentReview()==='draw'?<div className="live-draw-stage"><DrawStage key={`review-draw-${state.session.id}`} eventId={state.eventId} sceneSeq={state.sceneSeq} data={presentation.data} presentationMode="full" timingPreset={state.timingPreset} audioEnabled startAtSeconds={0} onComplete={reviewDone}/></div>:<div className="tournament-stage"><FlowPresentation key={`review-${currentReview()}`} state={reviewState(state,currentReview() as 'vs'|'winner'|'champion')}/></div>:!state?.session||state.scene==='idle'?<VenueOpening count={state?.participants.length??0} checkinClosed={state?.checkinStatus==='closed'} eventId={state?.eventId} openingVersion={state?.openingVersion} format={state?.format} title={state?.title}/>:state.scene==='draw'&&presentation?.data&&!photoError?<div className="live-draw-stage" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement)setPhotoError(true);}}>
   <DrawStage key={`${state.session.id}-${state.sceneSeq}`} eventId={state.eventId} sceneSeq={state.sceneSeq} data={presentation.data} presentationMode="full" timingPreset={state.timingPreset} audioEnabled startAtSeconds={state.elapsedSeconds} onComplete={onComplete}/>
  </div>:<div className="tournament-stage" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement)setPhotoError(true);}}><FlowPresentation key={state.scene==='interval'?'interval':state.sceneSeq} state={state}/></div>)}
  {administration&&state?.bracket&&<SavedBracket state={state}/>}
  {!administration&&bedTrack&&<PresentationBedUnlock track={bedTrack}/>}

 </section>;
}
