import { AUTOMATED_CAMERA_TEST_ID, ClientError, decodePortrait, fields, hash, imageTypes, participantDto, readBody, requestId, response, validKey, type CheckinEnv, type Participant } from './domain';

interface State { event_id:string; status:'open'|'closed'; revision:number; closed_at:string|null; closed_roster:string; title:string; team_size:number }
interface Receipt { action:string; request_hash:string; response_json:string }
const managed="p.note LIKE 'checkin-v1:%' AND p.status='entered'";
const refs="NOT EXISTS(SELECT 1 FROM participants WHERE photo_path=checkin_object_gc.object_key OR face_crop_path=checkin_object_gc.object_key)";
export async function state(env:CheckinEnv):Promise<State> {
  const existing=await env.DB.prepare("SELECT s.*,e.title,e.team_size FROM checkin_state s JOIN events e ON e.id=s.event_id WHERE s.event_id=? AND e.environment='rehearsal'").bind(env.CHECKIN_EVENT_ID).first<State>();
  if(existing)return existing;
  await env.DB.prepare("INSERT OR IGNORE INTO checkin_state(event_id) SELECT id FROM events WHERE id=? AND environment='rehearsal'").bind(env.CHECKIN_EVENT_ID).run();
  const row=await env.DB.prepare("SELECT s.*,e.title,e.team_size FROM checkin_state s JOIN events e ON e.id=s.event_id WHERE s.event_id=? AND e.environment='rehearsal'").bind(env.CHECKIN_EVENT_ID).first<State>();
  if(!row)throw new ClientError('NOT_FOUND',404);return row;
}
export async function rows(env:CheckinEnv,diagnostics=false) {
  const result=await env.DB.prepare(`SELECT p.* FROM participants p JOIN events e ON e.id=p.event_id WHERE e.id=? AND e.environment='rehearsal' AND ${managed} ORDER BY p.created_at,p.id`).bind(env.CHECKIN_EVENT_ID).all<Participant>();
  return diagnostics?result.results:result.results.filter(row=>row.id!==AUTOMATED_CAMERA_TEST_ID);
}
async function find(env:CheckinEnv,id:string) {
  return env.DB.prepare(`SELECT p.* FROM participants p JOIN events e ON e.id=p.event_id WHERE p.id=? AND p.event_id=? AND e.environment='rehearsal' AND ${managed}`).bind(id,env.CHECKIN_EVENT_ID).first<Participant>();
}
async function pending(env:CheckinEnv) {
  return (await env.DB.prepare("SELECT COUNT(*) AS count FROM checkin_object_gc WHERE event_id=? AND phase<>'done'").bind(env.CHECKIN_EVENT_ID).first<{count:number}>())?.count??0;
}
export async function drainCleanup(env:CheckinEnv) {
  const jobs=await env.DB.prepare(`SELECT object_key,event_id FROM checkin_object_gc WHERE event_id=? AND ${refs} AND (phase='ready' OR (phase='staged' AND expires_at<=unixepoch()) OR (phase='done' AND checked_at<unixepoch()-3600)) LIMIT 50`).bind(env.CHECKIN_EVENT_ID).all<{object_key:string;event_id:string}>();
  for(const job of jobs.results) {
    const claimed=await env.DB.prepare(`UPDATE checkin_object_gc SET phase='ready',attempts=attempts+1 WHERE object_key=? AND event_id=? AND ${refs}`).bind(job.object_key,env.CHECKIN_EVENT_ID).run();
    if(!claimed.meta.changes)continue;
    try {
      await env.PORTRAITS.delete(job.object_key);
      // Keep the tombstone so a late, ambiguous R2 put is caught by later sweeps.
      await env.DB.prepare("UPDATE checkin_object_gc SET phase='done',checked_at=unixepoch() WHERE object_key=? AND event_id=?").bind(job.object_key,env.CHECKIN_EVENT_ID).run();
    } catch { /* The durable outbox is retried by POST cleanup and the scheduled Worker. */ }
  }
  return pending(env);
}
async function retireAttempt(env:CheckinEnv,key:string) {
  await env.DB.prepare(`UPDATE checkin_object_gc SET phase='ready',expires_at=unixepoch() WHERE object_key=? AND event_id=? AND ${refs}`).bind(key,env.CHECKIN_EVENT_ID).run();
}
async function getReceipt(env:CheckinEnv,id:string) {
  return env.DB.prepare('SELECT action,request_hash,response_json FROM checkin_receipts WHERE event_id=? AND request_id=?').bind(env.CHECKIN_EVENT_ID,id).first<Receipt>();
}
function receiptValue(receipt:Receipt,action:string,requestHash:string) {
  if(receipt.action!==action || receipt.request_hash!==requestHash)throw new ClientError('REQUEST_CONFLICT',409);
  return JSON.parse(receipt.response_json) as {participant:ReturnType<typeof participantDto>|null;deleted?:boolean};
}
export async function mutate(env:CheckinEnv,action:'create'|'update'|'delete',id:string|null,body:Record<string,unknown>) {
  const commandId=requestId(body.requestId);
  const participantId=id??`checkin-${commandId}`;
  if(!/^checkin-[a-f0-9-]{36}$/.test(participantId)||participantId===AUTOMATED_CAMERA_TEST_ID)throw new ClientError('NOT_FOUND',404);
  const data=action==='delete'?null:fields(body);
  const picture=action==='create'||body.photo!=null||body.portrait!=null?decodePortrait(body.portrait??body.photo):null;
  const expected=body.expectedVersion;
  if(action!=='create' && (!Number.isSafeInteger(expected)||Number(expected)<0))throw new ClientError('INVALID_VERSION',400);
  const pictureHash=picture?await hash(picture.bytes):null;
  const requestHash=await hash(JSON.stringify([action,participantId,data,expected??null,pictureHash]));
  const replay=await getReceipt(env,commandId);
  if(replay) {
    const result=receiptValue(replay,action,requestHash);
    if(action==='create' && !await find(env,participantId))throw new ClientError('PARTICIPANT_DELETED',409);
    return response({...result,replayed:true,cleanupPending:await drainCleanup(env)});
  }
  const current=await find(env,participantId);
  const createHash=data?await hash(JSON.stringify([data.name,data.rating,pictureHash])):'';
  if(action==='create' && current) {
    if(current.note!==`checkin-v1:${createHash}`)throw new ClientError('REQUEST_CONFLICT',409);
    return response({participant:participantDto(current,env.CHECKIN_EVENT_ID),replayed:true,cleanupPending:await drainCleanup(env)});
  }
  if(action!=='create' && !current)throw new ClientError('NOT_FOUND',404);
  if(action!=='create' && current!.checkin_version!==expected)throw new ClientError('VERSION_CONFLICT',409);
  const checkin=await state(env);
  if(checkin.status!=='open')throw new ClientError('CHECKIN_CLOSED',409);
  if(action!=='create' && await env.DB.prepare('SELECT 1 AS used FROM team_members WHERE participant_id=? LIMIT 1').bind(participantId).first())throw new ClientError('PARTICIPANT_IN_USE',409);
  let key=current?.photo_path??'';
  let attempt:string|null=null;
  try {
    if(picture) {
      key=`events/${env.CHECKIN_EVENT_ID}/participants/${participantId}/${crypto.randomUUID()}/portrait.${picture.format}`;
      attempt=key;
      const staged=await env.DB.prepare(`INSERT INTO checkin_object_gc(object_key,event_id,phase,expires_at)
        SELECT ?,?,'staged',unixepoch()+900 WHERE EXISTS(SELECT 1 FROM checkin_state WHERE event_id=? AND status='open')`).bind(key,env.CHECKIN_EVENT_ID,env.CHECKIN_EVENT_ID).run();
      if(!staged.meta.changes)throw new ClientError('CHECKIN_CLOSED',409);
      const uploaded=await env.PORTRAITS.put(key,picture.bytes.buffer as ArrayBuffer,{httpMetadata:{contentType:picture.contentType},customMetadata:{eventId:env.CHECKIN_EVENT_ID,participantId,requestHash,photoHash:pictureHash!},onlyIf:{etagDoesNotMatch:'*'}});
      if(uploaded===null)throw new ClientError('REQUEST_CONFLICT',409);
    }
    const now=new Date().toISOString();
    const next:Participant=action==='create'?{id:participantId,event_id:env.CHECKIN_EVENT_ID,display_name:data!.name,rating:data!.rating,photo_path:key,note:`checkin-v1:${createHash}`,created_at:now,updated_at:now,checkin_version:1}:{...current!,display_name:data?.name??current!.display_name,rating:data?data.rating:current!.rating,photo_path:key,updated_at:now,checkin_version:current!.checkin_version+1};
    const result={participant:action==='delete'?null:participantDto(next,env.CHECKIN_EVENT_ID),deleted:action==='delete'};
    const statement=action==='create'?env.DB.prepare(`INSERT INTO participants(id,event_id,display_name,rating,photo_path,face_crop_path,note,created_at,updated_at,checkin_version) VALUES(?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING`).bind(participantId,env.CHECKIN_EVENT_ID,data!.name,data!.rating,key,key,next.note,now,now):action==='update'?env.DB.prepare(`UPDATE participants SET display_name=?,rating=?,photo_path=?,face_crop_path=?,updated_at=?,checkin_version=checkin_version+1 WHERE id=? AND event_id=? AND checkin_version=? AND status='entered'`).bind(data!.name,data!.rating,key,key,now,participantId,env.CHECKIN_EVENT_ID,expected):env.DB.prepare("DELETE FROM participants WHERE id=? AND event_id=? AND checkin_version=? AND status='entered'").bind(participantId,env.CHECKIN_EVENT_ID,expected);
    await env.DB.batch([statement,env.DB.prepare(`INSERT INTO checkin_receipts(event_id,request_id,action,participant_id,request_hash,response_json) SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(env.CHECKIN_EVENT_ID,commandId,action,participantId,requestHash,JSON.stringify(result))]);
    const committed=await getReceipt(env,commandId);
    if(!committed)throw new ClientError('VERSION_CONFLICT',409);
    const saved=receiptValue(committed,action,requestHash);
    if(attempt)await retireAttempt(env,attempt); // no-op when the transaction linked this key
    const cleanupPending=await drainCleanup(env);
    return response({...saved,replayed:false,cleanupPending},cleanupPending?202:action==='create'?201:200);
  } catch(error) {
    // The staging guard serializes cleanup with late DB commits, preventing dangling portraits.
    if(attempt)await retireAttempt(env,attempt).catch(()=>{});
    const committed=await getReceipt(env,commandId).catch(()=>null);
    if(committed) {
      const saved=receiptValue(committed,action,requestHash);
      return response({...saved,replayed:true,cleanupPending:await drainCleanup(env)});
    }
    await drainCleanup(env).catch(()=>{});
    if(error instanceof ClientError)throw error;
    if(error instanceof Error && /CHECKIN_CLOSED|UPLOAD_EXPIRED/.test(error.message))throw new ClientError('CHECKIN_CLOSED',409);
    throw error;
  }
}
export async function readiness(env:CheckinEnv) {
  const checkin=await state(env), participants=await rows(env);
  const issues:{participantId?:string;code:string;message:string}[]=[];
  const minimum=Math.max(2,checkin.team_size*2);
  if(participants.length<minimum)issues.push({code:'TOO_FEW_PARTICIPANTS',message:`受付終了には${minimum}名以上が必要です（現在${participants.length}名）。`});
  if(checkin.team_size===2 && participants.length%2!==0)issues.push({code:'EVEN_PARTICIPANTS_REQUIRED',message:'今回のDraw接続は2名ペアのため、偶数人数で受付を終了してください。'});
  const names=new Set<string>();
  for(let offset=0;offset<participants.length;offset+=8) {
    await Promise.all(participants.slice(offset,offset+8).map(async participant=>{
      const name=participant.display_name.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('ja');
      if(!name||name.length>80)issues.push({participantId:participant.id,code:'INVALID_NAME',message:'名前が未入力または不正です。'});
      if(names.has(name))issues.push({participantId:participant.id,code:'DUPLICATE_NAME',message:`名前「${participant.display_name}」が重複しています。`});names.add(name);
      if(participant.rating!==null && (!Number.isFinite(participant.rating)||participant.rating<=0||participant.rating>30))issues.push({participantId:participant.id,code:'INVALID_RATING',message:'ratingが不正です。'});
      const object=participant.photo_path&&validKey(participant.photo_path,env.CHECKIN_EVENT_ID,participant.id)?await env.PORTRAITS.head(participant.photo_path):null;
      if(!object||!object.size||!Object.values(imageTypes).includes(object.httpMetadata?.contentType as typeof imageTypes[keyof typeof imageTypes]))issues.push({participantId:participant.id,code:'MISSING_PHOTO',message:`${participant.display_name}の保存写真がありません。`});
    }));
  }
  const cleanupPending=await pending(env);
  if(cleanupPending)issues.push({code:'CLEANUP_PENDING',message:'写真の保存または後処理が残っています。再試行してください。'});
  return {eventId:env.CHECKIN_EVENT_ID,title:checkin.title,status:checkin.status,revision:checkin.revision,closedAt:checkin.closed_at,count:participants.length,minimum,cleanupPending,issues,ready:issues.length===0,participants:participants.map(row=>participantDto(row,env.CHECKIN_EVENT_ID))};
}
async function close(env:CheckinEnv,body:Record<string,unknown>) {
  const id=requestId(body.requestId), expected=body.expectedRevision;
  if(!Number.isSafeInteger(expected)||Number(expected)<0)throw new ClientError('INVALID_VERSION',400);
  const requestHash=await hash(JSON.stringify(['close',expected]));
  const previous=await getReceipt(env,id);
  if(previous)return response({...receiptValue(previous,'close',requestHash),replayed:true});
  await drainCleanup(env);
  const report=await readiness(env);
  if(report.status==='closed')return response({closed:true,revision:report.revision,participants:report.participants});
  if(!report.ready)throw new ClientError('CHECKIN_NOT_READY',409,report);
  if(report.revision!==expected)throw new ClientError('VERSION_CONFLICT',409);
  const result={closed:true,revision:report.revision+1,participants:report.participants};
  await env.DB.batch([
    env.DB.prepare(`UPDATE checkin_state SET status='closed',revision=revision+1,closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),closed_roster=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE event_id=? AND status='open' AND revision=? AND NOT EXISTS(SELECT 1 FROM checkin_object_gc WHERE event_id=? AND phase<>'done')`).bind(JSON.stringify(report.participants),env.CHECKIN_EVENT_ID,expected,env.CHECKIN_EVENT_ID),
    env.DB.prepare(`INSERT INTO checkin_receipts(event_id,request_id,action,participant_id,request_hash,response_json) SELECT ?,?,'close',NULL,?,? WHERE changes()=1`).bind(env.CHECKIN_EVENT_ID,id,requestHash,JSON.stringify(result)),
  ]);
  if(!await getReceipt(env,id))throw new ClientError('VERSION_CONFLICT',409);
  return response(result);
}
export async function lifecycleRoute(request:Request,env:CheckinEnv):Promise<Response|null> {
  const url=new URL(request.url);
  if(url.pathname==='/api/checkin/state'&&request.method==='GET')return response(await readiness(env));
  if(url.pathname==='/api/checkin/close'&&request.method==='POST')return close(env,await readBody(request,1024));
  if(url.pathname==='/api/checkin/cleanup'&&request.method==='POST')return response({cleanupPending:await drainCleanup(env)});
  if(url.pathname==='/api/checkin/roster'&&request.method==='GET') {
    const checkin=await state(env);if(checkin.status!=='closed')throw new ClientError('CHECKIN_NOT_CLOSED',409);
    return response({eventId:env.CHECKIN_EVENT_ID,status:'closed',revision:checkin.revision,participants:JSON.parse(checkin.closed_roster)});
  }
  if(url.pathname==='/api/participants') {
    if(request.method==='POST')return mutate(env,'create',null,await readBody(request));
    if(request.method!=='GET')return response({error:'METHOD_NOT_ALLOWED'},405);
    const all=await rows(env,true),diagnostics=url.searchParams.get('includeTestData')==='1',checkin=await state(env);
    return response({eventId:env.CHECKIN_EVENT_ID,checkin:{status:checkin.status,revision:checkin.revision},excludedTestParticipants:diagnostics?0:all.filter(row=>row.id===AUTOMATED_CAMERA_TEST_ID).length,participants:all.filter(row=>diagnostics||row.id!==AUTOMATED_CAMERA_TEST_ID).map(row=>participantDto(row,env.CHECKIN_EVENT_ID))});
  }
  const participant=/^\/api\/participants\/(checkin-[a-f0-9-]{36})$/.exec(url.pathname);
  if(participant&&['PATCH','DELETE'].includes(request.method))return mutate(env,request.method==='PATCH'?'update':'delete',participant[1],await readBody(request));
  return null;
}
