import { describe,it,expect } from 'vitest';
import { setup } from './testSupport';
import { resolveResultAdvance } from '../../../src/features/bracket/resultAdvance';
import { toStageData } from '../../../src/features/bracket/stageData';
import type { BracketSnapshot } from '../../../src/features/bracket/manager';
import { estimateDrawDurationSec } from '../../../src/features/presentation/drawAnimationTiming';

describe('persisted 32-person rehearsal through the existing tournament APIs',()=>{
 it('runs 16 balanced pairs and exactly 15 single-elimination matches, keeping VS gated by START',async()=>{
  const s=setup(); await s.login(); s.env.REHEARSAL_ENABLED='1';
  const input={requestId:crypto.randomUUID(),format:'single_elimination',timingPreset:'fast'};
  const created=await s.request('/api/rehearsal/create','POST',input).then(r=>r.json()) as {eventId:string};
  expect((await s.request('/api/rehearsal/create','POST',input)).status).toBe(200);
  expect((await s.request('/api/rehearsal/create','POST',{...input,timingPreset:'show'})).status).toBe(409);
  const suffix='?run='+created.eventId;
  for(let i=0;i<32;i++)expect((await s.request('/api/participants'+suffix,'POST',{...s.input(`sample ${i+1}`),rating:5+i%10})).status).toBe(201);
  type View={scene:string;version:number;format:string;timingPreset:string;checkinRevision:number;durationSec:number;participants:unknown[];teams:{id:string;memberIds:string[]}[];bracket:BracketSnapshot;session:{id:string;revealOrder:string[]};flow:{currentMatch:{id:number;teamA:string;roundName:string;final:boolean}|null;resultPresentation:{beforeBracket:BracketSnapshot;match:{id:number};winnerTeamId:string};phase:string;completedMatches:number;championTeamId:string|null;canStart:boolean}};
  const state=()=>s.request('/api/rehearsal/status'+suffix).then(r=>r.json()) as Promise<View>;
  const age=()=>s.db.prepare("UPDATE event_state SET scene_started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') WHERE event_id=?").run(created.eventId);
  const cmd=async(action:string,extra:Record<string,unknown>={})=>{const v=await state();return s.request('/api/tournament/'+action+suffix,'POST',{requestId:crypto.randomUUID(),expectedVersion:v.version,...extra});};
  let v=await state();expect((await s.request('/api/checkin/close'+suffix,'POST',{requestId:crypto.randomUUID(),expectedRevision:v.checkinRevision})).status).toBe(200);
  v=await state();expect(v.format).toBe('single_elimination');expect(v.timingPreset).toBe('fast');expect(v.teams).toHaveLength(16);expect(v.bracket.match).toHaveLength(15);
  expect(new Set(v.teams.flatMap(t=>t.memberIds)).size).toBe(32);const pairs=JSON.stringify(v.teams),session=v.session.id;
  expect(v.durationSec).toBe(estimateDrawDurationSec(32,'full',16,'fast'));
  expect((await s.request('/api/draw/start'+suffix,'POST',{requestId:crypto.randomUUID(),expectedVersion:v.version})).status).toBe(200);
  age();expect((await cmd('advance')).status).toBe(200);age();expect((await cmd('game-start')).status).toBe(200);
  const rounds:string[]=[];
  for(let i=0;i<15;i++){
   v=await state();expect(v.scene).toBe('vs_card');expect(v.flow.completedMatches).toBe(i);
   expect((await cmd('winner',{winnerSlot:0})).status).toBe(409);
   age();const waiting=await state();expect(waiting.scene).toBe('vs_card');expect(waiting.flow.canStart).toBe(true);
   rounds.push(waiting.flow.currentMatch!.roundName);expect(waiting.flow.currentMatch!.final).toBe(i===14);
   expect((await cmd('start')).status).toBe(200);expect((await cmd('winner',{winnerSlot:i%2})).status).toBe(200);
   v=await state();expect(v.scene).toBe('result');expect(v.flow.completedMatches).toBe(i+1);
   if(i<14){const p=v.flow.resultPresentation;expect(resolveResultAdvance(toStageData(p.beforeBracket),toStageData(v.bracket),p.match.id,p.winnerTeamId)).not.toBeNull();}
   age();expect((await cmd('advance')).status).toBe(200);v=await state();
   if(i<14){expect(v.flow.phase).toBe('bracket_update');age();expect((await cmd('advance')).status).toBe(200);}
  }
  age();expect((await cmd('advance')).status).toBe(200);v=await state();expect(v.scene).toBe('finished');expect(v.flow.championTeamId).toBeTruthy();
  expect(rounds.filter(r=>r==='Round of 16')).toHaveLength(8);expect(rounds.filter(r=>r==='Quarter Final')).toHaveLength(4);expect(rounds.filter(r=>r==='Semi Final')).toHaveLength(2);expect(rounds.filter(r=>r==='Final')).toHaveLength(1);
  expect(JSON.stringify(v.teams)).toBe(pairs);expect(v.session.id).toBe(session);
  expect(s.db.prepare("SELECT COUNT(*) n FROM matches WHERE event_id=? AND status='done'").get(created.eventId)!.n).toBe(15);
  expect(s.db.prepare("SELECT COUNT(*) n FROM operation_log WHERE event_id=? AND action='flow.winner'").get(created.eventId)!.n).toBe(15);
 },30000);
});
