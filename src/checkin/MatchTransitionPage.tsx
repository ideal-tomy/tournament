import {useEffect,useRef,useState} from 'react';
import {api,ApiError,scopedUrl} from './api';
import {sample} from './rehearsalSamples';
import DisplayPage from './DisplayPage';
import DrawControl,{type DrawState} from './DrawControl';
import FlowPresentation from './FlowPresentation';

export default function MatchTransitionPage({onAuthRequired,sessionVersion}:{onAuthRequired():void;sessionVersion:number}){
 const [enabled,setEnabled]=useState(false),[run,setRun]=useState(new URLSearchParams(location.search).get('run')),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{api<{enabled:boolean}>('/api/rehearsal/config').then(c=>setEnabled(c.enabled)).catch(()=>setEnabled(false));},[]);
 async function prepare(){if(busy)return;if(run&&!window.confirm('現在の大会を保持し、新しい確認用大会を準備しますか？'))return;setBusy(true);setError('');
  try{
   setMessage('既存の受付APIで確認用の8名を準備しています。');const created=await api<{eventId:string}>('/api/rehearsal/create',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID()})});
   const url=new URL(location.href);url.searchParams.set('run',created.eventId);history.replaceState(null,'',url);setRun(created.eventId);
   for(let i=0;i<8;i++)await api('/api/participants',{method:'POST',body:JSON.stringify(sample(i))});
   let state=await api<DrawState>('/api/draw/state');await api('/api/checkin/close',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:state.checkinRevision})});state=await api<DrawState>('/api/draw/state');await api('/api/draw/start',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),expectedVersion:state.version})});
   setMessage('既存Draw・Bracket・第1試合を準備中です（約2分）。勝者はまだ確定しません。');
   const deadline=Date.now()+180000;
   while(Date.now()<deadline){state=await api<DrawState>('/api/draw/state');if(state.scene==='match_live'){setMessage('勝者確定直前です。下の運営操作で勝者を選び、Displayを確認してください。');return;}
    const action=state.flow?.canAdvance?'advance':state.flow?.canGameStart?'game-start':state.flow?.canStart?'start':null;
    if(action){try{await api(`/api/tournament/${action}`,{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),expectedVersion:state.version})});}catch(e){if(!(e instanceof ApiError&&e.code==='VERSION_CONFLICT'))throw e;}}
    await new Promise(resolve=>setTimeout(resolve,500));
   }throw Error('試合準備が時間内に完了しませんでした。表示状態を確認してください。');
  }catch(e){setError(e instanceof Error?e.message:'準備に失敗しました。');}finally{setBusy(false);}
 }
 return <div className="match-transition"><h1>試合結果 → 次試合 演出確認</h1><p>本番Displayと同じ描画で、WINNER → 実Bracket進出 → NEXT MATCH / VSを確認します。</p>
  <div className="transition-controls">{enabled?<button disabled={busy} onClick={()=>void prepare()}>確認用の1試合を準備</button>:<a className="button" href="https://tournament-through-rehearsal.pine-shaken.workers.dev/match-transition">専用確認環境を開く</a>}{run&&<a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">本番Displayを別ウィンドウで開く</a>}</div><p role="status">{message}</p>{error&&<p role="alert">{error}</p>}
  {run&&enabled&&<MatchReview key={run} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} preparing={busy}/>}
 </div>;
}
function MatchReview({onAuthRequired,sessionVersion,preparing}:{onAuthRequired():void;sessionVersion:number;preparing:boolean}){
 const [state,setState]=useState<DrawState|null>(null),[replayState,setReplayState]=useState<DrawState|null>(null),[error,setError]=useState(''),[replay,setReplay]=useState(false),[paused,setPaused]=useState(true),[time,setTime]=useState(0);const last=useRef(0);
 useEffect(()=>{let disposed=false,fetching=false;const poll=async()=>{if(fetching)return;fetching=true;try{const next=await api<DrawState>('/api/draw/state');if(!disposed)setState(previous=>previous?.version===next.version?previous:next);}catch(e){if(!disposed){setPaused(true);setError(e instanceof Error?e.message:'状態を取得できません。');}}finally{fetching=false;}};void poll();const timer=setInterval(()=>void poll(),500);return()=>{disposed=true;clearInterval(timer);};},[]);
 useEffect(()=>{if(paused||!replay)return;last.current=performance.now();const timer=setInterval(()=>{const now=performance.now(),delta=(now-last.current)/1000;last.current=now;setTime(t=>Math.min(16.5,t+delta));},33);return()=>clearInterval(timer);},[paused,replay]);
 const base=replay?replayState:state;
 const metadata=base?.flow?.resultPresentation;
 let shown=state,localTime=0;
 if(replay&&base&&metadata){const phase=time<1?'match_live':time<7?'result':time<13?'bracket':'vs_card';localTime=phase==='match_live'?0:phase==='result'?time-1:phase==='bracket'?time-7:time-13;
  shown={...base,scene:phase,sceneSeq:base.sceneSeq+(phase==='match_live'?1:phase==='result'?2:phase==='bracket'?3:4),elapsedSeconds:localTime,bracket:phase==='match_live'?metadata.beforeBracket:base.bracket,flow:{...base.flow!,phase:phase==='bracket'?'bracket_update':phase,currentMatch:phase==='match_live'?metadata.match:phase==='vs_card'?base.flow!.currentMatch:null,canScore:false,canStart:phase==='vs_card'&&localTime>=3.5}};
 }
 return <><div className="transition-controls"><button disabled={!metadata||!['vs_card','match_live'].includes(state?.scene??'')||state?.flow?.currentMatch?.id===metadata.match.id||preparing} onClick={()=>{setReplayState(state);setTime(0);setReplay(true);setPaused(false);}}>最初から再生</button><button disabled={!replay||paused} onClick={()=>setPaused(true)}>一時停止</button><button disabled={!replay||!paused||time>=16.5} onClick={()=>setPaused(false)}>再開</button><button disabled={!replay} onClick={()=>{setReplay(false);setPaused(true);}}>ライブ表示へ戻る</button></div>
  <p role="status">{replay?`保存済み結果の読み取り専用再生 ${time.toFixed(1)}秒 / ${time>=16.5?'NEXT MATCH・試合開始待ち':paused?'一時停止':'再生中'}`:`ライブ：${state?.scene??'読込中'}`}</p>{error&&<p role="alert">{error}</p>}
  {replay&&shown?<div className="tournament-stage" data-review-scene={shown.scene}><FlowPresentation key={shown.sceneSeq} state={shown} controlledTime={localTime}/></div>:<DisplayPage onAuthRequired={onAuthRequired} sessionVersion={sessionVersion}/>}
  {!replay&&<fieldset disabled={preparing}><legend>実際の運営操作</legend><DrawControl administration onAuthRequired={onAuthRequired} sessionVersion={sessionVersion}/></fieldset>}
 </>;
}
