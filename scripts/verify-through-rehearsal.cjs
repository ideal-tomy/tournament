// Browser runner exercises /rehearsal controls. Tournament decisions belong to the real Worker.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const local=process.argv.includes('--local');
const root=local?`http://localhost:${process.env.PORT??5174}`:'https://tournament-through-rehearsal.pine-shaken.workers.dev',output=local?'.wrangler/local-e2e':'.wrangler/through-rehearsal-e2e';
const secrets=local?require('node:util').parseEnv(fs.readFileSync('cloudflare/local/.dev.vars','utf8')):JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
const readRemoteD1=async(eventId,sql)=>{const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];const r=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[eventId]})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;};
async function until(page,predicate,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(100);}throw Error('UI condition timed out');}
async function d1(eventId,sql){
 if(!local)return readRemoteD1(eventId,sql);
 assert.match(eventId,/^cf-through-/);
 const {DatabaseSync}=require('node:sqlite');
 const base='.wrangler/local-app/v3/d1';
 for(const name of fs.readdirSync(base,{recursive:true}).filter(n=>n.endsWith('.sqlite'))){
  const db=new DatabaseSync(path.join(base,name),{readOnly:true});
  try{if(db.prepare("SELECT name FROM sqlite_master WHERE name='events'").get())return db.prepare(sql).all(eventId);}finally{db.close();}
 }
 throw Error('Local D1 SQLite file not found');
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${local?'127.0.0.1':ip}`]});
 const report={startedAt:new Date().toISOString(),root,states:[],errors:[],httpFailures:[],requests:[],drawPlayers:[],drawPairs:[],sawSummary:false,expectedInjectedFailures:0,advanceRaces:0};
 const save=()=>fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));
 try{
  const operator=await browser.newContext({viewport:{width:1440,height:1000}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  for(const context of [operator,monitor])assert.equal((await context.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secrets.REHEARSAL_ACCESS_CODE}})).status(),200);
  const page=await operator.newPage(),display=await monitor.newPage();
  for(const p of [page,display]){p.on('pageerror',e=>report.errors.push(e.message));p.on('response',async r=>{if(r.status()<400)return;const u=new URL(r.url());if(r.status()===503&&u.pathname==='/api/tournament/start'){report.expectedInjectedFailures++;return;}if(r.status()===409){const b=await r.json();if(b.error==='VERSION_CONFLICT'&&['/api/tournament/advance','/api/rehearsal/status'].includes(u.pathname)){report.advanceRaces++;return;}}report.httpFailures.push({path:u.pathname,status:r.status()});});p.on('request',r=>{const u=new URL(r.url());if(r.method()==='POST'&&u.pathname.startsWith('/api/tournament/'))report.requests.push({path:u.pathname,run:u.searchParams.get('run'),body:r.postDataJSON()});});}
  await page.goto(root+'/rehearsal');await page.getByRole('heading',{name:'大会通しリハーサル',exact:true}).waitFor();
  // Copy mode uses existing saved photos; no mutation of the source event.
  let copiedRun=null;
  const getState=async run=>{const r=await operator.request.get(root+'/api/rehearsal/status?run='+run,{maxRetries:3});if(r.status()===409)return getState(run);assert.equal(r.status(),200);return r.json();};
  if(!local){
   await page.getByLabel('参加者の準備').selectOption('registered');await page.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();await until(page,()=>document.body.textContent.includes('参加者準備完了・受付中'));
   copiedRun=new URL(page.url()).searchParams.get('run');assert.ok(copiedRun);report.copiedRun=copiedRun;
   const copied=await getState(copiedRun);assert.equal(copied.participants.length,4);assert.equal(copied.scene,'idle');report.registeredCopyNames=copied.participants.map(p=>p.name);report.copyModeVerified=true;
  }
  // New initialization retains the previous run and creates eight real D1/R2 sample registrations.
  await page.getByLabel('参加者の準備').selectOption('sample');if(copiedRun)page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();await until(page,()=>document.body.textContent.includes('参加者準備完了・受付中')&&document.querySelectorAll('[data-draw-scene]').length===1);
  await until(page,()=>[...document.querySelectorAll('dd')].some(e=>e.textContent==='8 / 0'));
  const run=new URL(page.url()).searchParams.get('run');assert.notEqual(run,copiedRun);report.eventId=run;
  const full=(await getState(run));assert.equal(full.participants.length,8);if(copiedRun)assert.equal((await getState(copiedRun)).participants.length,4);report.samplePortraits=full.participants.map(p=>({id:p.id,name:p.name,rating:p.rating,portraitUrl:p.portraitUrl}));
  await display.goto(root+'/display?run='+run);await display.getByRole('heading',{name:'大会開始待機',exact:true}).waitFor();
  assert.equal(await display.getByRole('button').count(),0);assert.ok((await page.getByRole('link',{name:'運営画面を開く',exact:true}).getAttribute('href')).includes(run));assert.ok((await page.getByRole('link',{name:'Displayを別ウィンドウで開く',exact:true}).getAttribute('href')).includes(run));
  await page.screenshot({path:output+'/01-ready.png',fullPage:true});
  // Inject a single real API failure. The UI runner must stop and retry the same request on resume.
  let injected=false;await page.route('**/api/tournament/start?*',async route=>{if(!injected){injected=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVICE_UNAVAILABLE'})});}else await route.continue();});
  await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();
  let paused=false,resumedAfterError=false;const deadline=Date.now()+420000;let lastVersion=-1;
  while(Date.now()<deadline){
   const state=await getState(run);assert.equal(state.integrity.consistent,true);
   if(state.version!==lastVersion){lastVersion=state.version;report.states.push({scene:state.scene,phase:state.flow?.phase,version:state.version,match:state.flow?.currentMatch?.id??null,completed:state.flow?.completedMatches??0,champion:state.flow?.championTeamId??null});save();console.log(JSON.stringify(report.states.at(-1)));}
   const frame=await display.evaluate(()=>{const v=e=>!!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.95;const names=e=>[...e.querySelectorAll('img')].filter(i=>i.alt&&i.complete&&i.naturalWidth>0&&(i.src.startsWith('blob:')||i.src.includes('/portrait'))).map(i=>i.alt);return {players:[...document.querySelectorAll('.draw-reveal-card')].filter(e=>v(e)&&[...e.querySelectorAll('.draw-player-reveal')].every(v)).flatMap(names),pairs:[...document.querySelectorAll('.draw-pair-stage')].filter(v).map(names),summary:[...document.querySelectorAll('.draw-team-summary')].some(v),scene:document.querySelector('[data-draw-scene]')?.getAttribute('data-draw-scene'),winner:v(document.querySelector('.pm-win')),next:v(document.querySelector('.pm-next'))};});
   for(const name of frame.players)if(!report.drawPlayers.includes(name))report.drawPlayers.push(name);
   for(const names of frame.pairs)if(names.length===2&&!report.drawPairs.some(p=>p.join('|')===names.join('|')))report.drawPairs.push(names);
   report.sawSummary ||= frame.summary;
   if(state.scene==='draw'&&!paused){await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.waitForTimeout(1700);assert.equal((await getState(run)).scene,'draw');assert.equal(await page.getByRole('button',{name:'一時停止',exact:true}).isDisabled(),true);report.pauseVerified=true;paused=true;await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();}
   if(injected&&!resumedAfterError&&await page.getByRole('alert').count()){
    assert.ok((await page.getByRole('alert').first().textContent()).includes('/api/tournament/start'));const before=await getState(run);assert.equal(before.scene,'vs_card');await page.waitForTimeout(1800);assert.equal((await getState(run)).version,before.version);report.errorStopVerified=true;await page.screenshot({path:output+'/02-error-stopped.png',fullPage:true});
    await page.unroute('**/api/tournament/start?*');await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();resumedAfterError=true;
   }
   if(frame.winner&&frame.scene==='result'&&!report.winnerVisual){await display.screenshot({path:output+'/03-winner.png'});report.winnerVisual=true;}
   if(state.flow?.phase==='bracket_update'&&frame.scene==='bracket'&&!report.bracketVisual){await display.screenshot({path:output+'/04-bracket.png'});report.bracketVisual=true;}
   if(state.flow?.currentMatch?.final&&frame.next&&!report.finalVisual){await display.screenshot({path:output+'/05-final.png'});report.finalVisual=true;}
   if(state.scene==='finished'){report.finishedAt=new Date().toISOString();report.champion=state.teams.find(t=>t.id===state.flow.championTeamId);report.finalState=state;break;}
   save();await page.waitForTimeout(120);
  }
  assert.ok(report.finalState,'Runner must reach finished through the UI');assert.equal(report.finalState.participants.length,8);assert.equal(report.finalState.teams.length,4);assert.equal(report.drawPlayers.length,8);assert.equal(report.drawPairs.length,4);assert.equal(report.sawSummary,true);assert.equal(report.pauseVerified,true);assert.equal(report.errorStopVerified,true);assert.equal(report.winnerVisual,true);assert.equal(report.bracketVisual,true);assert.equal(report.finalVisual,true);
  await display.locator('[data-draw-scene="finished"]').waitFor();await display.screenshot({path:output+'/06-champion.png'});await page.screenshot({path:output+'/07-finished-status.png',fullPage:true});await display.reload();await display.locator('[data-draw-scene="finished"]').waitFor();assert.equal((await getState(run)).version,report.finalState.version);report.reloadFinished=true;
  report.matches=await d1(run,'SELECT id,status,team_a_id,team_b_id,winner_team_id FROM matches WHERE event_id=? ORDER BY sequence');assert.equal(report.matches.filter(m=>m.status==='done').length,report.finalState.flow.completedMatches);report.logs=await d1(run,'SELECT action,version,request_id FROM operation_log WHERE event_id=? ORDER BY id');assert.equal(report.logs.filter(l=>l.action==='flow.winner').length,report.finalState.flow.completedMatches);
  const failedStart=report.requests.find(r=>r.path==='/api/tournament/start');assert.ok(report.requests.filter(r=>r.body.requestId===failedStart.body.requestId).length>=2);report.sameRequestOnResume=true;
  // Initializing again never deletes the finished run. Leave a fresh eight-person rehearsal ready for the user.
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();await until(page,()=>document.body.textContent.includes('参加者準備完了・受付中'));await until(page,()=>[...document.querySelectorAll('dd')].some(e=>e.textContent==='8 / 0'));report.readyRun=new URL(page.url()).searchParams.get('run');assert.notEqual(report.readyRun,run);assert.equal((await getState(run)).scene,'finished');assert.equal((await getState(report.readyRun)).checkinStatus,'open');report.resetPreservedFinished=true;
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);report.complete=true;save();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,eventId:run,readyRun:report.readyRun,participants:8,teams:4,matches:report.finalState.flow.completedMatches,champion:report.champion,errors:report.errors,httpFailures:report.httpFailures}));
 }catch(e){save();console.error(e.name+': '+(e.name==='AssertionError'?e.message:'public rehearsal verification interrupted; inspect progress'));process.exitCode=1;}finally{await browser.close();}
})();
