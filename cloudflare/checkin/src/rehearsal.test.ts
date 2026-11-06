import {describe,it,expect} from 'vitest';
import {setup} from './testSupport';
describe('isolated through rehearsal using normal tournament APIs',()=>{
 it('never falls back for missing runs or mismatched portrait scope',async()=>{
  const s=setup();await s.login();const old=await s.create('old photo');
  s.env.REHEARSAL_ENABLED='1';s.env.REHEARSAL_SOURCE_EVENT_ID='cf-rehearsal-001';
  for(const path of ['/api/participants','/api/checkin/state','/api/draw/state'])
   expect((await s.request(path)).status).toBe(409);
  const run=`cf-through-${crypto.randomUUID()}`;
  expect((await s.request('/api/participants?run='+run)).status).toBe(404);
  expect((await s.request(old.participant.portraitUrl+'?run='+run)).status).toBe(404);
  const asset=await s.request('/assets/app.js');expect(asset.headers.get('Cache-Control')).not.toBe('no-store');
  expect((await s.request('/api/health')).headers.get('Cache-Control')).toBe('no-store');
 });
 it('requires authentication, same origin and an explicitly enabled Worker',async()=>{
  const s=setup();expect((await s.request('/api/rehearsal/config')).status).toBe(401);await s.login();expect((await s.request('/api/rehearsal/config')).status).toBe(404);
  s.env.REHEARSAL_ENABLED='1';expect((await s.request('/api/rehearsal/create','POST',{requestId:crypto.randomUUID()},'https://evil.example')).status).toBe(403);
  expect((await s.request('/api/rehearsal/create','POST',{requestId:'cf-rehearsal-001'})).status).toBe(400);
  expect((await s.request('/api/draw/state?run=cf-rehearsal-001')).status).toBe(409);
 });
 it('creates a new event idempotently and confines registrations, close and Draw to that event',async()=>{
  const s=setup();await s.login();await s.create('original');s.env.REHEARSAL_ENABLED='1';const body={requestId:crypto.randomUUID()};
  const first=await s.request('/api/rehearsal/create','POST',body).then(r=>r.json()) as {eventId:string};
  expect((await s.request('/api/rehearsal/create','POST',body).then(r=>r.json()))).toEqual(first);
  const suffix=`?run=${first.eventId}`;
  for(let i=0;i<4;i++)expect((await s.request('/api/participants'+suffix,'POST',s.input(`rehearsal ${i}`))).status).toBe(201);
  const checkin=await s.request('/api/checkin/state'+suffix).then(r=>r.json()) as {revision:number};expect((await s.request('/api/checkin/close'+suffix,'POST',{requestId:crypto.randomUUID(),expectedRevision:checkin.revision})).status).toBe(200);
  expect((await s.pair({mode:'auto'},suffix)).status).toBe(200);
  const prepared=await s.request('/api/rehearsal/status'+suffix).then(r=>r.json()) as {eventId:string;scene:string;version:number;integrity:{consistent:boolean}};
  expect(prepared.eventId).toBe(first.eventId);expect(prepared.scene).toBe('idle');expect(prepared.version).toBe(1);expect(prepared.integrity.consistent).toBe(true);
  expect((await s.request('/api/draw/start'+suffix,'POST',{requestId:crypto.randomUUID(),expectedVersion:1})).status).toBe(200);
  expect(s.db.prepare("SELECT COUNT(*) n FROM participants WHERE event_id='cf-rehearsal-001'").get()!.n).toBe(1);expect(s.db.prepare("SELECT status FROM checkin_state WHERE event_id='cf-rehearsal-001'").get()!.status).toBe('open');
  s.db.prepare('DELETE FROM matches WHERE event_id=?').run(first.eventId);
  const corrupt=await s.request('/api/rehearsal/status'+suffix).then(r=>r.json()) as {integrity:{consistent:boolean}};expect(corrupt.integrity.consistent).toBe(false);
  const second=await s.request('/api/rehearsal/create','POST',{requestId:crypto.randomUUID()}).then(r=>r.json()) as {eventId:string};expect(second.eventId).not.toBe(first.eventId);expect(s.db.prepare('SELECT COUNT(*) n FROM participants WHERE event_id=?').get(first.eventId)!.n).toBe(4);
 });
 it('opens the official event without run, and keeps explicit runs on their own event',async()=>{
  const s=setup();await s.login();s.env.REHEARSAL_ENABLED='1';
  const official='cf-through-20261206-1206-4206-8206-000000000001';s.env.OFFICIAL_EVENT_ID=official;
  expect((await s.request('/api/participants')).status).toBe(404);
  const config=await s.request('/api/rehearsal/config').then(r=>r.json()) as {officialEventId:string;events:{id:string;label:string}[]};
  expect(config.officialEventId).toBe(official);expect(config.events.map(e=>e.id)).toContain(official);
  const body={requestId:official.slice('cf-through-'.length),format:'double_elimination',timingPreset:'show'};
  for(let i=0;i<2;i++)expect((await s.request('/api/rehearsal/create','POST',body).then(r=>r.json()) as {eventId:string}).eventId).toBe(official);
  const created=await s.request('/api/participants','POST',s.input('official')).then(r=>r.json()) as {participant:{eventId:string;portraitUrl:string}};
  expect(created.participant.eventId).toBe(official);expect((await s.request(created.participant.portraitUrl)).status).toBe(200);
  expect((await s.request('/api/checkin/state').then(r=>r.json()) as {eventId:string;count:number})).toMatchObject({eventId:official,count:1});
  const other=await s.request('/api/rehearsal/create','POST',{requestId:crypto.randomUUID()}).then(r=>r.json()) as {eventId:string};
  expect((await s.request('/api/checkin/state?run='+other.eventId).then(r=>r.json()) as {count:number}).count).toBe(0);
  s.env.OFFICIAL_EVENT_ID='cf-rehearsal-001';expect((await s.request('/api/participants')).status).toBe(409);
 });
 it('registers the fixed tournaments once and keeps each event separate',async()=>{
  const s=setup();await s.login();s.env.REHEARSAL_ENABLED='1';
  for(let i=0;i<2;i++)expect((await s.request('/api/rehearsal/config')).status).toBe(200);
  const [first,second]=['cf-through-20261206-1206-4206-8206-000000000002','cf-through-20261206-1206-4206-8206-000000000003'];
  expect(s.db.prepare('SELECT COUNT(*) n FROM events WHERE id IN (?,?)').get(first,second)!.n).toBe(2);
  expect((await s.request('/api/participants?run='+first,'POST',s.input('spare'))).status).toBe(201);
  expect((await s.request('/api/checkin/state?run='+second).then(r=>r.json()) as {count:number}).count).toBe(0);
 });
 it('exposes registered source portraits read-only without allowing source event commands',async()=>{
  const s=setup();await s.login();const p=await s.create('source');s.env.REHEARSAL_ENABLED='1';s.env.REHEARSAL_SOURCE_EVENT_ID='cf-rehearsal-001';
  const source=await s.request('/api/rehearsal/source').then(r=>r.json()) as {participants:{id:string;portraitUrl:string}[]};expect(source.participants[0].id).toBe(p.participant.id);expect((await s.request(source.participants[0].portraitUrl)).status).toBe(200);
  expect((await s.request('/api/tournament/start?run=cf-rehearsal-001','POST',{requestId:crypto.randomUUID(),expectedVersion:0})).status).toBe(409);
  const missing=`cf-through-${crypto.randomUUID()}`;expect((await s.request('/api/draw/state?run='+missing)).status).toBe(404);
 });
});
