import {sample} from './rehearsalSamples';
import {rehearsalTiming,type RehearsalTimingPreset} from '../lib/rehearsalTiming';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Participant } from './api';
import DrawControl, { type DrawState } from './DrawControl';
import SharedRunOverview from './SharedRunOverview';

export type Status=DrawState&{integrity:{consistent:boolean;matchCount:number};flow:(NonNullable<DrawState['flow']>&{nextMatch?:{id:number;teamA:string;teamB:string}|null})|null};
type Command={path:string;body:{requestId:string;expectedVersion?:number;expectedRevision?:number;winnerSlot?:number}};
type Registration={requestId:string;name:string;rating:number|null;photo:string};
const runId=()=>new URLSearchParams(location.search).get('run');
const pendingKey=()=>`through-command:${runId()}`;
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function readStatus(){for(let attempt=0;attempt<3;attempt++){try{return await api<Status>('/api/rehearsal/status');}catch(e){if(!(e instanceof ApiError)||e.code!=='VERSION_CONFLICT')throw e;}}throw new Error('大会状態の更新が競合しました。停止して状態を確認してください。');}
async function portraits(participants:Participant[]){if(participants.length<4||participants.length%2)throw Error('写真付き参加者を4名以上の偶数人数で準備してください。');await Promise.all(participants.map(p=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>image.decode().then(()=>resolve(),()=>reject(Error(`${p.name}の写真を読み込めません。`)));image.onerror=()=>reject(Error(`${p.name}の写真を取得できません。`));image.src=p.portraitUrl;})));}
export default function RehearsalPage({onAuthRequired,sessionVersion}:{onAuthRequired():void;sessionVersion:number}){
 const [enabled,setEnabled]=useState<boolean|null>(null),[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[step,setStep]=useState(runId()?'保存済み大会を確認しています':'大会を初期化してください'),[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[mode,setMode]=useState<'empty'|'sample32'|'sample'|'registered'>('empty'),[revision,setRevision]=useState(0);
 const [preset,setPreset]=useState<RehearsalTimingPreset>('show');
 const failureStep=useRef('初期化');
 const active=useRef(false),lock=useRef(false),mounted=useRef(true),matchSince=useRef<{id:number;at:number}|null>(null);
 const fail=useCallback((reason:unknown)=>{active.current=false;setRunning(false);setError(`${reason instanceof Error?reason.message:'リハーサルに失敗しました。'}（停止位置：${failureStep.current}）`);if(reason instanceof ApiError&&reason.status===401)onAuthRequired();},[onAuthRequired,step]);
 useEffect(()=>{mounted.current=true;api<{enabled:boolean}>('/api/rehearsal/config').then(c=>setEnabled(c.enabled)).catch(e=>{if(e instanceof ApiError&&e.status===404)setEnabled(false);else fail(e);});return()=>{mounted.current=false;active.current=false;};},[sessionVersion]);
 useEffect(()=>{if(!enabled||!runId())return;let stopped=false,fetching=false;const poll=async()=>{if(fetching)return;fetching=true;try{const next=await readStatus();if(!stopped){setStatus(next);setStep(previous=>previous==='保存済み大会を確認しています'?(next.scene==='finished'?'CHAMPION・大会終了':'保存済み大会から確認を続けられます。'):previous);if(!next.integrity.consistent)throw Error('D1の試合・Bracket・現在試合が一致しません。');}}catch(e){if(!stopped)fail(e);}finally{fetching=false;}};void poll();const timer=setInterval(()=>void poll(),1000);return()=>{stopped=true;clearInterval(timer);};},[enabled,revision,sessionVersion]);
 async function initialize(){if(lock.current||active.current)return;if(runId()&&!window.confirm('現在の大会を保持したまま、新しいリハーサル大会を作りますか？'))return;lock.current=true;setBusy(true);setError('');setStep('参加者準備');failureStep.current='参加者準備';
  try{
   const saved=localStorage.getItem('through-initialization');let pending=saved?JSON.parse(saved) as {requestId:string;people:Registration[];format?:string;timingPreset?:RehearsalTimingPreset}:null;
   if(!pending){let people:Registration[]=[];
    if(mode==='sample'||mode==='sample32')people=Array.from({length:mode==='sample32'?32:8},(_,i)=>sample(i));else if(mode==='registered'){const source=await api<{participants:Participant[]}>('/api/rehearsal/source');await portraits(source.participants);people=[];for(const p of source.participants){const r=await fetch(p.portraitUrl,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error(`${p.name}の写真取得に失敗しました。`);const photo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;void r.blob().then(blob=>reader.readAsDataURL(blob),reject);});people.push({requestId:crypto.randomUUID(),name:p.name,rating:p.rating,photo});}}
    pending={requestId:crypto.randomUUID(),people,format:mode==='sample32'||mode==='empty'?'single_elimination':'double_elimination',timingPreset:preset};localStorage.setItem('through-initialization',JSON.stringify(pending));
   }
   const created=await api<{eventId:string}>('/api/rehearsal/create',{method:'POST',body:JSON.stringify({requestId:pending.requestId,format:pending.format,timingPreset:pending.timingPreset})});const url=new URL(location.href);url.searchParams.set('run',created.eventId);history.replaceState(null,'',url);setRevision(v=>v+1);
   for(const person of pending.people){failureStep.current=person.name+'の登録';await api('/api/participants',{method:'POST',body:JSON.stringify(person)});}
   const next=await readStatus();if(next.participants.length)await portraits(next.participants);if(!next.integrity.consistent)throw Error('D1整合性を確認できません。');setStatus(next);localStorage.removeItem('through-initialization');setStep(next.participants.length?'参加者準備完了・受付中':'大会準備完了・参加者受付を開いて登録してください');
  }catch(e){fail(e);}finally{lock.current=false;setBusy(false);}
 }
 async function execute(command:Command){failureStep.current=command.path;localStorage.setItem(pendingKey(),JSON.stringify(command));await api(command.path,{method:'POST',body:JSON.stringify(command.body)});localStorage.removeItem(pendingKey());}
 async function start(){if(lock.current||active.current||!runId())return;lock.current=true;active.current=true;setRunning(true);setError('');setStep('自動通し確認');
  try{
   failureStep.current='写真と大会状態の確認';let s=await readStatus();if(!s.integrity.consistent)throw Error('D1整合性エラー');await portraits(s.participants);
   const saved=localStorage.getItem(pendingKey());if(saved)await execute(JSON.parse(saved) as Command);
   while(active.current&&mounted.current){failureStep.current='大会状態・D1整合性の確認';s=await readStatus();if(!s.integrity.consistent)throw Error('D1整合性エラー');setStatus(s);setStep(`${s.scene} / Match ${s.flow?.currentMatch?.id??'-'}`);if(s.scene==='vs_card'&&(!s.flow?.currentMatch?.teamA||!s.flow.currentMatch.teamB))throw Error('次の試合の対戦相手が確定していません。');if(s.scene==='finished'){if(!s.flow?.championTeamId)throw Error('優勝者のない終了状態です。');setStep('CHAMPION・大会終了');break;}
    let command:Command|null=null;const body={requestId:crypto.randomUUID(),expectedVersion:s.version};
    if(s.checkinStatus==='open')command={path:'/api/checkin/close',body:{requestId:crypto.randomUUID(),expectedRevision:s.checkinRevision}};
    else if(!s.session)throw Error('ペア確定が完了していません。受付終了を運営画面で再試行してください。');
    else if(s.scene==='idle')command={path:'/api/draw/start',body};
    else if(s.flow?.canAdvance)command={path:'/api/tournament/advance',body};
    else if(s.flow?.canGameStart)command={path:'/api/tournament/game-start',body};
    else if(s.flow?.canStart&&s.elapsedSeconds>=s.durationSec+rehearsalTiming(s.timingPreset).vsHold)command={path:'/api/tournament/start',body};
    else if(s.scene==='match_live'){const id=s.flow?.currentMatch?.id;if(id==null)throw Error('現在の試合がありません。');if(matchSince.current?.id!==id)matchSince.current={id,at:Date.now()};if(Date.now()-matchSince.current.at>=rehearsalTiming(s.timingPreset).match*1000)command={path:'/api/tournament/winner',body:{...body,winnerSlot:0}};}
    else if(!['draw','bracket','vs_card','result','award'].includes(s.scene))throw Error(`未対応の大会状態：${s.scene}`);
    if(command&&active.current){try{await execute(command);}catch(e){if(command.path==='/api/tournament/advance'&&e instanceof ApiError&&e.code==='VERSION_CONFLICT'){localStorage.removeItem(pendingKey());}else throw e;}}
    await delay(500);
   }
  }catch(e){fail(e);}finally{active.current=false;lock.current=false;if(mounted.current)setRunning(false);}
 }
 if(enabled===null)return <p className="loading">リハーサル環境を確認しています…{error}</p>;
 if(!enabled)return <section className="card"><h1>大会通しリハーサル</h1><a className="button" href="https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal">専用リハーサル環境を開く</a></section>;
 return <div className="rehearsal-workspace">
  <section className="card">
   <p className="eyebrow">ONE EVENT / SHARED STATE</p><h1>大会の全体確認</h1>
   <p>一つの大会をスマホ受付・PC運営・会場Displayで共有します。進行状態は同じ大会IDを使って取得します。</p>
   {!runId()&&<>
    <label className="field">確認する大会<select value={mode} disabled={busy||running} onChange={e=>setMode(e.target.value as typeof mode)}><option value="empty">実データの受付を試す（参加者0名から）</option><option value="sample32">全演出を通す（サンプル32名・16チーム・15試合）</option><option value="sample">サンプル8名（ダブル方式）</option><option value="registered">登録済み参加者をコピーして試す</option></select></label>
    <p>準備すると新しい大会を作ります。既存大会・写真・結果は保持します。サンプル写真・自動勝者は実在人物・実試合の記録ではありません。</p>
    <label className="field">演出時間<select value={preset} disabled={busy||running} onChange={e=>setPreset(e.target.value as RehearsalTimingPreset)}><option value="show">SHOW（会場表示を確認）</option><option value="fast">FAST CHECK（全演出を短時間で確認）</option></select></label>
    <button className="primary" disabled={busy||running} onClick={()=>void initialize()}>新しい確認用大会を準備</button>
   </>}
   {status&&<SharedRunOverview status={status}/>}
   {error&&<p role="alert" className="error">{error}</p>}
   <p role="status">{step}{running?' · 自動実行中':''}</p>
   {status&&<details className="automation"><summary>自動全通し（模擬勝者を記録）</summary><p>確認用の機能です。受付を終了して全試合を進め、各回Team Aの勝利を大会に記録します。実際の参加者・結果を扱う大会では開始しないでください。</p><div className="actions"><button className="primary" disabled={busy||running||status.scene==='finished'||status.participants.length<4||status.participants.length%2!==0} onClick={()=>void start()}>自動全通しを開始・再開</button><button disabled={!running} onClick={()=>{active.current=false;setRunning(false);setStep('一時停止・同じ大会から再開できます');}}>一時停止</button></div></details>}
  </section>
  {status&&<section className="manual-operations"><h2>実データを手動で操作</h2><p>登録した参加者を使う場合は自動全通しを開始せず、Adminで受付終了・ペア発表・試合開始・実際の勝者を順に操作してください。</p><fieldset disabled={running||busy}><DrawControl key={status.eventId+'-'+sessionVersion} administration automaticAdvance={!running} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion}/></fieldset></section>}
 </div>;
}
