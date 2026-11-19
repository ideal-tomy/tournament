import {PROGRESSION_HARNESS} from '../lib/progressionHarness';
import {type RehearsalTimingPreset} from '../lib/rehearsalTiming';
import {nextRehearsalCommand} from './rehearsalAutoplay';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, scopedUrl, type Participant } from './api';
import DrawControl, { type DrawState } from './DrawControl';
import SharedRunOverview from './SharedRunOverview';

export type Status=DrawState&{integrity:{consistent:boolean;matchCount:number};flow:(NonNullable<DrawState['flow']>&{nextMatch?:{id:number;teamA:string;teamB:string}|null})|null};
type Command={path:string;body:{requestId:string;expectedVersion?:number;expectedRevision?:number;winnerSlot?:number;mode?:'auto'}};
const runId=()=>new URLSearchParams(location.search).get('run');
const pendingKey=()=>`through-command:${runId()}`;
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function retryableNetwork(reason:unknown){
 return !(reason instanceof ApiError)&&(reason instanceof Error&&(reason.name==='AbortError'||reason.message.includes('通信できません')));
}
async function readStatus(){
 for(let attempt=0;attempt<8;attempt++){
  try{return await api<Status>('/api/rehearsal/status');}
  catch(e){
   if(e instanceof ApiError&&e.code==='VERSION_CONFLICT'&&attempt<7)continue;
   if(retryableNetwork(e)&&attempt<7){await delay(350*(attempt+1));continue;}
   throw e;
  }
 }
 throw new Error('大会状態の更新が競合しました。停止して状態を確認してください。');
}
function portraitRequestUrl(participant:Participant){
 return scopedUrl(`${participant.portraitUrl}?version=${participant.version}`);
}
function progressionHarnessRoster(participants:Participant[]){
 return participants.length>=8&&participants.every(p=>/^進行テスト\s+\d{3}$/.test(p.name.trim()));
}
async function portraits(participants:Participant[],instant:boolean){
 if(participants.length<4||participants.length%2)throw Error('偶数人数の参加者が必要です。');
 if(instant||progressionHarnessRoster(participants)){
  const response=await fetch(portraitRequestUrl(participants[0]),{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('保存写真APIを確認できません。');
  return;
 }
 await Promise.all(participants.map(p=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>image.decode().then(()=>resolve(),()=>reject(Error(`${p.name}の写真を読み込めません。`)));image.onerror=()=>reject(Error(`${p.name}の写真を取得できません。`));image.src=portraitRequestUrl(p);})));
}
export default function RehearsalPage({pressMode=false,onAuthRequired,sessionVersion}:{pressMode?:boolean;onAuthRequired():void;sessionVersion:number}){
 const [enabled,setEnabled]=useState<boolean|null>(null),[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[step,setStep]=useState(runId()?'保存済み大会を確認しています':'大会を初期化してください'),[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [preset,setPreset]=useState<RehearsalTimingPreset>('show');
 const [allowInstant,setAllowInstant]=useState(false);
 const [prepareBusy,setPrepareBusy]=useState(false);
 const failureStep=useRef('初期化');
 const active=useRef(false),lock=useRef(false),mounted=useRef(true),matchSince=useRef<{id:number;at:number}|null>(null);
 const autoplayGoal=useRef<number|null>(null);
 const autoPrepare=useRef(false);
 useEffect(()=>{
  if(!pressMode||!enabled||!allowInstant||runId()||prepareBusy||busy||running||autoPrepare.current)return;
  autoPrepare.current=true;
  void prepareProgression();
 // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回だけ自動準備
 },[pressMode,enabled,allowInstant,prepareBusy,busy,running]);
 const fail=useCallback((reason:unknown)=>{active.current=false;setRunning(false);setError(`${reason instanceof Error?reason.message:'リハーサルに失敗しました。'}（停止位置：${failureStep.current}）`);if(reason instanceof ApiError&&reason.status===401)onAuthRequired();},[onAuthRequired,step]);
 useEffect(()=>{mounted.current=true;api<{enabled:boolean;allowInstant?:boolean}>('/api/rehearsal/config').then(c=>{setEnabled(c.enabled);setAllowInstant(!!c.allowInstant);if(c.allowInstant)setPreset(previous=>previous==='show'?'instant':previous);}).catch(e=>{if(e instanceof ApiError&&e.status===404)setEnabled(false);else fail(e);});return()=>{mounted.current=false;active.current=false;};},[sessionVersion]);
 useEffect(()=>{if(!enabled||!runId())return;let stopped=false,fetching=false;const poll=async()=>{if(fetching)return;fetching=true;try{const next=await readStatus();if(!stopped){setStatus(next);setStep(previous=>previous==='保存済み大会を確認しています'?(next.scene==='finished'?'CHAMPION・大会終了':'保存済み大会から確認を続けられます。'):previous);if(!next.integrity.consistent)throw Error('D1の試合・Bracket・現在試合が一致しません。');}}catch(e){if(!stopped)fail(e);}finally{fetching=false;}};void poll();const timer=setInterval(()=>void poll(),1000);return()=>{stopped=true;clearInterval(timer);};},[enabled,revision,sessionVersion]);
 async function initialize(){if(lock.current||active.current)return;if(runId()&&!window.confirm('現在の大会を保持したまま、新しいリハーサル大会を作りますか？'))return;lock.current=true;setBusy(true);setError('');setStep('参加者準備');failureStep.current='参加者準備';
  try{
   const key='through-empty-initialization-v2';
   const saved=localStorage.getItem(key);
   const pending=saved?JSON.parse(saved) as {requestId:string;format:string;timingPreset:RehearsalTimingPreset}:{requestId:crypto.randomUUID(),format:'single_elimination',timingPreset:preset};
   localStorage.setItem(key,JSON.stringify(pending));
   const created=await api<{eventId:string}>('/api/rehearsal/create',{method:'POST',body:JSON.stringify({requestId:pending.requestId,format:pending.format,timingPreset:pending.timingPreset})});const url=new URL(location.href);url.searchParams.set('run',created.eventId);history.replaceState(null,'',url);setRevision(v=>v+1);
   const next=await readStatus();if(next.participants.length)await portraits(next.participants,next.timingPreset==='instant');if(!next.integrity.consistent)throw Error('D1整合性を確認できません。');setStatus(next);localStorage.removeItem(key);setStep(next.participants.length?'参加者準備完了・受付中':'大会準備完了・参加者受付を開いて登録してください');
  }catch(e){fail(e);}finally{lock.current=false;setBusy(false);}
 }
 async function prepareProgression(){if(lock.current||active.current||!allowInstant)return;lock.current=true;setPrepareBusy(true);setError('');setStep('進行テストを準備');failureStep.current='進行テスト準備';
  try{
   const prepared=await api<{eventId:string;portraitSource?:'database'|'synthetic';portraitTemplates?:number;teams?:number;courts?:number}>('/api/rehearsal/prepare-progression',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),format:PROGRESSION_HARNESS.format,title:PROGRESSION_HARNESS.title,teams:PROGRESSION_HARNESS.teams,courts:PROGRESSION_HARNESS.courts})});
   const url=new URL(location.href);url.searchParams.set('run',prepared.eventId);history.replaceState(null,'',url);setRevision(v=>v+1);
   const next=await readStatus();if(!next.integrity.consistent)throw Error('D1整合性を確認できません。');setStatus(next);
   const portraitNote=prepared.portraitSource==='database'?` DBの写真 ${prepared.portraitTemplates ?? '?' } 種をコピー済み。`:' ローカルDBに写真が無いため最小JPEGを使用。①受付（`?run=cf-local-entry`）で実写真を登録してから再準備するとDisplayも通ります。';
   const teams=prepared.teams??PROGRESSION_HARNESS.teams;
   const courts=prepared.courts??PROGRESSION_HARNESS.courts;
   setStep(`${teams}チーム（${teams*2}名）・ダブルイリミ・${courts}台の進行テスト準備完了。②運営で台を進めてください。${portraitNote}`);
  }catch(e){fail(e);}finally{lock.current=false;setPrepareBusy(false);}
 }
 async function execute(command:Command){
 failureStep.current=command.path;
 localStorage.setItem(pendingKey(),JSON.stringify(command));
 for(let attempt=0;attempt<6;attempt++){
  try{await api(command.path,{method:'POST',body:JSON.stringify(command.body)});localStorage.removeItem(pendingKey());return;}
  catch(e){
   if(retryableNetwork(e)&&attempt<5){await delay(400*(attempt+1));continue;}
   throw e;
  }
 }
}
 async function runAutoplay(goal:'partial'|'full'){
  if(lock.current||active.current||!runId())return;
  autoplayGoal.current=goal==='partial'?PROGRESSION_HARNESS.partialMatchGoal:null;
  lock.current=true;active.current=true;setRunning(true);setError('');
  setStep(goal==='partial'?`部分自動（${PROGRESSION_HARNESS.partialMatchGoal}試合まで）`:'全体自動（大会終了まで）');
  try{
   failureStep.current='写真と大会状態の確認';
   let s=await readStatus();
   if(!s.integrity.consistent)throw Error('D1整合性エラー');
   await portraits(s.participants,s.timingPreset==='instant');
   const saved=localStorage.getItem(pendingKey());
   if(saved)await execute(JSON.parse(saved) as Command);
   let idleRounds=0;
   while(active.current&&mounted.current){
    failureStep.current='大会状態・D1整合性の確認';
    s=await readStatus();
    if(!s.integrity.consistent)throw Error('D1整合性エラー');
    setStatus(s);
    const completed=s.flow?.completedMatches??0;
    const matchLabel=s.scene==='interval'&&s.flow?.courts
      ? `${s.scene} · ${completed}/${status?.integrity.matchCount??'?'} 試合 · 台 ${s.flow.courts.boards.map(b=>b.stage).join('/')}`
      : `${s.scene} / Match ${s.flow?.currentMatch?.id??'-'} · ${completed} 試合`;
    setStep(matchLabel);
    if(s.scene==='vs_card'&&(!s.flow?.currentMatch?.teamA||!s.flow.currentMatch.teamB))throw Error('次の試合の対戦相手が確定していません。');
    if(s.scene==='finished'){
     if(!s.flow?.championTeamId)throw Error('優勝者のない終了状態です。');
     setStep('CHAMPION・大会終了');
     break;
    }
    if(autoplayGoal.current!=null&&completed>=autoplayGoal.current){
     setStep(`部分確認完了：${completed} 試合終了。③Display・ブラケットを確認できます。再開で続きから全体確認も可能です。`);
     break;
    }
    const next=nextRehearsalCommand(s,matchSince.current);
    matchSince.current=next.matchSince;
    if(next.command&&active.current){
      idleRounds=0;
      try{
        await execute(next.command as Command);
      }catch(e){
        if(next.command.path==='/api/tournament/advance'&&e instanceof ApiError&&e.code==='VERSION_CONFLICT'){
          localStorage.removeItem(pendingKey());
        }else if(e instanceof ApiError&&e.code==='SPOTLIGHT_PLAYING'){
          await delay(300);
        }else throw e;
      }
    }else{
      idleRounds+=1;
      if(idleRounds>120)throw Error('進行が止まりました。③Display と ②Admin の状態を確認してください。');
    }
    await delay(s.timingPreset==='instant'?80:500);
   }
  }catch(e){fail(e);}finally{active.current=false;lock.current=false;autoplayGoal.current=null;if(mounted.current)setRunning(false);}
 }
 if(enabled===null)return <p className="loading">リハーサル環境を確認しています…{error}</p>;
 if(!enabled)return <section className="card"><h1>大会通しリハーサル</h1><a className="button" href="https://tournament-through-rehearsal.pine-shaken.workers.dev/rehearsal">専用リハーサル環境を開く</a></section>;
 const autoplayDisabled=busy||running||prepareBusy||!status||status.scene==='finished'||status.participants.length<4||status.participants.length%2!==0;
 if(pressMode)return <div className="rehearsal-workspace rehearsal-press">
  <section className="card press-card">
   <p className="eyebrow">40チーム・ダブルイリミ・instant</p>
   <h1>自動進行（ボタン1つ）</h1>
   <p>大会は0試合の状態まで準備済みです。③Display を開いてから、下のボタンを押すだけでブラケットが動きます。</p>
   <div className="press-links">
    <a className="button primary" href={status?scopedUrl('/display'):'#'} target="_blank" rel="noreferrer" aria-disabled={!status}>会場Displayを開く</a>
    <a className="button" href={status?scopedUrl('/admin'):'#'} target="_blank" rel="noreferrer" aria-disabled={!status}>運営（台カード）</a>
   </div>
   {(prepareBusy||!status)&&<p role="status" className="loading">{prepareBusy?'40チーム進行テストを準備中…':'大会状態を読み込み中…'}</p>}
   {status&&<SharedRunOverview status={status}/>}
   {error&&<p role="alert" className="error">{error}</p>}
   <p role="status" className="press-step">{step}{running?' · 自動実行中':''}</p>
   <div className="press-actions">
    <button type="button" className="primary press-go" disabled={autoplayDisabled} onClick={()=>void runAutoplay('partial')}>部分確認を開始（{PROGRESSION_HARNESS.partialMatchGoal}試合）</button>
    <button type="button" className="primary" disabled={autoplayDisabled} onClick={()=>void runAutoplay('full')}>全体確認（大会終了まで）</button>
    <button type="button" disabled={!running} onClick={()=>{active.current=false;setRunning(false);setStep('一時停止・同じ大会から再開できます');}}>一時停止</button>
   </div>
   <p className="hint"><a href={runId()?scopedUrl('/rehearsal'):'/rehearsal-press'}>手動操作・別大会準備は「大会の全体確認」</a></p>
  </section>
 </div>;
 return <div className="rehearsal-workspace">
  <section className="card">
   <p className="eyebrow">ONE EVENT / SHARED STATE</p><h1>大会の全体確認</h1>
   <p>一つの大会をスマホ受付・PC運営・会場Displayで共有します。進行状態は同じ大会IDを使って取得します。</p>
   {!runId()&&<>
    <p>新しい大会は参加者0名から開始します。写真はこの大会の受付で登録してください。</p>
    <p>準備すると参加者0名の新しい大会を作ります。既存大会・写真・結果は保持します。</p>
    <label className="field">演出時間<select value={preset} disabled={busy||running||prepareBusy} onChange={e=>setPreset(e.target.value as RehearsalTimingPreset)}>
      {allowInstant&&<option value="instant">LOGIC（instant）— 進行ロジック確認専用</option>}
      <option value="show">SHOW（会場表示を確認）</option>
      <option value="fast">FAST CHECK（全演出を短時間で確認）</option>
    </select></label>
    <button className="primary" disabled={busy||running||prepareBusy} onClick={()=>void initialize()}>新しい確認用大会を準備</button>
    {allowInstant&&<button className="primary" disabled={busy||running||prepareBusy} onClick={()=>void prepareProgression()}>{PROGRESSION_HARNESS.teams}チーム・ダブルイリミ（{PROGRESSION_HARNESS.courts}台）で進行テストを準備</button>}
   </>}
   {status&&<SharedRunOverview status={status}/>}
   {allowInstant&&runId()&&<p><button className="primary" disabled={busy||running||prepareBusy} onClick={()=>void prepareProgression()}>別大会で{PROGRESSION_HARNESS.teams}チーム進行テストを準備</button></p>}
   {error&&<p role="alert" className="error">{error}</p>}
   <p role="status">{step}{running?' · 自動実行中':''}</p>
   {status&&<details className="automation" open={status.timingPreset==='instant'}><summary>自動進行（模擬勝者・Team A）</summary>
    <p>台の試合（interval）とブラケット更新、決勝・表彰まで API で進めます。③Display を開いたままトーナメント表の動きを確認できます。</p>
    <p>instant 進行テストでは全員の写真デコード確認は行いません（Display は別途写真をプリロードします）。</p>
    <p className="hint">{status.timingPreset==='instant'
      ? '部分：ウィナーズ1回戦相当まで（既定20試合）。全体：大会終了まで。一時停止後は同じ大会から再開できます。'
      : '尺付き大会は演出待ち込みで進みます。部分・全体ともに同じボタンです。'}</p>
    <div className="actions">
     <button className="primary" disabled={busy||running||status.scene==='finished'||status.participants.length<4||status.participants.length%2!==0} onClick={()=>void runAutoplay('partial')}>
      {status.timingPreset==='instant'?`部分確認（${PROGRESSION_HARNESS.partialMatchGoal}試合）`:'部分自動（途中まで）'}
     </button>
     <button className="primary" disabled={busy||running||status.scene==='finished'||status.participants.length<4||status.participants.length%2!==0} onClick={()=>void runAutoplay('full')}>全体確認（大会終了まで）</button>
     <button disabled={!running} onClick={()=>{active.current=false;setRunning(false);setStep('一時停止・同じ大会から再開できます');}}>一時停止</button>
    </div>
   </details>}
  </section>
  {status&&<section className="manual-operations"><h2>実データを手動で操作</h2><p>登録した参加者を使う場合は自動全通しを開始せず、Adminで受付終了・ペア発表・試合開始・実際の勝者を順に操作してください。</p><fieldset disabled={running||busy}><DrawControl key={status.eventId+'-'+sessionVersion} administration automaticAdvance={!running} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion}/></fieldset></section>}
 </div>;
}
