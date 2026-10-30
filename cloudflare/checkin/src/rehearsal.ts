import { ClientError, requestId, readBody, response, participantDto, type CheckinEnv } from './domain';
import { rows } from './lifecycle';
import { readDrawState } from './draw';

export const isRehearsalRun=(id:string)=>/^cf-through-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
export async function rehearsalRoute(request:Request,env:CheckinEnv):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/rehearsal/'))return null;
 if(env.REHEARSAL_ENABLED!=='1')throw new ClientError('NOT_FOUND',404);
 if(path==='/api/rehearsal/config'&&request.method==='GET')return response({enabled:true,sourceEventId:env.REHEARSAL_SOURCE_EVENT_ID??null});
 if(path==='/api/rehearsal/create'&&request.method==='POST'){
  const body=await readBody(request,1024),id=`cf-through-${requestId(body.requestId)}`;
  const format=body.format??'double_elimination',preset=body.timingPreset??'show';
  if(!['single_elimination','double_elimination'].includes(String(format))||!['show','fast'].includes(String(preset)))throw new ClientError('INVALID_REHEARSAL_PROFILE',400);
  const subtitle=JSON.stringify({rehearsalTiming:preset});
  await env.DB.prepare("INSERT OR IGNORE INTO events(id,title,subtitle,format,environment,team_size,status) VALUES(?,?,?,?,'rehearsal',2,'draft')").bind(id,`大会通しリハーサル ${id.slice(-8)}`,subtitle,format).run();
  const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND environment='rehearsal' AND title LIKE '大会通しリハーサル %'").bind(id).first();
  if(!owned)throw new ClientError('FORBIDDEN',403);
  const profile=await env.DB.prepare('SELECT format,subtitle FROM events WHERE id=?').bind(id).first<{format:string;subtitle:string|null}>();
  if(profile?.format!==format||profile.subtitle!==subtitle)throw new ClientError('REQUEST_CONFLICT',409);
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
 const id=portrait?.[1]??url.searchParams.get('run');
 // The source event is exposed for portraits only, never for tournament commands.
 if(portrait&&request.method==='GET'&&id===env.REHEARSAL_SOURCE_EVENT_ID)return {...env,CHECKIN_EVENT_ID:id};
 if(!id||!isRehearsalRun(id))throw new ClientError('RUN_REQUIRED',409);
 const owned=await env.DB.prepare("SELECT id FROM events WHERE id=? AND environment='rehearsal' AND title LIKE '大会通しリハーサル %'").bind(id).first();
 if(!owned)throw new ClientError('NOT_FOUND',404);
 return {...env,CHECKIN_EVENT_ID:id};
}
