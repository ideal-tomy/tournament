import { describe, expect, it, vi } from 'vitest';
import { setup } from './testSupport';
import {toStageData,type BracketSnapshot} from '../../../src/features/bracket/manager';
import {getMatchTier,getOpenTierMatches} from '../../../src/features/progression/progression';
interface View {scene:string;version:number;sceneSeq:number;participants:{id:string;rating:number|null}[];session:{id:string}|null;flow:{ceremony:string|null;placements:{first:string;second:string[];third:string[]}|null;phase:string;nextMatch:unknown|null;currentMatch:{id:number;teamA:string;teamB:string;kind:string}|null;championTeamId:string|null;canStart:boolean;canAdvance:boolean;canGameStart:boolean;completedMatches:number};bracket:unknown;teams:{id:string}[]}
async function prepared(count=8){const s=setup();await s.login();for(let i=0;i<count;i++)await s.create(`player ${i}`);const reception=await s.request('/api/checkin/state').then(r=>r.json()) as {revision:number};await s.request('/api/checkin/close','POST',{requestId:crypto.randomUUID(),expectedRevision:reception.revision});expect((await s.pair()).status).toBe(200);expect((await s.request('/api/draw/start','POST',{requestId:crypto.randomUUID(),expectedVersion:1})).status).toBe(200);
 const view=()=>s.request('/api/draw/state').then(r=>r.json()) as Promise<View>;
 const age=()=>s.db.exec("UPDATE event_state SET scene_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')");
 async function command(action:string,extra:Record<string,unknown>={}){const current=await view();const body={requestId:crypto.randomUUID(),expectedVersion:current.version,...extra};const response=await s.request(`/api/tournament/${action}`,'POST',body);return {response,body};}
 async function advance(){age();const phase=await view();const r=await command(phase.scene==='bracket'&&phase.flow.phase!=='bracket_update'?'game-start':'advance');expect(r.response.status).toBe(200);let next=await view();if(next.flow.phase==='bracket_update'){age();expect((await command('advance')).response.status).toBe(200);next=await view();}return next;}
 return {...s,view,age,command,advance};}
describe('one continuous tournament with automatic scheduling',()=>{
 it('finishes four participants and recovers an older completed two-team final without changing its winner',async()=>{
  const s=await prepared(4);await s.advance();const first=await s.advance();s.age();await s.command('start');expect((await s.command('winner',{winnerSlot:1})).response.status).toBe(200);
  const result=await s.view();expect(result.flow.championTeamId).toBe(first.flow.currentMatch!.teamB);
  s.db.exec("UPDATE event_state SET scene='bracket',scene_payload=json_remove(scene_payload,'$.championTeamId'),scene_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes')");
  const restored=await s.advance();expect(restored.scene).toBe('award');expect(restored.flow.championTeamId).toBe(first.flow.currentMatch!.teamB);
  expect(restored.flow.ceremony).toBe('second');expect(restored.flow.placements).toEqual({first:first.flow.currentMatch!.teamB,second:[first.flow.currentMatch!.teamA],third:[]});
  expect((await s.advance()).flow.ceremony).toBe('champion');expect((await s.advance()).flow.ceremony).toBe('podium');expect((await s.advance()).scene).toBe('finished');
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='done'").get()!.n).toBe(1);expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='flow.winner'").get()!.n).toBe(1);
 });
 it('persists the winner and advancement before presenting result, then shows updated bracket and resolves the next match',async()=>{
  const s=await prepared();await s.advance();const first=await s.advance();s.age();const match=first.flow.currentMatch!;
  expect((await s.command('start')).response.status).toBe(200);
  const scored=await s.command('winner',{winnerSlot:0});expect(scored.response.status).toBe(200);
  const result=await s.view();expect(result.scene).toBe('result');expect(result.flow.currentMatch).toBeNull();
  const presentation=(result.flow as typeof result.flow&{resultPresentation:{beforeBracket:BracketSnapshot;match:{id:number};winnerTeamId:string}}).resultPresentation;
  expect(presentation.match.id).toBe(match.id);expect(presentation.winnerTeamId).toBe(match.teamA);expect(presentation.beforeBracket.match.find(m=>m.id===match.id)!.status).toBe(3);
  expect((result.bracket as BracketSnapshot).match.find(m=>m.id===match.id)!.status).toBe(4);
  const row=s.db.prepare('SELECT winner_team_id,status FROM matches WHERE id=?').get(`cf-rehearsal-001-bm-${match.id}`)!;
  expect(row.winner_team_id).toBe(match.teamA);expect(row.status).toBe('done');
  expect((await s.command('advance')).response.status).toBe(409);s.age();expect((await s.command('advance')).response.status).toBe(200);
  const bracket=await s.view();expect(bracket.scene).toBe('bracket');expect(bracket.flow.phase).toBe('bracket_update');expect(bracket.flow.canGameStart).toBe(false);expect(bracket.flow.canAdvance).toBe(false);expect(bracket.bracket).toEqual(result.bracket);
  expect((await s.command('game-start')).response.status).toBe(409);expect((await s.command('start')).response.status).toBe(409);s.age();expect((await s.command('advance')).response.status).toBe(200);
  const next=await s.view();expect(next.scene).toBe('vs_card');expect(next.flow.currentMatch!.id).not.toBe(match.id);expect(next.flow.completedMatches).toBe(1);
  s.age();expect((await s.view()).scene).toBe('vs_card');expect((await s.view()).flow.canStart).toBe(true);
  expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='flow.winner'").get()!.n).toBe(1);
  expect((await s.request('/api/tournament/winner','POST',scored.body)).status).toBe(200);expect((await s.view()).version).toBe(next.version);
  expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='flow.winner'").get()!.n).toBe(1);
 });
 it('starts the selected match once across two operators and safely replays a lost response',async()=>{
  const s=await prepared();await s.advance();await s.advance();s.age();const before=await s.view();
  const bodies=[0,1].map(()=>({requestId:crypto.randomUUID(),expectedVersion:before.version}));
  const responses=await Promise.all(bodies.map(b=>s.request('/api/tournament/start','POST',b)));expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  const winner=responses[0].status===200?bodies[0]:bodies[1];expect((await s.request('/api/tournament/start','POST',winner)).status).toBe(200);
  expect((await s.view()).version).toBe(before.version+1);expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='in_progress'").get()!.n).toBe(1);expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='flow.start'").get()!.n).toBe(1);
  s.faults.lostReply=true;const scored=await s.command('winner',{winnerSlot:1});expect(scored.response.status).toBe(200);s.faults.lostReply=false;
  expect((await s.request('/api/tournament/winner','POST',scored.body)).status).toBe(200);expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='flow.winner'").get()!.n).toBe(1);
 });
 it('runs four teams through results, losers bracket, grand final reset and champion without choosing a match',async()=>{
  const s=await prepared();expect((await s.command('winner',{winnerSlot:0})).response.status).toBe(409);
  expect((await s.advance()).scene).toBe('bracket');let state=await s.advance();expect(state.scene).toBe('vs_card');
  const selected:number[]=[];let guard=0,sawLoser=false,grandFinals=0;
  while(state.scene==='vs_card'&&guard++<20){
   const match=state.flow.currentMatch!;selected.push(match.id);sawLoser ||= match.kind==='loser';if(match.kind==='grand_final')grandFinals++;
   expect((await s.command('start')).response.status).toBe(409); // VS is still playing
   expect((await s.command('winner',{winnerSlot:0})).response.status).toBe(409);
   s.age();const started=await s.command('start');expect(started.response.status).toBe(200);state=await s.view();expect(state.scene).toBe('match_live');
   const before=state.version;const result=await s.command('winner',{winnerSlot:match.kind==='grand_final'?1:0});expect(result.response.status).toBe(200);
   const committed=await s.view();expect(committed.scene).toBe('result');expect(committed.flow.currentMatch).toBeNull();
   expect((await s.request('/api/tournament/winner','POST',result.body)).status).toBe(200);
   expect((await s.request('/api/tournament/winner','POST',{...result.body,winnerSlot:result.body.winnerSlot===1?0:1})).status).toBe(409);
   expect((await s.command('start')).response.status).toBe(409);
   const snapshot=s.db.prepare('SELECT bracket_snapshot FROM events').get()!;expect(JSON.parse(String(snapshot.bracket_snapshot))).toEqual(committed.bracket);
   expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='in_progress'").get()!.n).toBe(0);
   expect(committed.version).toBe(before+1);state=await s.advance();
  }
  expect(guard).toBeLessThan(20);expect(sawLoser).toBe(true);expect(grandFinals).toBe(2);expect(new Set(selected).size).toBe(selected.length);
  expect(state.scene).toBe('award');expect(state.teams.some(t=>t.id===state.flow.championTeamId)).toBe(true);expect(state.flow.nextMatch).toBeNull();
  const steps=[state.flow.ceremony];const placements=state.flow.placements!;
  expect(placements.first).toBe(state.flow.championTeamId);expect(placements.second).toHaveLength(1);expect(placements.third).toHaveLength(1);
  expect((await s.command('advance')).response.status).toBe(409); // the 3rd-place presentation is still playing
  while(state.scene==='award'&&steps.length<6){state=await s.advance();if(state.scene==='award')steps.push(state.flow.ceremony);}
  expect(steps).toEqual(['third','second','champion','podium']);
  expect(state.scene).toBe('finished');expect(s.db.prepare('SELECT status FROM events').get()!.status).toBe('finished');
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='done'").get()!.n).toBe(selected.length);
  expect((await s.command('start')).response.status).toBe(409);expect((await s.command('winner',{winnerSlot:0})).response.status).toBe(409);
 });
 it('runs two boards from the bottom tier, keeps each board independent, and returns to one board for the grand final',async()=>{
  const s=await prepared(16);expect((await s.advance()).scene).toBe('bracket');s.age();
  expect((await s.command('courts-open',{count:4})).response.status).toBe(400);
  expect((await s.command('court-start',{board:1})).response.status).toBe(409);
  expect((await s.command('courts-open',{count:2})).response.status).toBe(200);
  type Courts={count:number;spotlight:{kind:string;board:number;elapsed:number;winnerSec:number;resultPresentation:{match:{id:number}}|null}|null;boards:{board:number;matchId:number|null;stage:string;showing:boolean;match:{id:number;kind:string;roundName:string}|null}[]};
  const courts=async()=>{const v=await s.view();return {v,c:(v.flow as typeof v.flow&{courts:Courts|null}).courts};};
  let {v,c}=await courts();expect(v.scene).toBe('interval');expect(c!.boards.map(b=>b.stage)).toEqual(['call','call']);
  expect(c!.boards.every(b=>b.match?.roundName==='ウィナーズ 1回戦')).toBe(true);expect(new Set(c!.boards.map(b=>b.matchId)).size).toBe(2);
  vi.useFakeTimers({toFake:['Date']});
  try{
  const later=(seconds:number)=>vi.setSystemTime(Date.now()+seconds*1000);
  expect((await s.command('court-start',{board:1})).response.status).toBe(200);expect((await s.command('court-start',{board:2})).response.status).toBe(200);
  ({v,c}=await courts());expect(c!.spotlight).toMatchObject({kind:'vs',board:1});expect(c!.boards.map(b=>b.showing)).toEqual([true,true]);
  const busy=await s.command('court-winner',{board:1,winnerSlot:0});expect(busy.response.status).toBe(409);expect((await busy.response.json() as {error:string}).error).toBe('SPOTLIGHT_PLAYING');
  later(9);({v,c}=await courts());expect(c!.spotlight).toMatchObject({kind:'vs',board:2});expect(c!.spotlight!.elapsed).toBeLessThan(1);expect(c!.boards.map(b=>b.showing)).toEqual([false,true]);
  const other=c!.boards[1].matchId;
  const scored=await s.command('court-winner',{board:1,winnerSlot:0});expect(scored.response.status).toBe(200);
  ({v,c}=await courts());expect(c!.boards.map(b=>b.stage)).toEqual(['result','live']);expect(c!.boards[1].matchId).toBe(other);
  expect(c!.spotlight).toMatchObject({kind:'vs',board:2});expect((await s.command('court-next',{board:1})).response.status).toBe(409);
  later(9);({v,c}=await courts());expect(c!.spotlight).toMatchObject({kind:'winner',board:1,winnerSec:6});expect(c!.spotlight!.resultPresentation!.match.id).toBe(c!.boards[0].matchId);
  later(13);({v,c}=await courts());expect(c!.spotlight).toBeNull();
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='in_progress'").get()!.n).toBe(1);
  expect((await s.request('/api/tournament/court-winner','POST',scored.body)).status).toBe(200);expect((await s.view()).version).toBe(v.version);
  const tierOf=(view:View,id:number)=>{const data=toStageData(view.bracket as BracketSnapshot);return getMatchTier(data,data.match.find(m=>m.id===id)!);};
  const lowestOpen=(view:View)=>{const data=toStageData(view.bracket as BracketSnapshot);return getMatchTier(data,getOpenTierMatches(data)[0]);};
  let guard=0,sawLoser=false;
  while(v.scene==='interval'&&guard++<120){
   for(const board of c!.boards){
    later(30);
    if(board.stage==='call'){expect(tierOf(v,board.matchId!)).toBe(lowestOpen(v));sawLoser||=board.match!.kind==='loser';expect((await s.command('court-start',{board:board.board})).response.status).toBe(200);}
    else if(board.stage==='live')expect((await s.command('court-winner',{board:board.board,winnerSlot:0})).response.status).toBe(200);
    else expect((await s.command('court-next',{board:board.board})).response.status).toBe(200);
    ({v,c}=await courts());if(v.scene!=='interval')break;
   }
  }
  expect(sawLoser).toBe(true);expect(v.scene).toBe('bracket');
  }finally{vi.useRealTimers();}
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='in_progress'").get()!.n).toBe(0);
  s.age();expect((await s.view()).flow.canGameStart).toBe(true);
  const final=await s.advance();expect(final.scene).toBe('vs_card');expect(final.flow.currentMatch!.kind).toBe('grand_final');
 });
 it('replays a finished tournament from the announcement with the same participants and pairs',async()=>{
  const s=await prepared(4);
  await s.advance();await s.advance();s.age();await s.command('start');await s.command('winner',{winnerSlot:0});
  let state=await s.advance();while(state.scene!=='finished')state=await s.advance();
  const before={participants:s.db.prepare('SELECT COUNT(*) n FROM participants').get()!.n,teams:s.db.prepare('SELECT id FROM teams ORDER BY seed').all(),session:state.session!.id};
  const stale={requestId:crypto.randomUUID(),expectedVersion:state.version-1};
  expect((await s.request('/api/tournament/replay','POST',stale)).status).toBe(409);
  const replayed=await s.command('replay');expect(replayed.response.status).toBe(200);
  expect((await s.request('/api/tournament/replay','POST',replayed.body)).status).toBe(200);
  const reset=await s.view();
  expect(reset.scene).toBe('idle');expect(reset.session!.id).toBe(before.session);expect(reset.flow.completedMatches).toBe(0);expect(reset.flow.currentMatch).toBeNull();expect(reset.flow.championTeamId).toBeNull();
  expect(s.db.prepare('SELECT COUNT(*) n FROM participants').get()!.n).toBe(before.participants);
  expect(s.db.prepare('SELECT id FROM teams ORDER BY seed').all()).toEqual(before.teams);
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='done'").get()!.n).toBe(0);
  expect(s.db.prepare('SELECT status,bm_current_match_id FROM events').get()).toEqual({status:'drawn',bm_current_match_id:null});
  expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE action='tournament.replay'").get()!.n).toBe(1);
  expect((await s.command('replay')).response.status).toBe(409);
  expect((await s.request('/api/draw/start','POST',{requestId:crypto.randomUUID(),expectedVersion:reset.version})).status).toBe(200);
  expect((await s.view()).scene).toBe('draw');
  state=await s.advance();expect(state.scene).toBe('bracket');state=await s.advance();expect(state.scene).toBe('vs_card');
 });
 it('allows only one winner for a live match across concurrent operators and rolls back partial writes',async()=>{
  const s=await prepared(4);await s.advance();await s.advance();s.age();expect((await s.command('start')).response.status).toBe(200);
  const state=await s.view();const commands=[0,1].map(winnerSlot=>({requestId:crypto.randomUUID(),expectedVersion:state.version,winnerSlot}));
  s.faults.failAt=2;expect((await s.request('/api/tournament/winner','POST',commands[0])).status).toBe(503);expect((await s.view()).scene).toBe('match_live');s.faults.failAt=-1;
  const responses=await Promise.all(commands.map(b=>s.request('/api/tournament/winner','POST',b)));expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  const result=await s.view();expect(result.scene).toBe('result');expect(result.version).toBe(state.version+1);
 });
});
