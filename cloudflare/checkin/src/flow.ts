import { Status } from 'brackets-model';
import { createManagerFromSnapshot, exportSnapshot, toStageData, type BracketSnapshot } from '../../../src/features/bracket/manager';
import { applyResult, explainCourtFillWait, getBoardSide, getChapterMatches, getCourtFillMatches, getChampionTeamId, getFinalPlacements, getNextMatch, getSlotTeamUuid, getMatchBracketKind, getMatchRoundLabel, isTwentyDe, reassignCall, selectTwenty, type BoardSide, type FinalPlacements, type TwentyCandidate, type TwentyPhase } from '../../../src/features/progression/progression';
import type { BMMatch } from '../../../src/features/bracket/layout';
import { estimateDrawDurationSec } from '../../../src/features/presentation/drawAnimationTiming';
import { openingTourDurationSec } from '../../../src/features/presentation/openingTourTiming';
import { LOSERS_INTRO_BRACKET_SEC } from '../../../src/features/presentation/losersIntroTiming';
import { calloutForRound } from '../../../src/features/presentation/vsBoard/callout';
import { WINNER_ADVANCE_SEC } from '../../../src/features/presentation/advanceTiming';
import { rehearsalTiming } from '../../../src/lib/rehearsalTiming';
import { eventProfile } from './profile';
import { ClientError, hash, requestId, type CheckinEnv, type Statement } from './domain';

interface Scene {scene:string;version:number;scene_seq:number;scene_started_at:string|null;scene_payload:string}
export type BoardStage='idle'|'call'|'live'|'result';
export interface Board {board:number;matchId:number|null;stage:BoardStage;startedAt:string|null;winnerTeamId?:string|null;loserTeamId?:string|null}
type ResultPresentation={beforeBracket:BracketSnapshot;match:{id:number;teamA:string|null;teamB:string|null;round:number;kind:string;final:boolean};winnerTeamId:string|null};
/** One full-screen beat for a board. Beats queue: each starts when the previous one ends. */
export interface Spotlight {id:string;board:number;kind:'vs'|'winner'|'losers-intro';matchId:number;at:string;durationSec:number;winnerSec?:number;winnerTeamId?:string|null;loserTeamId?:string|null;resultPresentation?:ResultPresentation}
export interface Courts {count:number;boards:Board[];showBracket?:boolean;spotlights?:Spotlight[]}
const spotlightEnd=(s:Spotlight)=>Date.parse(s.at)+s.durationSec*1000;
/** 並んでいる演出は、始まる前からその台の操作を止める。勝者のあとの表も、隣の台が試合中でも最後まで出す。 */
function spotlightBlocks(s:Spotlight,now:number){
 return now<spotlightEnd(s);
}
const boardShowing=(courts:Courts,board:number,now:number)=>(courts.spotlights??[]).some(s=>s.board===board&&spotlightBlocks(s,now));
function enqueueSpotlight(payload:Payload,courts:Courts,item:Omit<Spotlight,'at'>,now:number){
 if(item.durationSec<=0)return;
 const pending=dropFinishedSpotlights(payload,courts,now);
 courts.spotlights=[...pending,{...item,at:new Date(Math.max(now,...pending.map(spotlightEnd))).toISOString()}];
}
type CourtAction='courts-open'|'court-start'|'court-winner'|'court-next'|'court-pick'|'courts-parallel'|'courts-view';
export type FlowAction='advance'|'announce'|'game-start'|'start'|'winner'|CourtAction;
const courtActions:readonly string[]=['courts-open','court-start','court-winner','court-next','court-pick','courts-parallel','courts-view'];
export type CeremonyStep='third'|'second'|'champion'|'podium';
/** Places without a team are skipped; a two-team final has no 3rd place. */
export function ceremonySteps(placements:FinalPlacements):CeremonyStep[]{
 return [...(placements.third.length?['third' as const]:[]),...(placements.second.length?['second' as const]:[]),'champion','podium'];
}
interface Payload {courts?:Courts;twenty?:{phase:TwentyPhase;openedAt:string;endedAt:Record<string,string>};flow?:number;durationSec?:number;participantCount?:number;teamCount?:number;ceremony?:CeremonyStep;placements?:FinalPlacements;matchId?:number;teamA?:string|null;teamB?:string|null;winnerTeamId?:string|null;loserTeamId?:string|null;championTeamId?:string|null;lastMatchId?:number;drawSessionId?:string;resultPresentation?:ResultPresentation;revealedMatchIds?:number[];losersIntroPlayed?:boolean;losersIntroPending?:boolean;losersIntroUntil?:string|null}
function rememberRevealed(payload:Payload,ids:number[]){
 if(!ids.length)return;
 payload.revealedMatchIds=[...new Set([...(payload.revealedMatchIds??[]),...ids])];
}
/** 演出が終わった勝者スポットライトの試合を記録し、キューからは外す。 */
function dropFinishedSpotlights(payload:Payload,courts:Courts,now:number){
 const done=(courts.spotlights??[]).filter(s=>s.kind==='winner'&&spotlightEnd(s)<=now).map(s=>s.matchId);
 rememberRevealed(payload,done);
 return (courts.spotlights??[]).filter(s=>spotlightEnd(s)>now);
}
const twentyClock=(payload:Payload,data:ReturnType<typeof toStageData>,reserved:ReadonlySet<number>,nowMs:number)=>({
 data,storedPhase:payload.twenty?.phase??'A' as TwentyPhase,reservedMatchIds:reserved,
 endedAt:new Map(Object.entries(payload.twenty?.endedAt??{}).map(([id,iso])=>[Number(id),Date.parse(iso)])),
 openedAt:payload.twenty?Date.parse(payload.twenty.openedAt):nowMs,now:nowMs,
});
const activeBoardIds=(courts:Courts)=>new Set(courts.boards.flatMap(b=>(b.stage==='call'||b.stage==='live')&&b.matchId!=null?[b.matchId]:[]));
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
 const takenForPreview=new Set((payload.courts?.boards??[]).flatMap(b=>b.matchId==null?[]:[b.matchId]));
 if(current!=null)takenForPreview.add(current);
 const restingPreview=new Set<string>();
 for(const board of payload.courts?.boards??[]){
  const live=board.matchId==null?null:data.match.find(m=>m.id===board.matchId);
  if(live){
   const a=getSlotTeamUuid(data,live,0),b=getSlotTeamUuid(data,live,1);
   if(a)restingPreview.add(a);if(b)restingPreview.add(b);
  }
 }
 const courtQueue=payload.courts?getCourtFillMatches(data,takenForPreview,restingPreview):null;
 const upcoming=payload.championTeamId?null:(courtQueue?courtQueue.matches[0]:getChapterMatches(data,takenForPreview)[0])??null;
 const nextWaitReason=payload.championTeamId||!payload.courts?null:explainCourtFillWait(data,takenForPreview,restingPreview);
 const single=snapshot.stage[0]?.type==='single_elimination';
 const finalRound=Math.max(...data.round.map(r=>r.number));
 const roundName=(round:number,kind:string)=>!single?kind==='winner'?`ウィナーズ ${round}回戦`:kind==='loser'?`ルーザーズ ${round}回戦`:round===1?'グランドファイナル':'グランドファイナル リセット':round===finalRound?'Final':round===finalRound-1?'Semi Final':round===finalRound-2?'Quarter Final':`Round of ${data.participant.length/2**(round-1)}`;
 const calloutFor=(kind:string,round:number)=>calloutForRound({
  single,kind,round,singleFinalRound:finalRound,
  maxRoundOfKind:Math.max(0,...data.match.filter(m=>getMatchBracketKind(data,m)===kind).map(m=>getMatchRoundLabel(data,m))),
 });
 const describe=(m:typeof data.match[number])=>{const round=getMatchRoundLabel(data,m),kind=getMatchBracketKind(data,m);return {id:m.id,teamA:getSlotTeamUuid(data,m,0),teamB:getSlotTeamUuid(data,m,1),round,roundName:roundName(round,kind),kind,final:isFinalMatch(snapshot,m),callout:calloutFor(kind,round)};};
 const currentMatch=selected?describe(selected):null;
 const boardSide:BoardSide=getBoardSide(data,current);
 const now=Date.now(),court=scene.scene==='interval'?payload.courts:undefined;
 const lit=court?.spotlights?.find(s=>spotlightBlocks(s,now)&&Date.parse(s.at)<=now);
 const litMatch=lit?data.match.find(m=>m.id===lit.matchId):undefined;
 const spotlight=lit&&litMatch?{id:lit.id,kind:lit.kind,board:lit.board,match:describe(litMatch),elapsed:(now-Date.parse(lit.at))/1000,winnerSec:lit.winnerSec??0,winnerTeamId:lit.winnerTeamId??null,loserTeamId:lit.loserTeamId??null,resultPresentation:lit.resultPresentation??null}:null;
 const courts=court?{count:court.count,showBracket:!!court.showBracket,spotlight,boards:court.boards.map(b=>{const m=b.matchId==null?null:data.match.find(x=>x.id===b.matchId);return {...b,showing:boardShowing(court,b.board,now),match:m?describe(m):null};})}:null;
 const updatingBracket=scene.scene==='bracket'&&payload.lastMatchId!=null;
 const profile=await eventProfile(env);
 const losersIntroCap=profile.timingPreset==='instant'?0:LOSERS_INTRO_BRACKET_SEC;
 const losersIntroRemainingSec=scene.scene==='vs_card'&&payload.losersIntroPending
  ?Math.max(0,losersIntroCap-elapsed(scene))
  :0;
 const twentyOn=!!payload.courts&&payload.courts.count===2&&isTwentyDe(data)&&scene.scene==='interval';
 let nextMatch=upcoming?{id:upcoming.id,teamA:getSlotTeamUuid(data,upcoming,0),teamB:getSlotTeamUuid(data,upcoming,1)}:null;
 let waitReason=nextWaitReason;
 let twenty:null|{phase:TwentyPhase;manual:boolean;canSwitch:boolean;promptSwitch:boolean;priorityReason:string|null;choices:{board:number;matches:{id:number;roundName:string;teamA:string;teamB:string;playedA:number;playedB:number;restMinA:number;restMinB:number;priority:boolean}[]}[]}=null;
 if(twentyOn&&payload.courts){
  const reserved=activeBoardIds(payload.courts);
  const selectedView=selectTwenty(twentyClock(payload,data,reserved,now));
  const asRow=(row:TwentyCandidate,priorityId:number|null)=>{
   const info=describe(row.match);
   return {id:row.match.id,roundName:info.roundName,teamA:row.teamA,teamB:row.teamB,playedA:row.playedA,playedB:row.playedB,restMinA:Math.max(0,Math.round(row.restA/60000)),restMinB:Math.max(0,Math.round(row.restB/60000)),priority:row.match.id===priorityId};
  };
  if(payload.championTeamId){nextMatch=null;waitReason='大会終了';}
  else if(selectedView.priority){nextMatch={id:selectedView.priority.match.id,teamA:selectedView.priority.teamA,teamB:selectedView.priority.teamB};waitReason=null;}
  else {nextMatch=null;waitReason=selectedView.wait;}
  twenty={phase:selectedView.phase,manual:selectedView.manual,canSwitch:selectedView.canSwitch,promptSwitch:selectedView.promptSwitch,priorityReason:selectedView.priority?.reason??null,choices:payload.courts.boards.filter(b=>b.stage==='idle'||b.stage==='call').map(b=>{
   const without=new Set(reserved);if(b.matchId!=null)without.delete(b.matchId);
   const mine=selectTwenty(twentyClock(payload,data,without,now));
   return {board:b.board,matches:mine.manual?mine.candidates.map(row=>asRow(row,mine.priority?.match.id??null)).filter(row=>row.id!==b.matchId):[]};
  })};
 }
 const showProgressionDebug=!twentyOn&&(env.ALLOW_INSTANT_TIMING==='1'||profile.timingPreset==='instant');
 const progressionDebug=showProgressionDebug?{
  chapterMatches:getChapterMatches(data,takenForPreview).slice(0,5).map(describe),
  courtFillQueue:(courtQueue?.matches??getCourtFillMatches(data,takenForPreview,restingPreview).matches).slice(0,5).map(describe),
  deferredRest:!!courtQueue?.deferredRest,
 }:null;
 const revealedMatchIds=[...new Set([...(payload.revealedMatchIds??[]),...(court?.spotlights??[]).filter(s=>s.kind==='winner'&&spotlightEnd(s)<=now).map(s=>s.matchId)])];
 return {phase:updatingBracket?'bracket_update':scene.scene,currentMatch,boardSide,losersIntroPlayed:!!payload.losersIntroPlayed,losersIntroPending:!!payload.losersIntroPending,losersIntroRemainingSec,revealedMatchIds,courts,resultPresentation:payload.resultPresentation??null,nextMatch,nextWaitReason:waitReason,twenty,progressionDebug,winnerTeamId:payload.winnerTeamId??null,loserTeamId:payload.loserTeamId??null,championTeamId:payload.championTeamId??null,lastMatchId:payload.lastMatchId??null,
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
 const digest=await hash(JSON.stringify([action,expected,body.winnerSlot??null,...(court?[body.board??null,body.count??null,body.show??null,body.matchId??null]:[])]));
 const previous=await env.DB.prepare('SELECT action,request_hash FROM command_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,commandId).first<{action:string;request_hash:string}>();
 if(previous){if(previous.action!==`flow.${action}`||previous.request_hash!==digest)throw new ClientError('REQUEST_CONFLICT',409);return;}
 const loaded=await load(env),currentScene=loaded.scene;
 if(currentScene.version!==expected)throw new ClientError('VERSION_CONFLICT',409);
 const view=await flowView(env,loaded);
 let snapshot=loaded.snapshot,payload:Payload={...loaded.payload,flow:1},nextScene=currentScene.scene;
 let current=loaded.current,status:string|null=null;
 const timingPreset=(await eventProfile(env)).timingPreset;
 const timing=rehearsalTiming(timingPreset);
 const instant=timingPreset==='instant';
 const losersBracketSec=instant?0:LOSERS_INTRO_BRACKET_SEC;
 const stepDuration=(step:CeremonyStep)=>step==='podium'?timing.podium:step==='champion'?timing.award:timing.winner;
 async function award(champion:string){
  const placements=await getFinalPlacements(createManagerFromSnapshot(snapshot))??{first:champion,second:[],third:[]};
  const step=ceremonySteps(placements)[0];
  payload={...payload,championTeamId:champion,placements,ceremony:step,durationSec:stepDuration(step)};nextScene='award';
 }
 function nextMatch(){
  const data=toStageData(snapshot);
  const resting=new Set<string>();
  if(payload.winnerTeamId)resting.add(payload.winnerTeamId);
  if(payload.loserTeamId)resting.add(payload.loserTeamId);
  const next=getCourtFillMatches(data,new Set(),resting).matches[0]??getChapterMatches(data)[0]??getNextMatch(data);
  if(!next||next.opponent1?.id==null||next.opponent2?.id==null)throw new ClientError('NO_PLAYABLE_MATCH',409);
  current=next.id;
  const losersIntro=getMatchBracketKind(data,next)==='loser'&&!payload.losersIntroPlayed;
  if(losersIntro)payload={...payload,losersIntroPlayed:true,losersIntroPending:true};
  else payload={...payload,losersIntroPending:false};
  payload={...payload,matchId:next.id,teamA:getSlotTeamUuid(data,next,0),teamB:getSlotTeamUuid(data,next,1),durationSec:timing.vsLead+(losersIntro?losersBracketSec:0)};nextScene='vs_card';
}
 if(action==='announce'){
  if(!view?.canAnnounce)throw new ClientError('INVALID_FLOW_PHASE',409);
  const participants=Number(payload.participantCount??0);
  const teams=Number(payload.teamCount??0);
  if(participants>0)payload.durationSec=estimateDrawDurationSec(participants,'full',teams||undefined,timingPreset);
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
  const nowMs=Date.now(),now=new Date(nowMs).toISOString();
  let courts:Courts;
  const restingTeamIds=new Set<string>();
  let assignBoard:number|null=null;
  if(action==='courts-open'){
   if(!view?.canGameStart||current!=null)throw new ClientError('GAME_NOT_READY',409);
   if(body.count!==2&&body.count!==3)throw new ClientError('INVALID_COURTS',400);
   courts={count:body.count,boards:Array.from({length:body.count},(_,index)=>({board:index+1,matchId:null,stage:'idle',startedAt:null}))};
   if(body.count===2&&isTwentyDe(toStageData(snapshot)))payload.twenty={phase:'A',openedAt:now,endedAt:{}};
  }else{
   if(currentScene.scene!=='interval'||!payload.courts)throw new ClientError('INVALID_FLOW_PHASE',409);
   courts=structuredClone(payload.courts);
   if(action==='courts-view'){
    if(typeof body.show!=='boolean')throw new ClientError('INVALID_INPUT',400);
    courts.showBracket=body.show;
   }else if(action==='courts-parallel'){
    if(!payload.twenty||courts.count!==2||!isTwentyDe(toStageData(snapshot)))throw new ClientError('INVALID_FLOW_PHASE',409);
    const gate=selectTwenty(twentyClock(payload,toStageData(snapshot),activeBoardIds(courts),nowMs));
    if(!gate.canSwitch)throw new ClientError('INVALID_FLOW_PHASE',409);
    payload.twenty={...payload.twenty,phase:'C'};
   }else if(action==='court-pick'){
    if(!payload.twenty)throw new ClientError('INVALID_FLOW_PHASE',409);
    const board=courts.boards.find(b=>b.board===body.board);
    if(!board)throw new ClientError('INVALID_BOARD',400);
    if(board.stage!=='idle'&&board.stage!=='call')throw new ClientError('SCENE_NOT_FINISHED',409);
    if(boardShowing(courts,board.board,nowMs))throw new ClientError('SPOTLIGHT_PLAYING',409);
    if(typeof body.matchId!=='number')throw new ClientError('INVALID_INPUT',400);
    const picked=toStageData(snapshot);
    const accepted=reassignCall(twentyClock(payload,picked,activeBoardIds(courts),nowMs),board.matchId,body.matchId);
    if(accepted==null)throw new ClientError('MATCH_NOT_READY',409);
    Object.assign(board,{matchId:accepted,stage:'call',startedAt:now,winnerTeamId:null,loserTeamId:null});
   }else{
    const board=courts.boards.find(b=>b.board===body.board);
    if(!board)throw new ClientError('INVALID_BOARD',400);
    const data=toStageData(snapshot),match=board.matchId==null?null:data.match.find(m=>m.id===board.matchId);
    if(action==='court-start'){
     if(board.stage!=='call'||!match||match.status!==Status.Ready)throw new ClientError('MATCH_NOT_READY',409);
     const manager=createManagerFromSnapshot(snapshot);
     await manager.update.match({id:match.id,status:Status.Running});snapshot=await exportSnapshot(manager);
     Object.assign(board,{stage:'live',startedAt:now});status='running';
     if(getMatchBracketKind(data,match)==='loser'&&!payload.losersIntroPlayed){
      payload={...payload,losersIntroPlayed:true};
      enqueueSpotlight(payload,courts,{id:`${commandId}-losers-intro`,board:0,kind:'losers-intro',matchId:match.id,durationSec:losersBracketSec},nowMs);
     }
     enqueueSpotlight(payload,courts,{id:commandId,board:board.board,kind:'vs',matchId:match.id,durationSec:timing.vsLead+timing.vsHold},nowMs);
    }else if(action==='court-winner'){
     if(board.stage!=='live'||!match||match.status!==Status.Running)throw new ClientError('MATCH_NOT_LIVE',409);
     if(boardShowing(courts,board.board,nowMs))throw new ClientError('SPOTLIGHT_PLAYING',409);
     const beforeBracket=structuredClone(snapshot),shown=view?.courts?.boards.find(b=>b.board===board.board)?.match;
     if(!shown)throw new ClientError('MATCH_NOT_LIVE',409);
     const manager=createManagerFromSnapshot(snapshot),slot=body.winnerSlot as 0|1;
     await applyResult(manager,data,match.id,slot,match.id);snapshot=await exportSnapshot(manager);
     const winnerTeamId=getSlotTeamUuid(data,match,slot),loserTeamId=getSlotTeamUuid(data,match,slot===0?1:0);
     Object.assign(board,{stage:'result',startedAt:now,winnerTeamId,loserTeamId});status='running';
     if(payload.twenty){
      payload.twenty={...payload.twenty,endedAt:{...payload.twenty.endedAt,[String(match.id)]:now}};
      const champion=await getChampionTeamId(manager);
      if(champion)payload.championTeamId=champion;
     }
     const advanceSec=timing.bracket>0?WINNER_ADVANCE_SEC:0;
     enqueueSpotlight(payload,courts,{id:commandId,board:board.board,kind:'winner',matchId:match.id,durationSec:timing.winner+advanceSec,winnerSec:timing.winner,winnerTeamId,loserTeamId,resultPresentation:{beforeBracket,match:shown,winnerTeamId}},nowMs);
     // instant: Display に「両台WINNERで止まる」時間を作らない（court-next を同一トランザクションで済ませる）
     if(instant){
      if(board.winnerTeamId)restingTeamIds.add(board.winnerTeamId);
      if(board.loserTeamId)restingTeamIds.add(board.loserTeamId);
      Object.assign(board,{matchId:null,stage:'idle',startedAt:null,winnerTeamId:null,loserTeamId:null});
      if(payload.twenty)assignBoard=board.board;
     }
    }else{
     if(board.stage!=='result'&&board.stage!=='idle')throw new ClientError('SCENE_NOT_FINISHED',409);
     if(boardShowing(courts,board.board,nowMs))throw new ClientError('SPOTLIGHT_PLAYING',409);
     if(payload.championTeamId&&((courts.spotlights??[]).some(s=>spotlightBlocks(s,nowMs))||courts.boards.some(b=>b.stage==='call'||b.stage==='live')))throw new ClientError('SCENE_NOT_FINISHED',409);
     if(board.winnerTeamId)restingTeamIds.add(board.winnerTeamId);
     if(board.loserTeamId)restingTeamIds.add(board.loserTeamId);
     Object.assign(board,{matchId:null,stage:'idle',startedAt:null,winnerTeamId:null,loserTeamId:null});
     if(payload.twenty)assignBoard=board.board;
    }
   }
  }
  const data=toStageData(snapshot),taken=new Set(courts.boards.flatMap(b=>b.matchId==null?[]:[b.matchId]));
  const twentyOn=!!payload.twenty&&courts.count===2&&isTwentyDe(data);
  if(twentyOn){
   if(assignBoard!=null&&!payload.championTeamId){
    const board=courts.boards.find(b=>b.board===assignBoard);
    if(board&&board.matchId==null){
     const pick=selectTwenty(twentyClock(payload,data,activeBoardIds(courts),nowMs));
     const next=pick.priority?.match??null;
     if(next)Object.assign(board,{matchId:next.id,stage:'call',startedAt:now});
     else if(action==='court-next')throw new ClientError('NO_PLAYABLE_MATCH',409);
    }
   }
   const progressed=selectTwenty(twentyClock(payload,data,activeBoardIds(courts),nowMs));
   if(payload.twenty&&payload.twenty.phase!=='C')payload.twenty={...payload.twenty,phase:progressed.phase};
   courts.spotlights=dropFinishedSpotlights(payload,courts,nowMs);
   const celebration=(courts.spotlights??[]).some(s=>spotlightBlocks(s,nowMs));
   const playing=courts.boards.some(b=>b.stage==='call'||b.stage==='live');
   // 順位発表は運営による明示的な操作で開始する。
   if(action==='court-next'&&payload.championTeamId&&!playing&&!celebration){delete payload.courts;await award(payload.championTeamId);}
   else {payload={...payload,courts,durationSec:0};nextScene='interval';}
  }else{
  for(const board of courts.boards){
   const live=board.matchId==null?null:data.match.find(m=>m.id===board.matchId);
   if(live){
    const a=getSlotTeamUuid(data,live,0),b=getSlotTeamUuid(data,live,1);
    if(a)restingTeamIds.add(a);if(b)restingTeamIds.add(b);
   }
   if(board.winnerTeamId)restingTeamIds.add(board.winnerTeamId);
   if(board.loserTeamId)restingTeamIds.add(board.loserTeamId);
  }
  const fill=getCourtFillMatches(data,taken,restingTeamIds);
  const waiting=fill.matches.filter(m=>!isFinalMatch(snapshot,m));
  for(const b of courts.boards)if(b.matchId==null){const m=waiting.shift();if(m)Object.assign(b,{matchId:m.id,stage:'call',startedAt:now});}
  courts.spotlights=dropFinishedSpotlights(payload,courts,nowMs);
  if(courts.boards.some(b=>b.matchId!=null)){payload={...payload,courts,durationSec:0};nextScene='interval';}
  else if(action==='courts-open')throw new ClientError('NO_PLAYABLE_MATCH',409);
  else{payload={...payload,durationSec:timing.bracket};delete payload.courts;delete payload.lastMatchId;nextScene='bracket';}
  }
}else{
  if(!view?.canAdvance)throw new ClientError('SCENE_NOT_FINISHED',409);
  if(currentScene.scene==='draw'){nextScene='bracket';payload.durationSec=timing.bracketInitial+(instant?0:openingTourDurationSec(toStageData(snapshot)));}
  else if(currentScene.scene==='result'){
   const champion=payload.championTeamId??await getChampionTeamId(createManagerFromSnapshot(snapshot));
   if(champion)await award(champion);
   else {nextScene='bracket';payload.durationSec=timing.bracket>0?WINNER_ADVANCE_SEC:timing.bracket;}
  }else if(currentScene.scene==='bracket'&&view.phase==='bracket_update'){
   if(payload.lastMatchId!=null)rememberRevealed(payload,[payload.lastMatchId]);
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
