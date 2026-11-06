import { ClientError, OFFICIAL_FIXED_EVENT_ID, requestId, readBody, response, participantDto, type CheckinEnv } from './domain';
import { rows } from './lifecycle';
import { readDrawState } from './draw';

export const isRehearsalRun=(id:string)=>/^cf-through-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
const officialRun=(env:CheckinEnv)=>env.OFFICIAL_EVENT_ID&&isRehearsalRun(env.OFFICIAL_EVENT_ID)?env.OFFICIAL_EVENT_ID:null;
/** Pre-registered tournaments. Each keeps its own participants, pairs and progress under its event_id. */
export const FIXED_EVENTS=[
 {id:OFFICIAL_FIXED_EVENT_ID,label:'大会00000001'},
 {id:'cf-through-20261206-1206-4206-8206-000000000002',label:'予備1'},
 {id:'cf-through-20261206-1206-4206-8206-000000000003',label:'予備2'},
] as const;
function fixedEventTitle(event:(typeof FIXED_EVENTS)[number]){
 return event.label==='大会00000001'?'大会00000001':`大会通しリハーサル ${event.label}`;
}
async function registerFixedEvents(env:CheckinEnv){
 const subtitle=JSON.stringify({rehearsalTiming:'show'});
 await env.DB.batch(FIXED_EVENTS.map(event=>env.DB.prepare("INSERT OR IGNORE INTO events(id,title,subtitle,format,environment,team_size,status) VALUES(?,?,?,'double_elimination','rehearsal',2,'draft')").bind(event.id,fixedEventTitle(event),subtitle)));
}
const SAVED_EVENT_LIMIT=50;
async function savedEvents(env:CheckinEnv){
 const rows=await env.DB.prepare(`SELECT e.id,e.title,e.format,(SELECT COUNT(*) FROM participants p WHERE p.event_id=e.id AND p.note LIKE 'checkin-v1:%' AND p.status='entered') count
  FROM events e WHERE e.environment='rehearsal' AND e.id LIKE 'cf-through-%' ORDER BY e.created_at DESC,e.id LIMIT ?`).bind(SAVED_EVENT_LIMIT+FIXED_EVENTS.length).all<{id:string;title:string;format:string;count:number}>();
 const byId=new Map(rows.results.filter(row=>isRehearsalRun(row.id)).map(row=>[row.id,row]));
 const fixed=FIXED_EVENTS.map(event=>({id:event.id,label:event.label,format:byId.get(event.id)?.format??'double_elimination',count:byId.get(event.id)?.count??0,fixed:true}));
 const created=[...byId.values()].filter(row=>!FIXED_EVENTS.some(event=>event.id===row.id)).slice(0,SAVED_EVENT_LIMIT).map(row=>({id:row.id,label:row.title,format:row.format,count:row.count,fixed:false}));
 return [...fixed,...created];
}
function eventTitle(value:unknown,id:string){
 if(value==null||value==='')return `大会通しリハーサル ${id.slice(-8)}`;
 if(typeof value!=='string')throw new ClientError('INVALID_TITLE',400);
 const title=value.trim().normalize('NFC');
 if(!title||title.length>80||/[\u0000-\u001f\u007f]/.test(title))throw new ClientError('INVALID_TITLE',400);
 return title;
}
export async function rehearsalRoute(request:Request,env:CheckinEnv):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/rehearsal/'))return null;
 if(env.REHEARSAL_ENABLED!=='1')throw new ClientError('NOT_FOUND',404);
 if(path==='/api/rehearsal/config'&&request.method==='GET'){
  await registerFixedEvents(env);
  return response({enabled:true,sourceEventId:env.REHEARSAL_SOURCE_EVENT_ID??null,officialEventId:officialRun(env),events:await savedEvents(env)});
 }
 if(path==='/api/rehearsal/create'&&request.method==='POST'){
  const body=await readBody(request,1024),id=`cf-through-${requestId(body.requestId)}`;
  const format=body.format??'double_elimination',preset=body.timingPreset??'show',title=eventTitle(body.title,id);
  if(!['single_elimination','double_elimination'].includes(String(format))||!['show','fast'].includes(String(preset)))throw new ClientError('INVALID_REHEARSAL_PROFILE',400);
  const subtitle=JSON.stringify({rehearsalTiming:preset});
  await env.DB.prepare("INSERT OR IGNORE INTO events(id,title,subtitle,format,environment,team_size,status) VALUES(?,?,?,?,'rehearsal',2,'draft')").bind(id,title,subtitle,format).run();
  const profile=await env.DB.prepare("SELECT title,format,subtitle FROM events WHERE id=? AND environment='rehearsal'").bind(id).first<{title:string;format:string;subtitle:string|null}>();
  if(!profile)throw new ClientError('FORBIDDEN',403);
  if(profile.format!==format||profile.subtitle!==subtitle||(body.title!=null&&body.title!==''&&profile.title!==title))throw new ClientError('REQUEST_CONFLICT',409);
  return response({eventId:id});
 }
 if(path==='/api/rehearsal/source'&&request.method==='GET'){
  if(!env.REHEARSAL_SOURCE_EVENT_ID)throw new ClientError('NOT_CONFIGURED',503);
  const source={...env,CHECKIN_EVENT_ID:env.REHEARSAL_SOURCE_EVENT_ID};
  return response({participants:(await rows(source)).map(p=>participantDto(p,source.CHECKIN_EVENT_ID))});
 }
 if(path==='/api/rehearsal/status'&&request.method==='GET'){
  if(!isRehearsalRun(env.CHECKIN_EVENT_ID))throw new ClientError('RUN_REQUIRED',409);
  const value=await readDrawState(env);
  const count=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) completed FROM matches WHERE event_id=?").bind(env.CHECKIN_EVENT_ID).first<{total:number;completed:number|null}>();
  const current=await env.DB.prepare('SELECT e.bm_current_match_id,s.current_match_id,s.version FROM events e JOIN event_state s ON s.event_id=e.id WHERE e.id=?').bind(env.CHECKIN_EVENT_ID).first<{bm_current_match_id:number|null;current_match_id:string|null;version:number}>();
  if(current?.version!==value.version)throw new ClientError('VERSION_CONFLICT',409);
  const selected=value.flow?.currentMatch?.id??null;
  const consistent=!value.session||(count?.total===value.bracket?.match.length&&(count?.completed??0)===value.flow?.completedMatches&&current?.bm_current_match_id===selected&&current?.current_match_id===(selected==null?null:`${env.CHECKIN_EVENT_ID}-bm-${selected}`));
  return response({...value,integrity:{consistent,matchCount:count?.total??0}});
 }
 return null;
}

export async function selectRehearsalRun(request:Request,env:CheckinEnv):Promise<CheckinEnv>{
 if(env.REHEARSAL_ENABLED!=='1')return env;
 const url=new URL(request.url),portrait=/^\/api\/events\/([^/]+)\/participants\/checkin-[a-f0-9-]{36}\/portrait$/.exec(url.pathname);
 const requested=url.searchParams.get('run');
 if(portrait&&requested&&portrait[1]!==requested)throw new ClientError('NOT_FOUND',404);
 const id=portrait?.[1]??requested??officialRun(env);
 // The source event is exposed for portraits only, never for tournament commands.
 if(portrait&&request.method==='GET'&&id===env.REHEARSAL_SOURCE_EVENT_ID)return {...env,CHECKIN_EVENT_ID:id};
 if(!id||!isRehearsalRun(id))throw new ClientError('RUN_REQUIRED',409);
 const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND environment='rehearsal'").bind(id).first();
 if(!owned)throw new ClientError('NOT_FOUND',404);
 return {...env,CHECKIN_EVENT_ID:id};
}
