import { describe, expect, it } from 'vitest';
import { setup } from './testSupport';
import type {BracketSnapshot} from '../../../src/features/bracket/manager';
interface View {scene:string;version:number;flow:{phase:string;nextMatch:unknown|null;currentMatch:{id:number;teamA:string;teamB:string;kind:string}|null;championTeamId:string|null;canStart:boolean;canAdvance:boolean;canGameStart:boolean;completedMatches:number};bracket:unknown;teams:{id:string}[]}
async function prepared(count=8){const s=setup();await s.login();for(let i=0;i<count;i++)await s.create(`player ${i}`);const reception=await s.request('/api/checkin/state').then(r=>r.json()) as {revision:number};await s.request('/api/checkin/close','POST',{requestId:crypto.randomUUID(),expectedRevision:reception.revision});expect((await s.request('/api/draw/start','POST',{requestId:crypto.randomUUID(),expectedVersion:1})).status).toBe(200);
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
  const restored=await s.advance();expect(restored.scene).toBe('award');expect(restored.flow.championTeamId).toBe(first.flow.currentMatch!.teamB);expect((await s.advance()).scene).toBe('finished');
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
  state=await s.advance();expect(state.scene).toBe('finished');expect(s.db.prepare('SELECT status FROM events').get()!.status).toBe('finished');
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE status='done'").get()!.n).toBe(selected.length);
  expect((await s.command('start')).response.status).toBe(409);expect((await s.command('winner',{winnerSlot:0})).response.status).toBe(409);
 });
 it('allows only one winner for a live match across concurrent operators and rolls back partial writes',async()=>{
  const s=await prepared(4);await s.advance();await s.advance();s.age();expect((await s.command('start')).response.status).toBe(200);
  const state=await s.view();const commands=[0,1].map(winnerSlot=>({requestId:crypto.randomUUID(),expectedVersion:state.version,winnerSlot}));
  s.faults.failAt=2;expect((await s.request('/api/tournament/winner','POST',commands[0])).status).toBe(503);expect((await s.view()).scene).toBe('match_live');s.faults.failAt=-1;
  const responses=await Promise.all(commands.map(b=>s.request('/api/tournament/winner','POST',b)));expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  const result=await s.view();expect(result.scene).toBe('result');expect(result.version).toBe(state.version+1);
 });
});
