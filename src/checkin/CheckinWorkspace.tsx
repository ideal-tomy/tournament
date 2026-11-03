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
  const command=useRef<{path:string;method:string;body:unknown}|null>(null);
  const refreshing=useRef(0);
  const refresh=useCallback(async()=>{
    const generation=++refreshing.current;
    try {const value=await api<Report>('/api/checkin/state');if(generation===refreshing.current){setReport(value);setError('');}}
    catch(reason){if(generation===refreshing.current){setError(reason instanceof Error?reason.message:'取得できませんでした。');if(reason instanceof ApiError&&reason.status===401)onAuthRequired();}}
  },[onAuthRequired]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},5000);return()=>{clearInterval(timer);refreshing.current++;};},[refresh,sessionVersion,refreshVersion]);
  function saved(participant:Participant,cleanupPending:number){
    refreshing.current++;
    setReport(previous=>previous?{...previous,participants:[...previous.participants.filter(p=>p.id!==participant.id),participant],count:previous.count+(editing?0:1),ready:false}:previous);
    setEditing(undefined);setFormVersion(v=>v+1);setMessage(`${participant.name}を保存しました。${cleanupPending?'写真の後処理が残っています。再試行してください。':'次の参加者を登録できます。'}`);setRefreshVersion(v=>v+1);
  }
  async function execute(path:string,method:string,body:unknown){
    if(busy)return;command.current={path,method,body};setBusy(true);setError('');
    try {const result=await api<{cleanupPending?:number}>(path,{method,body:JSON.stringify(body)});command.current=null;setMessage(result.cleanupPending?'写真の後処理が残っています。「写真の後処理を再試行」を押してください。':'処理が完了しました。');await refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'処理できませんでした。');if(reason instanceof ApiError){if(reason.status===401)onAuthRequired();else if(reason.status<500){command.current=null;await refresh();setError(reason.message);}}}
    finally{setBusy(false);}
  }
  const closed=report?.status==='closed';
  return <>
    <RunContextBanner role="checkin" sessionVersion={sessionVersion} />
    {message&&<p className="card" role="status">{message}</p>}
    {error&&<p className="card error" role="alert">{error}</p>}
    {command.current&&!busy&&<button onClick={()=>{const c=command.current!;void execute(c.path,c.method,c.body);}}>同じ操作を再試行</button>}
    {report&&!closed&&!command.current&&<CheckinPage key={`${editing?.id??'new'}-${formVersion}`} participant={editing} onSaved={saved} onCancel={()=>setEditing(undefined)} onAuthRequired={onAuthRequired}/>}
    <section className="card"><h1>{closed?'受付完了':'登録済み参加者'} <span data-testid="participant-count">{report?.count??0}名</span></h1>
      <button onClick={()=>void refresh()}>一覧を更新</button>
      {!report&&<p>受付状況を確認しています…</p>}
      <div className="participants">{report?.participants.map(participant=><article className="participant" key={participant.id} data-participant-id={participant.id}>
        <ParticipantPhoto key={`${participant.id}-${participant.version}-${sessionVersion}-${refreshVersion}`} participant={participant} refreshKey={`${sessionVersion}-${refreshVersion}`} onRetry={()=>setRefreshVersion(v=>v+1)}/>
        <div><h2>{participant.name}</h2><p>rating {participant.rating??'未入力'}</p>
          {!closed&&<div className="actions"><button disabled={busy||!!command.current} onClick={()=>{setEditing(participant);setError('');window.scrollTo({top:0,behavior:'smooth'});}}>編集</button><button disabled={busy||!!command.current||!!editing} onClick={()=>{if(window.confirm(`「${participant.name}」の登録と保存写真を削除しますか？`))void execute(`/api/participants/${participant.id}`,'DELETE',{requestId:crypto.randomUUID(),expectedVersion:participant.version});}}>削除</button></div>}
          <a className="button" href={scopedUrl(`/show-preview?participant=${encodeURIComponent(participant.id)}`)}>この参加者で演出確認</a>
        </div></article>)}</div>
    </section>
    {report&&<section className="card"><h2>{closed?'大会運営へ':'受付終了の確認'}</h2>
      {closed?<><p>受付完了済みの{report.count}名を大会運営・Display・演出で共通利用できます。</p><a className="button" href={scopedUrl('/admin')}>運営確認を開く</a></>:<>
        <p>人数・必須情報・重複・R2保存写真を確認し、問題がなければ受付を終了します。終了後は登録・編集・削除を停止します。</p>
        <ul>{report.issues.map((issue,index)=><li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
        {report.cleanupPending>0&&<button disabled={busy} onClick={()=>void execute('/api/checkin/cleanup','POST',{})}>写真の後処理を再試行</button>}
        <button className="primary" disabled={busy||!report.ready||!!editing||!!command.current} onClick={()=>{if(window.confirm(`${report.count}名で受付を終了しますか？終了後は変更できません。`))void execute('/api/checkin/close','POST',{requestId:crypto.randomUUID(),expectedRevision:report.revision});}}>受付終了</button>
      </>}
    </section>}
  </>;
}
