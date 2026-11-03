import { useCallback, useEffect, useRef, useState } from 'react';
import CheckinPage from './CheckinPage';
import ParticipantPhoto from './ParticipantPhoto';
import RunContextBanner from './RunContextBanner';
import { api, ApiError, scopedUrl, type Participant } from './api';

interface Report { status:'open'|'closed'; revision:number; count:number; ready:boolean; cleanupPending:number; issues:{code:string;message:string}[]; participants:Participant[] }
export default function CheckinWorkspace({onAuthRequired,sessionVersion}:{onAuthRequired():void;sessionVersion:number}) {
  const [report,setReport]=useState<Report|null>(null);
  const [editing,setEditing]=useState<Participant>();
  const [formVersion,setFormVersion]=useState(0);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [refreshVersion,setRefreshVersion]=useState(0);
  const [closing,setClosing]=useState(false);
  const command=useRef<{path:string;method:string;body:unknown}|null>(null);
  const refreshing=useRef(0);
  const refresh=useCallback(async()=>{
    const generation=++refreshing.current;
    try {const value=await api<Report>('/api/checkin/state');if(generation===refreshing.current){setReport(value);setError('');}}
    catch(reason){if(generation===refreshing.current){setError(reason instanceof Error?reason.message:'取得できませんでした。');if(reason instanceof ApiError&&reason.status===401)onAuthRequired();}}
  },[onAuthRequired]);
  useEffect(()=>{
    void refresh();
    const timer=setInterval(()=>{if(!document.hidden)void refresh();},5000);
    const look=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',look);window.addEventListener('pageshow',look);
    return()=>{clearInterval(timer);refreshing.current++;document.removeEventListener('visibilitychange',look);window.removeEventListener('pageshow',look);};
  },[refresh,sessionVersion,refreshVersion]);
  useEffect(()=>{if(!closing)return;const timer=setTimeout(()=>setClosing(false),4000);return()=>clearTimeout(timer);},[closing]);
  function saved(participant:Participant,cleanupPending:number){
    refreshing.current++;
    setReport(previous=>previous?{...previous,participants:[...previous.participants.filter(p=>p.id!==participant.id),participant],count:previous.count+(editing?0:1),ready:false}:previous);
    setEditing(undefined);setFormVersion(v=>v+1);setMessage(`${participant.name}さんを登録しました。${cleanupPending?'写真の後処理が残っています。':''}`);setRefreshVersion(v=>v+1);
  }
  async function execute(path:string,method:string,body:unknown){
    if(busy)return;command.current={path,method,body};setBusy(true);setError('');
    try {const result=await api<{cleanupPending?:number}>(path,{method,body:JSON.stringify(body)});command.current=null;setMessage(result.cleanupPending?'写真の後処理が残っています。「写真の後処理を再試行」を押してください。':'');await refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'処理できませんでした。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500){command.current=null;await refresh();setError(reason.message);}}}
    finally{setBusy(false);}
  }
  const closed=report?.status==='closed';
  const people=[...(report?.participants??[])].reverse();
  return <>
    <RunContextBanner role="checkin" sessionVersion={sessionVersion} compact />
    {message&&<p className="card ok" role="status">{message}</p>}
    {error&&<p className="card error" role="alert">{error}</p>}
    {command.current&&!busy&&<button onClick={()=>{const c=command.current!;void execute(c.path,c.method,c.body);}}>同じ操作を再試行</button>}
    {closed&&<section className="card checkin-closed"><h1>受付終了 · {report.count}名</h1><a className="button primary submit" href={scopedUrl('/admin')}>組み合わせへ</a></section>}
    {report&&!closed&&!command.current&&<CheckinPage key={`${editing?.id??'new'}-${formVersion}`} participant={editing} onSaved={saved} onCancel={()=>setEditing(undefined)} onAuthRequired={onAuthRequired}/>}
    {report&&!closed&&<section className="card checkin-close" id="close">
      <div className="checkin-close-head"><h2>{report.count}名 受付中</h2>
        <button className={closing?'primary is-armed':'primary'} disabled={busy||!report.ready||!!editing||!!command.current} onClick={()=>{if(closing){setClosing(false);void execute('/api/checkin/close','POST',{requestId:crypto.randomUUID(),expectedRevision:report.revision});}else setClosing(true);}}>{closing?'もう一度押すと締め切る':'受付終了'}</button>
      </div>
      {report.issues.length>0&&<ul className="checkin-issues">{report.issues.map((issue,index)=><li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}
      {report.cleanupPending>0&&<button disabled={busy} onClick={()=>void execute('/api/checkin/cleanup','POST',{})}>写真の後処理を再試行</button>}
    </section>}
    <section className="card checkin-list"><div className="checkin-list-head"><h2>登録済み</h2><button onClick={()=>void refresh()}>更新</button></div>
      {!report&&<p>読み込み中…</p>}
      <div className="participants">{people.map(participant=><article className="participant" key={participant.id} data-participant-id={participant.id}>
        <ParticipantPhoto key={`${participant.id}-${participant.version}-${sessionVersion}-${refreshVersion}`} participant={participant} refreshKey={`${sessionVersion}-${refreshVersion}`} onRetry={()=>setRefreshVersion(v=>v+1)}/>
        <div><h3>{participant.name}</h3>{participant.rating!=null&&<p>rating {participant.rating}</p>}
          {!closed&&<div className="actions"><button disabled={busy||!!command.current} onClick={()=>{setEditing(participant);setError('');window.scrollTo({top:0,behavior:'smooth'});}}>編集</button><button disabled={busy||!!command.current||!!editing} onClick={()=>{if(window.confirm(`「${participant.name}」の登録を削除しますか？`))void execute(`/api/participants/${participant.id}`,'DELETE',{requestId:crypto.randomUUID(),expectedVersion:participant.version});}}>削除</button></div>}
        </div></article>)}</div>
    </section>
  </>;
}
