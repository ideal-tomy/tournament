import { flowCommand, flowView, matchProjection } from './flow';
import { makeBalancedTeams, buildRevealOrder, teamRatingSum } from '../../../src/features/draw/draw';
import { buildDoubleElimination, buildSingleElimination } from '../../../src/features/bracket/manager';
import { estimateDrawDurationSec } from '../../../src/features/presentation/drawAnimationTiming';
import { ClientError, hash, participantDto, readBody, requestId, response, type CheckinEnv } from './domain';
import { readiness, rows, state } from './lifecycle';
import { eventProfile } from './profile';

interface SceneState {event_id:string;scene:string;version:number;scene_seq:number;scene_started_at:string|null;scene_payload:string;presentation_mode:string}
interface Session {id:string;reveal_order:string;committed_at:string}
async function initialize(env:CheckinEnv){
  if(await env.DB.prepare('SELECT event_id FROM event_state WHERE event_id=?').bind(env.CHECKIN_EVENT_ID).first())return;
  await state(env);
  await env.DB.prepare('INSERT OR IGNORE INTO event_state(event_id) VALUES(?)').bind(env.CHECKIN_EVENT_ID).run();
}
async function scene(env:CheckinEnv){return (await env.DB.prepare('SELECT * FROM event_state WHERE event_id=?').bind(env.CHECKIN_EVENT_ID).first<SceneState>())!;}
async function session(env:CheckinEnv){return env.DB.prepare('SELECT id,reveal_order,committed_at FROM draw_sessions WHERE event_id=? AND committed_at IS NOT NULL ORDER BY committed_at DESC LIMIT 1').bind(env.CHECKIN_EVENT_ID).first<Session>();}
async function read(env:CheckinEnv){
  await initialize(env);
  const current=(await env.DB.prepare('SELECT s.*,e.bracket_snapshot,e.bm_current_match_id FROM event_state s JOIN events e ON e.id=s.event_id WHERE s.event_id=?').bind(env.CHECKIN_EVENT_ID).first<SceneState&{bracket_snapshot:string|null;bm_current_match_id:number|null}>())!,draw=await session(env),checkin=await state(env);
  const teamRows=await env.DB.prepare('SELECT id,name,seed,rating_total,manager_participant_id FROM teams WHERE event_id=? AND draw_session_id=? ORDER BY seed').bind(env.CHECKIN_EVENT_ID,draw?.id??'').all<{id:string;name:string;seed:number;rating_total:number;manager_participant_id:number}>();
  const memberships=await env.DB.prepare('SELECT m.team_id,m.participant_id,m.position FROM team_members m JOIN teams t ON t.id=m.team_id WHERE t.event_id=? AND t.draw_session_id=? ORDER BY t.seed,m.position').bind(env.CHECKIN_EVENT_ID,draw?.id??'').all<{team_id:string;participant_id:string;position:number}>();
  const participants=(await rows(env)).map(p=>participantDto(p,env.CHECKIN_EVENT_ID));
  const payload=JSON.parse(current.scene_payload) as {durationSec?:number;drawSessionId?:string};
  const profile=await eventProfile(env);
  const elapsed=current.scene_started_at?Math.max(0,(Date.now()-Date.parse(current.scene_started_at))/1000):0;
  return {...profile,flow:draw&&current.bracket_snapshot?await flowView(env,{scene:current,snapshot:JSON.parse(current.bracket_snapshot),payload,current:current.bm_current_match_id}):null,eventId:env.CHECKIN_EVENT_ID,title:checkin.title,checkinStatus:checkin.status,checkinRevision:checkin.revision,scene:current.scene,version:current.version,sceneSeq:current.scene_seq,startedAt:current.scene_started_at,elapsedSeconds:elapsed,durationSec:payload.durationSec??0,canComplete:current.scene==='draw'&&elapsed>=(payload.durationSec??Infinity),session:draw?{id:draw.id,revealOrder:JSON.parse(draw.reveal_order) as string[],committedAt:draw.committed_at}:null,participants,teams:teamRows.results.map(t=>({...t,memberIds:memberships.results.filter(m=>m.team_id===t.id).map(m=>m.participant_id)})),bracket:current.bracket_snapshot?JSON.parse(current.bracket_snapshot):null};
}
export const readDrawState=read;
async function prepare(env:CheckinEnv,body:Record<string,unknown>){
  const id=requestId(body.requestId),expected=body.expectedVersion;
  if(!Number.isSafeInteger(expected)||Number(expected)<0)throw new ClientError('INVALID_VERSION',400);
  await initialize(env);
  const requestHash=await hash(JSON.stringify(['draw.prepare',expected]));
  const receipt=await env.DB.prepare('SELECT action,request_hash FROM command_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,id).first<{action:string;request_hash:string}>();
  if(receipt&&(receipt.action!=='draw.prepare'||receipt.request_hash!==requestHash))throw new ClientError('REQUEST_CONFLICT',409);
  if(await session(env))return response({...await read(env),replayed:true});
  const checkin=await state(env),current=await scene(env);
  if(checkin.status!=='closed')throw new ClientError('CHECKIN_NOT_CLOSED',409);
  if(current.version!==expected)throw new ClientError('VERSION_CONFLICT',409);
  const report=await readiness(env);
  if(!report.ready)throw new ClientError('CHECKIN_NOT_READY',409,report);
  if(checkin.team_size!==2||report.count<4||report.count%2!==0)throw new ClientError('EVEN_PARTICIPANTS_REQUIRED',409);
  const roster=JSON.parse(checkin.closed_roster) as {id:string;version:number}[];
  if(roster.length!==report.count||report.participants.some(p=>!roster.some(r=>r.id===p.id&&r.version===p.version)))throw new ClientError('ROSTER_CHANGED',409);
  const participantById=new Map(report.participants.map(p=>[p.id,p]));
  // Same existing rating-balanced algorithm used by the Supabase tournament logic.
  const rated=report.participants.map(p=>({id:p.id,rating:p.rating??0}));
  const pairs=makeBalancedTeams(rated,'trio');
  const revealOrder=buildRevealOrder(pairs),sessionId=crypto.randomUUID();
  const teamIds=pairs.map(()=>crypto.randomUUID());
  const profile=await eventProfile(env);
  const snapshot=await (profile.format==='single_elimination'?buildSingleElimination:buildDoubleElimination)(teamIds);
  const durationSec=estimateDrawDurationSec(report.count,'full',pairs.length,profile.timingPreset);
  const payload=JSON.stringify({drawSessionId:sessionId,participantCount:report.count,teamCount:pairs.length,durationSec});
  // One atomic batch wins. Every write is gated by the receipt inserted in this batch.
  // Concurrent retries cannot clear/recreate teams or commit a different draw.
  const authorized=`EXISTS(SELECT 1 FROM command_receipts WHERE event_id=? AND request_id=? AND json_extract(response_json,'$.sessionId')='${sessionId}')`;
  const statements=[env.DB.prepare(`INSERT INTO command_receipts(event_id,request_id,actor_id,action,request_hash,expected_version,committed_version,response_json)
    SELECT ?,?,'checkin-session','draw.prepare',?,?,?,json_object('sessionId','${sessionId}') WHERE EXISTS(SELECT 1 FROM event_state WHERE event_id=? AND version=? AND scene='idle')
    AND EXISTS(SELECT 1 FROM checkin_state WHERE event_id=? AND status='closed' AND revision=?)
    AND EXISTS(SELECT 1 FROM events WHERE id=? AND environment='rehearsal' AND status IN ('draft','entry') AND bracket_snapshot IS NULL)
    AND NOT EXISTS(SELECT 1 FROM draw_sessions WHERE event_id=? AND committed_at IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM teams WHERE event_id=?)`).bind(env.CHECKIN_EVENT_ID,id,requestHash,expected,Number(expected)+1,env.CHECKIN_EVENT_ID,expected,env.CHECKIN_EVENT_ID,checkin.revision,env.CHECKIN_EVENT_ID,env.CHECKIN_EVENT_ID,env.CHECKIN_EVENT_ID),
    env.DB.prepare(`INSERT INTO draw_sessions(id,event_id,mode,reveal_order,committed_at) SELECT ?,?,'rating_balanced',?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE ${authorized}`).bind(sessionId,env.CHECKIN_EVENT_ID,JSON.stringify(revealOrder),env.CHECKIN_EVENT_ID,id)];
  // Two JSON-backed INSERTs keep 16 teams within D1's per-invocation query budget.
  const ratingById=new Map(rated.map(p=>[p.id,p.rating]));
  const teamRecords=pairs.map((pair,index)=>({id:teamIds[index],eventId:env.CHECKIN_EVENT_ID,sessionId,
    name:pair.map(pid=>participantById.get(pid)!.name).join(' & '),seed:index,rating:teamRatingSum(pair,ratingById),
    managerId:snapshot.participant.find(p=>p.name===teamIds[index])?.id??null}));
  const memberRecords=pairs.flatMap((pair,index)=>pair.map((pid,position)=>({teamId:teamIds[index],participantId:pid,position:position+1})));
  statements.push(env.DB.prepare(`INSERT INTO teams(id,event_id,draw_session_id,name,seed,rating_total,manager_participant_id)
    SELECT json_extract(value,'$.id'),json_extract(value,'$.eventId'),json_extract(value,'$.sessionId'),json_extract(value,'$.name'),json_extract(value,'$.seed'),json_extract(value,'$.rating'),json_extract(value,'$.managerId') FROM json_each(?) WHERE ${authorized}`)
    .bind(JSON.stringify(teamRecords),env.CHECKIN_EVENT_ID,id));
  statements.push(env.DB.prepare(`INSERT INTO team_members(team_id,participant_id,position)
    SELECT json_extract(value,'$.teamId'),json_extract(value,'$.participantId'),json_extract(value,'$.position') FROM json_each(?) WHERE ${authorized}`)
    .bind(JSON.stringify(memberRecords),env.CHECKIN_EVENT_ID,id));
  statements.push(...matchProjection(env,snapshot,authorized,id));
  statements.push(env.DB.prepare(`UPDATE events SET status='drawn',draw_mode='rating_balanced',bracket_snapshot=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND ${authorized}`).bind(JSON.stringify(snapshot),env.CHECKIN_EVENT_ID,env.CHECKIN_EVENT_ID,id),
    env.DB.prepare(`UPDATE event_state SET scene='idle',scene_payload=?,version=version+1,scene_seq=scene_seq+1,scene_started_at=NULL,awaiting_operator=1,playback='holding',presentation_mode='full',audio_enabled=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE event_id=? AND version=? AND ${authorized}`).bind(payload,env.CHECKIN_EVENT_ID,expected,env.CHECKIN_EVENT_ID,id));
  try{await env.DB.batch(statements);}catch(error){if(!await session(env).catch(()=>null))throw error;}
  if(!await session(env))throw new ClientError('VERSION_CONFLICT',409);
  return response(await read(env));
}
export async function preparePairs(env:CheckinEnv){
  await initialize(env);
  if(await session(env))return;
  const current=await scene(env);
  await prepare(env,{requestId:crypto.randomUUID(),expectedVersion:current.version});
}
async function announce(env:CheckinEnv,body:Record<string,unknown>){
  await initialize(env);
  if(!await session(env))throw new ClientError('PAIRS_NOT_PREPARED',409);
  const current=await read(env);
  if(current.scene!=='idle')return response({...current,replayed:true});
  await flowCommand(env,'announce',body);
  return response(await read(env));
}
async function complete(env:CheckinEnv,body:Record<string,unknown>){
  await initialize(env);
  const current=await read(env);
  if(!current.session||body.sessionId!==current.session.id)throw new ClientError('VERSION_CONFLICT',409);
  if(current.scene==='bracket')return response(current);
  if(current.version!==body.expectedVersion||!current.canComplete)throw new ClientError('DRAW_NOT_FINISHED',409);
  await flowCommand(env,'advance',{requestId:crypto.randomUUID(),expectedVersion:body.expectedVersion});
  return response(await read(env));
}
export async function drawRoute(request:Request,env:CheckinEnv):Promise<Response|null>{
  const url=new URL(request.url);
  const flow=/^\/api\/tournament\/(advance|game-start|start|winner)$/.exec(url.pathname);
  if(flow&&request.method==='POST'){await flowCommand(env,flow[1] as 'advance'|'game-start'|'start'|'winner',await readBody(request,1024));return response(await read(env));}
  if(url.pathname==='/api/draw/state'&&request.method==='GET')return response(await read(env));
  if(url.pathname==='/api/draw/start'&&request.method==='POST')return announce(env,await readBody(request,1024));
  if(url.pathname==='/api/draw/complete'&&request.method==='POST')return complete(env,await readBody(request,1024));
  return null;
}
