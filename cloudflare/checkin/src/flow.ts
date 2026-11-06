import { Status } from 'brackets-model';
import { createManagerFromSnapshot, exportSnapshot, toStageData, type BracketSnapshot } from '../../../src/features/bracket/manager';
import { applyResult, getBottomTierMatches, getChampionTeamId, getFinalPlacements, getNextMatch, getSlotTeamUuid, getMatchBracketKind, getMatchRoundLabel, type FinalPlacements } from '../../../src/features/progression/progression';
import type { BMMatch } from '../../../src/features/bracket/layout';
import { rehearsalTiming } from '../../../src/lib/rehearsalTiming';
import { eventProfile } from './profile';
import { ClientError, hash, requestId, type CheckinEnv, type Statement } from './domain';

interface Scene {scene:string;version:number;scene_seq:number;scene_started_at:string|null;scene_payload:string}
export type BoardStage='idle'|'call'|'live'|'result';
export interface Board {board:number;matchId:number|null;stage:BoardStage;startedAt:string|null;winnerTeamId?:string|null;loserTeamId?:string|null}
export interface Courts {count:number;boards:Board[];showBracket?:boolean}
type CourtAction='courts-open'|'court-start'|'court-winner'|'court-next'|'courts-view';
export type FlowAction='advance'|'announce'|'game-start'|'start'|'winner'|CourtAction;
const courtActions:readonly string[]=['courts-open','court-start','court-winner','court-next','courts-view'];
export type CeremonyStep='third'|'second'|'champion'|'podium';
/** Places without a team are skipped; a two-team final has no 3rd place. */
export function ceremonySteps(placements:FinalPlacements):CeremonyStep[]{
 return [...(placements.third.length?['third' as const]:[]),...(placements.second.length?['second' as const]:[]),'champion','podium'];
}
interface Payload {courts?:Courts;flow?:number;durationSec?:number;ceremony?:CeremonyStep;placements?:FinalPlacements;matchId?:number;teamA?:string|null;teamB?:string|null;winnerTeamId?:string|null;loserTeamId?:string|null;championTeamId?:string|null;lastMatchId?:number;drawSessionId?:string;resultPresentation?:{beforeBracket:BracketSnapshot;match:{id:number;teamA:string|null;teamB:string|null;round:number;kind:string;final:boolean};winnerTeamId:string|null}}
async function load(env:CheckinEnv){
 const row=await env.DB.prepare("SELECT s.*,e.bracket_snapshot,e.bm_current_match_id FROM event_state s JOIN events e ON e.id=s.event_id WHERE s.event_id=? AND e.environment='rehearsal'").bind(env.CHECKIN_EVENT_ID).first<Scene&{bracket_snapshot:string|null;bm_current_match_id:number|null}>();
 if(!row?.bracket_snapshot)throw new ClientError('DRAW_REQUIRED',409);
 return {scene:row,snapshot:JSON.parse(row.bracket_snapshot) as BracketSnapshot,payload:JSON.parse(row.scene_payload) as Payload,current:row.bm_current_match_id};
}
/** 決勝は台に分けず、全画面の1試合進行へ戻す */
function isFinalMatch(snapshot:BracketSnapshot,m:BMMatch){
 const data=toStageData(snapshot),kind=getMatchBracketKind(data,m);
 if(kind==='grand_final'||data.participant.length===2)return true;
 return snapshot.stage[0]?.type==='single_elimination'&&getMatchRoundLabel(data,m)===Math.max(...data.round.map(r=>r.number));
}
function elapsed(scene:Scene){return scene.scene_started_at?Math.max(0,(Date.now()-Date.parse(scene.scene_started_at))/1000):0;}
export async function flowView(env:CheckinEnv,projection?:Awaited<ReturnType<typeof load>>){
 let value=projection;
 if(!value){try{value=await load(env);}catch(error){if(error instanceof ClientError&&error.code==='DRAW_REQUIRED')return null;throw error;}}
 const {scene,snapshot,payload,current}=value,data=toStageData(snapshot);
 const selected=current==null?null:data.match.find(m=>m.id===current);
 const upcoming=payload.championTeamId?null:getNextMatch({...data,match:data.match.filter(m=>m.id!==current)});
 const single=snapshot.stage[0]?.type==='single_elimination';
 const finalRound=Math.max(...data.round.map(r=>r.number));
 const roundName=(round:number,kind:string)=>!single?kind==='winner'?`ウィナーズ ${round}回戦`:kind==='loser'?`ルーザーズ ${round}回戦`:round===1?'グランドファイナル':'グランドファイナル リセット':round===finalRound?'Final':round===finalRound-1?'Semi Final':round===finalRound-2?'Quarter Final':`Round of ${data.participant.length/2**(round-1)}`;
 const describe=(m:typeof data.match[number])=>{const round=getMatchRoundLabel(data,m),kind=getMatchBracketKind(data,m);return {id:m.id,teamA:getSlotTeamUuid(data,m,0),teamB:getSlotTeamUuid(data,m,1),round,roundName:roundName(round,kind),kind,final:isFinalMatch(snapshot,m)};};
 const currentMatch=selected?describe(selected):null;
 const courts=scene.scene==='interval'&&payload.courts?{count:payload.courts.count,showBracket:!!payload.courts.showBracket,boards:payload.courts.boards.map(b=>{const m=b.matchId==null?null:data.match.find(x=>x.id===b.matchId);return {...b,match:m?describe(m):null};})}:null;
 const updatingBracket=scene.scene==='bracket'&&payload.lastMatchId!=null;
 return {phase:updatingBracket?'bracket_update':scene.scene,currentMatch,courts,resultPresentation:payload.resultPresentation??null,nextMatch:upcoming?{id:upcoming.id,teamA:getSlotTeamUuid(data,upcoming,0),teamB:getSlotTeamUuid(data,upcoming,1)}:null,winnerTeamId:payload.winnerTeamId??null,loserTeamId:payload.loserTeamId??null,championTeamId:payload.championTeamId??null,lastMatchId:payload.lastMatchId??null,
  ceremony:scene.scene==='award'?payload.ceremony??'champion':null,placements:payload.placements??(payload.championTeamId?{first:payload.championTeamId,second:[],third:[]}:null),
  canStart:scene.scene==='vs_card'&&elapsed(scene)>=(payload.durationSec??0)&&!!currentMatch?.teamA&&!!currentMatch?.teamB,
  canGameStart:scene.scene==='bracket'&&!updatingBracket&&elapsed(scene)>=(payload.durationSec??2),
  canAnnounce:scene.scene==='idle',
  canScore:scene.scene==='match_live',canAdvance:(['draw','result','award'].includes(scene.scene)||updatingBracket)&&elapsed(scene)>=(payload.durationSec??Infinity),completedMatches:data.match.filter(m=>m.status>=Status.Completed).length};
}
export function matchProjection(env:CheckinEnv,snapshot:BracketSnapshot,authorized:string,commandId:string):Statement[]{
 const data=toStageData(snapshot);
 return data.match.map(m=>{
  const a=getSlotTeamUuid(data,m,0),b=getSlotTeamUuid(data,m,1);
  const winner=m.opponent1?.result==='win'?a:m.opponent2?.result==='win'?b:null;
  const loser=winner==null?null:winner===a?b:a;
  const kind=getMatchBracketKind(data,m),bracket=kind==='winner'?'winners':kind==='loser'?'losers':'grand_final';
  const status=m.status>=Status.Completed?'done':m.status===Status.Running?'in_progress':m.status===Status.Ready?'ready':'pending';
  return env.DB.prepare(`INSERT INTO matches(id,event_id,bracket,round,match_no,sequence,team_a_id,team_b_id,winner_team_id,loser_team_id,status,layout,finished_at)
   SELECT ?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?='done' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END WHERE ${authorized}
   ON CONFLICT(id) DO UPDATE SET team_a_id=excluded.team_a_id,team_b_id=excluded.team_b_id,winner_team_id=excluded.winner_team_id,loser_team_id=excluded.loser_team_id,status=excluded.status,finished_at=COALESCE(matches.finished_at,excluded.finished_at),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
   .bind(`${env.CHECKIN_EVENT_ID}-bm-${m.id}`,env.CHECKIN_EVENT_ID,bracket,getMatchRoundLabel(data,m),m.number,m.id,a,b,winner,loser,status,JSON.stringify({bmMatchId:m.id}),status,env.CHECKIN_EVENT_ID,commandId);
 });
}
export async function flowCommand(env:CheckinEnv,action:FlowAction,body:Record<string,unknown>){
 const commandId=requestId(body.requestId),expected=body.expectedVersion;
 if(!Number.isSafeInteger(expected)||Number(expected)<0)throw new ClientError('INVALID_VERSION',400);
 if((action==='winner'||action==='court-winner')&&body.winnerSlot!==0&&body.winnerSlot!==1)throw new ClientError('INVALID_WINNER',400);
 const court=courtActions.includes(action);
 const digest=await hash(JSON.stringify([action,expected,body.winnerSlot??null,...(court?[body.board??null,body.count??null,body.show??null]:[])]));
 const previous=await env.DB.prepare('SELECT action,request_hash FROM command_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,commandId).first<{action:string;request_hash:string}>();
 if(previous){if(previous.action!==`flow.${action}`||previous.request_hash!==digest)throw new ClientError('REQUEST_CONFLICT',409);return;}
 const loaded=await load(env),currentScene=loaded.scene;
 if(currentScene.version!==expected)throw new ClientError('VERSION_CONFLICT',409);
 const view=await flowView(env,loaded);
 let snapshot=loaded.snapshot,payload:Payload={...loaded.payload,flow:1},nextScene=currentScene.scene;
 let current=loaded.current,status:string|null=null;
 const timing=rehearsalTiming((await eventProfile(env)).timingPreset);
 const stepDuration=(step:CeremonyStep)=>step==='champion'?timing.award:timing.winner;
 async function award(champion:string){
  const placements=await getFinalPlacements(createManagerFromSnapshot(snapshot))??{first:champion,second:[],third:[]};
  const step=ceremonySteps(placements)[0];
  payload={...payload,championTeamId:champion,placements,ceremony:step,durationSec:stepDuration(step)};nextScene='award';
 }
 function nextMatch(){const data=toStageData(snapshot),next=getNextMatch(data);if(!next||next.opponent1?.id==null||next.opponent2?.id==null)throw new ClientError('NO_PLAYABLE_MATCH',409);current=next.id;payload={...payload,matchId:next.id,teamA:getSlotTeamUuid(data,next,0),teamB:getSlotTeamUuid(data,next,1),durationSec:timing.vsLead};nextScene='vs_card';}
 if(action==='announce'){
  if(!view?.canAnnounce)throw new ClientError('INVALID_FLOW_PHASE',409);
  nextScene='draw';
 }else if(action==='game-start'){
  if(!view?.canGameStart||current!=null)throw new ClientError('GAME_NOT_READY',409);
  nextMatch();
 }else if(action==='start'){
  if(!view?.canStart)throw new ClientError('MATCH_NOT_READY',409);
  const manager=createManagerFromSnapshot(snapshot);
  await manager.update.match({id:current!,status:Status.Running});snapshot=await exportSnapshot(manager);
  nextScene='match_live';payload.durationSec=0;status='running';
 }else if(action==='winner'){
  if(!view?.canScore||current==null)throw new ClientError('MATCH_NOT_LIVE',409);
  const data=toStageData(snapshot),match=data.match.find(m=>m.id===current);
  if(!match||match.status!==Status.Running)throw new ClientError('MATCH_NOT_LIVE',409);
  const beforeBracket=structuredClone(snapshot);
  const manager=createManagerFromSnapshot(snapshot),slot=body.winnerSlot as 0|1;
  await applyResult(manager,data,current,slot,current);snapshot=await exportSnapshot(manager);
  payload={...payload,lastMatchId:current,winnerTeamId:getSlotTeamUuid(data,match,slot),loserTeamId:getSlotTeamUuid(data,match,slot===0?1:0),championTeamId:await getChampionTeamId(manager),durationSec:timing.winner,resultPresentation:{beforeBracket,match:view!.currentMatch!,winnerTeamId:getSlotTeamUuid(data,match,slot)}};
  nextScene='result';status='running';current=null;
 }else if(court){
  const now=new Date().toISOString();
  let courts:Courts;
  if(action==='courts-open'){
   if(!view?.canGameStart||current!=null)throw new ClientError('GAME_NOT_READY',409);
   if(body.count!==2&&body.count!==3)throw new ClientError('INVALID_COURTS',400);
   courts={count:body.count,boards:Array.from({length:body.count},(_,index)=>({board:index+1,matchId:null,stage:'idle',startedAt:null}))};
  }else{
   if(currentScene.scene!=='interval'||!payload.courts)throw new ClientError('INVALID_FLOW_PHASE',409);
   courts=structuredClone(payload.courts);
   if(action==='courts-view'){
    if(typeof body.show!=='boolean')throw new ClientError('INVALID_INPUT',400);
    courts.showBracket=body.show;
   }else{
    const board=courts.boards.find(b=>b.board===body.board);
    if(!board)throw new ClientError('INVALID_BOARD',400);
    const data=toStageData(snapshot),match=board.matchId==null?null:data.match.find(m=>m.id===board.matchId);
    if(action==='court-start'){
     if(board.stage!=='call'||!match||match.status!==Status.Ready)throw new ClientError('MATCH_NOT_READY',409);
     const manager=createManagerFromSnapshot(snapshot);
     await manager.update.match({id:match.id,status:Status.Running});snapshot=await exportSnapshot(manager);
     Object.assign(board,{stage:'live',startedAt:now});status='running';
    }else if(action==='court-winner'){
     if(board.stage!=='live'||!match||match.status!==Status.Running)throw new ClientError('MATCH_NOT_LIVE',409);
     const manager=createManagerFromSnapshot(snapshot),slot=body.winnerSlot as 0|1;
     await applyResult(manager,data,match.id,slot,match.id);snapshot=await exportSnapshot(manager);
     Object.assign(board,{stage:'result',startedAt:now,winnerTeamId:getSlotTeamUuid(data,match,slot),loserTeamId:getSlotTeamUuid(data,match,slot===0?1:0)});status='running';
    }else{
     if(board.stage!=='result'&&board.stage!=='idle')throw new ClientError('SCENE_NOT_FINISHED',409);
     Object.assign(board,{matchId:null,stage:'idle',startedAt:null,winnerTeamId:null,loserTeamId:null});
    }
   }
  }
  const data=toStageData(snapshot),taken=new Set(courts.boards.flatMap(b=>b.matchId==null?[]:[b.matchId]));
  const waiting=getBottomTierMatches(data,taken).filter(m=>!isFinalMatch(snapshot,m));
  for(const b of courts.boards)if(b.matchId==null){const m=waiting.shift();if(m)Object.assign(b,{matchId:m.id,stage:'call',startedAt:now});}
  if(courts.boards.some(b=>b.matchId!=null)){payload={...payload,courts,durationSec:0};nextScene='interval';}
  else if(action==='courts-open')throw new ClientError('NO_PLAYABLE_MATCH',409);
  else{payload={...payload,durationSec:timing.bracket};delete payload.courts;delete payload.lastMatchId;nextScene='bracket';}
 }else{
  if(!view?.canAdvance)throw new ClientError('SCENE_NOT_FINISHED',409);
  if(currentScene.scene==='draw'){nextScene='bracket';payload.durationSec=timing.bracketInitial;}
  else if(currentScene.scene==='result'){
   const champion=payload.championTeamId??await getChampionTeamId(createManagerFromSnapshot(snapshot));
   if(champion)await award(champion);
   else {nextScene='bracket';payload.durationSec=timing.bracket;}
  }else if(currentScene.scene==='bracket'&&view.phase==='bracket_update'){
   const champion=await getChampionTeamId(createManagerFromSnapshot(snapshot));
   if(champion)await award(champion);else nextMatch();
  }else if(currentScene.scene==='award'){
   const placements=payload.placements??await getFinalPlacements(createManagerFromSnapshot(snapshot));
   const steps=placements?ceremonySteps(placements):['champion' as const,'podium' as const];
   const following=steps[steps.indexOf(payload.ceremony??'champion')+1];
   if(following){payload={...payload,...(placements?{placements}:{}),ceremony:following,durationSec:stepDuration(following)};}
   else{nextScene='finished';payload.durationSec=0;status='finished';}
  }
  else throw new ClientError('INVALID_FLOW_PHASE',409);
 }
 const nonce=crypto.randomUUID();
 const authorized=`EXISTS(SELECT 1 FROM command_receipts WHERE event_id=? AND request_id=? AND json_extract(response_json,'$.attempt')='${nonce}')`;
 const statements:Statement[]=[env.DB.prepare(`INSERT INTO command_receipts(event_id,request_id,actor_id,action,request_hash,expected_version,committed_version,response_json)
  SELECT ?,?,'checkin-session',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM event_state WHERE event_id=? AND version=? AND scene=?)`)
  .bind(env.CHECKIN_EVENT_ID,commandId,`flow.${action}`,digest,expected,Number(expected)+1,JSON.stringify({attempt:nonce,phase:nextScene}),env.CHECKIN_EVENT_ID,expected,currentScene.scene),...matchProjection(env,snapshot,authorized,commandId)];
 statements.push(env.DB.prepare(`UPDATE events SET bracket_snapshot=?,bm_current_match_id=?,status=COALESCE(?,status),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND ${authorized}`).bind(JSON.stringify(snapshot),current,status,env.CHECKIN_EVENT_ID,env.CHECKIN_EVENT_ID,commandId),
  env.DB.prepare(`UPDATE event_state SET scene=?,scene_payload=?,version=version+1,scene_seq=scene_seq+1,scene_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),awaiting_operator=?,current_match_id=?,playback=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE event_id=? AND version=? AND ${authorized}`)
  .bind(nextScene,JSON.stringify(payload),(nextScene==='bracket'&&payload.lastMatchId==null)||['vs_card','match_live','interval'].includes(nextScene)?1:0,current==null?null:`${env.CHECKIN_EVENT_ID}-bm-${current}`,((nextScene==='bracket'&&payload.lastMatchId==null)||['vs_card','match_live','interval','finished'].includes(nextScene))?'holding':'playing',env.CHECKIN_EVENT_ID,expected,env.CHECKIN_EVENT_ID,commandId),
  env.DB.prepare(`INSERT INTO operation_log(event_id,actor_id,request_id,version,action,target_table,target_id,before_data,after_data)
   SELECT ?,'checkin-session',?,?,?,'event_state',?,?,? WHERE ${authorized}`)
   .bind(env.CHECKIN_EVENT_ID,commandId,Number(expected)+1,`flow.${action}`,env.CHECKIN_EVENT_ID,JSON.stringify({scene:currentScene.scene,currentMatch:loaded.current,payload:loaded.payload}),JSON.stringify({scene:nextScene,currentMatch:current,payload}),env.CHECKIN_EVENT_ID,commandId));
 try{await env.DB.batch(statements);}catch(error){const receipt=await env.DB.prepare('SELECT request_hash FROM command_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,commandId).first<{request_hash:string}>().catch(()=>null);if(receipt?.request_hash!==digest)throw error;}
 const committed=await env.DB.prepare('SELECT request_hash FROM command_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,commandId).first<{request_hash:string}>();
 if(committed?.request_hash!==digest)throw new ClientError('VERSION_CONFLICT',409);
}
