const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),assert=require('node:assert/strict');
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev',output='.wrangler/match-transition-e2e';
async function until(page,predicate,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(70);}throw Error('Visible display condition timed out');}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const secret=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
 const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const report={root,states:[],frames:[],errors:[],httpFailures:[],writes:[],replayWrites:[],advanceRaces:0};
 const save=()=>fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));
 try{
  const operator=await browser.newContext({viewport:{width:1440,height:1000}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  for(const c of [operator,monitor])assert.equal((await c.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secret.REHEARSAL_ACCESS_CODE}})).status(),200);
  const page=await operator.newPage(),display=await monitor.newPage();let replaying=false;
  for(const p of [page,display]){p.on('pageerror',e=>report.errors.push(e.message));p.on('request',r=>{if(r.method()!=='POST')return;const item={path:new URL(r.url()).pathname,body:r.postDataJSON()};report.writes.push(item);if(replaying)report.replayWrites.push(item);});p.on('response',async r=>{if(r.status()<400)return;const path=new URL(r.url()).pathname;if(r.status()===409&&path==='/api/tournament/advance'&&(await r.json()).error==='VERSION_CONFLICT'){report.advanceRaces++;return;}report.httpFailures.push({path,status:r.status()});});}
  const resume=process.env.RESUME_MATCH_TRANSITION==='1';
  if(resume){const prior=JSON.parse(fs.readFileSync(output+'/progress.json','utf8'));await page.goto(root+'/match-transition?run='+prior.eventId);report.resumedRun=true;}
  else{await page.goto(root+'/match-transition');await page.getByRole('button',{name:'確認用の1試合を準備',exact:true}).click();await until(page,()=>document.body.textContent.includes('勝者確定直前です'),180000);}
  const run=new URL(page.url()).searchParams.get('run');report.eventId=run;
  const state=async()=>{const r=await operator.request.get(root+'/api/draw/state?run='+run,{maxRetries:3});assert.equal(r.status(),200);return r.json();};
  let current=await state();if(current.scene==='vs_card'){await until(page,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));await page.getByRole('button',{name:'試合開始',exact:true}).click();await until(page,()=>!!document.querySelector('.draw-operations[data-draw-scene="match_live"]'));current=await state();}
  assert.equal(current.scene,'match_live');report.completedBefore=current.flow.completedMatches;report.firstMatch=current.flow.currentMatch;report.before=current.bracket;report.teams=current.teams;save();
  await display.goto(root+'/display?run='+run);await display.locator('[data-draw-scene="match_live"]').waitFor();
  const winner=current.teams.find(t=>t.id===current.flow.currentMatch.teamA);report.winner=winner;
  page.once('dialog',d=>d.accept());const scored=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/tournament/winner');await page.getByRole('button',{name:`${winner.name} の勝利を確定`,exact:true}).click();assert.equal((await scored).status(),200);
  const deadline=Date.now()+40000;let version=-1;
  while(Date.now()<deadline){current=await state();if(current.version!==version){version=current.version;report.states.push({scene:current.scene,phase:current.flow.phase,version:current.version,current:current.flow.currentMatch?.id??null});save();}
   const frame=await display.evaluate(()=>{const root=document.querySelector('[data-draw-scene]');const v=e=>!!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.95;const advance=document.querySelector('.audience-advance'),line=document.querySelector('.advance-line'),flight=document.querySelector('.advance-flight');return {scene:root?.getAttribute('data-draw-scene'),winner:v(document.querySelector('.pm-win')),names:[...document.querySelectorAll('.pm-winner img')].map(i=>i.alt),before:Number(advance?.querySelector('.advance-before')?getComputedStyle(advance.querySelector('.advance-before')).opacity:0),after:Number(advance?.querySelector('.advance-after')?getComputedStyle(advance.querySelector('.advance-after')).opacity:0),dash:line?parseFloat(getComputedStyle(line).strokeDashoffset):null,flight:flight?.getAttribute('transform'),from:advance?.getAttribute('data-advance-from'),to:advance?.getAttribute('data-advance-to'),next:v(document.querySelector('.pm-next'))};});
   if(frame.scene==='result'&&frame.winner&&!report.winnerVisible){assert.ok(frame.names.length===2);await display.screenshot({path:output+'/01-winner.png'});report.winnerVisible=true;}
   if(frame.scene==='bracket'&&frame.from){report.frames.push(frame);
    if(frame.before>.95&&frame.after<.05&&frame.dash>.95&&!report.beforeVisible){report.beforeVisible=true;await display.screenshot({path:output+'/02-before.png'});}
    if(frame.dash>.05&&frame.dash<.9&&!report.lineMoving){report.lineMoving=true;await display.screenshot({path:output+'/03-line-moving.png'});}
    if(frame.after>.95&&!report.afterVisible){report.afterVisible=true;await display.screenshot({path:output+'/04-after.png'});}
   }
   if(frame.scene==='vs_card'&&frame.next){report.nextVisible=true;await display.screenshot({path:output+'/05-next-wait.png'});break;}
   save();await display.waitForTimeout(65);
  }
  assert.equal(report.winnerVisible,true);assert.equal(report.beforeVisible,true);assert.equal(report.lineMoving,true);assert.equal(report.afterVisible,true);assert.equal(report.nextVisible,true);
  const frames=report.frames.filter(f=>f.flight);assert.ok(new Set(frames.map(f=>f.flight)).size>4);assert.equal(Number(frames[0].from),report.firstMatch.id);report.advanceTarget=Number(frames[0].to);
  const initialTarget=report.before.match.find(m=>m.id===report.advanceTarget);const winnerNumeric=current.bracket.participant.find(p=>p.name===winner.id).id;assert.ok(![initialTarget.opponent1?.id,initialTarget.opponent2?.id].includes(winnerNumeric));const afterTarget=current.bracket.match.find(m=>m.id===report.advanceTarget);assert.ok([afterTarget.opponent1?.id,afterTarget.opponent2?.id].includes(winnerNumeric));report.realDestinationVerified=true;
  current=await state();report.nextMatch=current.flow.currentMatch;assert.notEqual(report.nextMatch.id,report.firstMatch.id);assert.equal(current.flow.completedMatches,report.completedBefore+1);const waitVersion=current.version;await display.waitForTimeout(4500);assert.equal((await state()).version,waitVersion);assert.equal((await state()).scene,'vs_card');report.startHold=true;
  await display.reload();await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();assert.equal((await state()).version,waitVersion);report.reloadStable=true;
  // Replay / pause / resume shares production renderers and does not issue commands.
  replaying=true;await page.getByRole('button',{name:'最初から再生',exact:true}).click();await page.waitForTimeout(1800);await page.getByRole('button',{name:'一時停止',exact:true}).click();const paused=await page.getByRole('status').filter({hasText:'読み取り専用再生'}).textContent();await page.waitForTimeout(800);assert.equal(await page.getByRole('status').filter({hasText:'読み取り専用再生'}).textContent(),paused);await page.getByRole('button',{name:'再開',exact:true}).click();
  await until(page,()=>[...document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('NEXT MATCH・試合開始待ち')),25000);assert.deepEqual(report.replayWrites,[]);assert.equal((await state()).version,waitVersion);report.replayReadOnly=true;report.pauseResume=true;await page.screenshot({path:output+'/06-replay.png',fullPage:true});
  await page.getByRole('button',{name:'ライブ表示へ戻る',exact:true}).click();await until(page,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));replaying=false;
  if(process.env.LEAVE_NEXT_WAIT==='1'){report.showcaseWaiting=true;assert.equal((await state()).scene,'vs_card');}
  else{const started=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/tournament/start');await page.getByRole('button',{name:'試合開始',exact:true}).click();assert.equal((await started).status(),200);const live=await state();assert.equal(live.scene,'match_live');assert.equal(live.flow.currentMatch.id,report.nextMatch.id);report.operatorOnlyStart=true;}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);report.complete=true;save();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,eventId:run,states:report.states,target:report.advanceTarget,nextMatch:report.nextMatch,checks:{winner:report.winnerVisible,before:report.beforeVisible,line:report.lineMoving,after:report.afterVisible,next:report.nextVisible,pause:report.pauseResume,replay:report.replayReadOnly,hold:report.startHold,operator:report.operatorOnlyStart}}));
 }catch(e){save();console.error(e.name+': '+(e.name==='AssertionError'?e.message:e.message.split('Call log:')[0]));process.exitCode=1;}finally{await browser.close();}
})();
