// Real canonical pages and APIs; creates only fresh, owned rehearsal runs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{createHash}=require('node:crypto');
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE (README). No browser/package is installed automatically.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const publicRun=process.argv.includes('--public'),preset=process.argv.includes('--show')?'show':'fast';
const root=publicRun?'https://tournament-through-rehearsal.pine-shaken.workers.dev':`http://localhost:${Number(process.env.PORT??5174)}`;
const output=`.wrangler/rehearsal32-${publicRun?'public':'local'}-${preset}`;
const secrets=publicRun?JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8')):parseEnv(fs.readFileSync('cloudflare/local/.dev.vars','utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function until(page,predicate,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(100);}throw Error('UI observation timed out');}
async function d1(run,sql){
 assert.match(run,/^cf-through-[a-f0-9-]+$/);
 if(publicRun){
  const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];assert.ok(token,'Existing Cloudflare CLI authentication required');
  const result=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[run]})});
  const data=await result.json();assert.equal(data.success,true);return data.result[0].results;
 }
 const {DatabaseSync}=require('node:sqlite'),base='.wrangler/local-app/v3/d1';
 for(const file of fs.readdirSync(base,{recursive:true}).filter(f=>f.endsWith('.sqlite'))){const db=new DatabaseSync(path.join(base,file),{readOnly:true});try{if(db.prepare("SELECT name FROM sqlite_master WHERE name='events'").get())return db.prepare(sql).all(run);}finally{db.close();}}
 throw Error('Local D1 not found');
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const host=new URL(root).hostname,ip=publicRun?await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a))):'127.0.0.1';
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const report={startedAt:new Date().toISOString(),root,preset,routes:{},states:[],pairs:[],players:[],vs:{},winners:[],advances:{},errors:[],httpFailures:[],externalRequests:[],retries:0};
 const save=()=>fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));
 let operator,monitor,page,display;
 try{
  operator=await browser.newContext({viewport:{width:1440,height:1000}});
  monitor=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:output+'/video',size:{width:960,height:540}}});
  await monitor.addInitScript(()=>{
   const observed=window.__drawObserved={players:[],pairs:[],advances:{}};
   setInterval(()=>{
    const advance=document.querySelector('.audience-advance'),line=document.querySelector('.advance-line'),flight=document.querySelector('.advance-flight');
    if(advance&&line&&flight){const id=advance.getAttribute('data-advance-from'),target=advance.getAttribute('data-advance-to');if(id!=null&&target!=null){const a=observed.advances[id]??={target:Number(target),offsets:[],positions:[]};const offset=parseFloat(getComputedStyle(line).strokeDashoffset),position=flight.getAttribute('transform');if(!a.offsets.includes(offset))a.offsets.push(offset);if(Number(getComputedStyle(flight).opacity)>.8&&position&&!a.positions.includes(position))a.positions.push(position);}}
    if(document.querySelector('[data-draw-scene]')?.getAttribute('data-draw-scene')!=='draw')return;
    const visible=e=>!!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.8;
    const names=e=>[...e.querySelectorAll('img')].filter(i=>i.alt&&i.complete&&i.naturalWidth>0&&(i.src.startsWith('blob:')||i.src.includes('/portrait'))).map(i=>i.alt);
    for(const card of document.querySelectorAll('.draw-reveal-card'))if(visible(card)&&[...card.querySelectorAll('.draw-player-reveal')].every(visible))for(const name of names(card))if(!observed.players.includes(name))observed.players.push(name);
    for(const stage of document.querySelectorAll('.draw-pair-stage'))if(visible(stage)){const pair=names(stage);if(pair.length===2&&!observed.pairs.some(p=>p.join('|')===pair.join('|')))observed.pairs.push(pair);}
   },50);
  });
  for(const c of [operator,monitor])assert.equal((await c.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secrets.REHEARSAL_ACCESS_CODE}})).status(),200);
  let sourceBefore=null;
  page=await operator.newPage();display=await monitor.newPage();
  const read=async pathname=>{for(let i=0;i<5;i++){let r;try{r=await page.evaluate(async url=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});return {status:response.status,body:await response.json()};},root+pathname);}catch(error){report.transportRetries=(report.transportRetries??0)+1;if(i===4)throw Error('Browser status read failed after bounded retries');await page.waitForTimeout(500);continue;}if(r.status===409)continue;assert.equal(r.status,200);return r.body;}throw Error('Persistent state conflict');};
  for(const p of [page,display]){
   p.on('pageerror',e=>report.errors.push(e.message));
   p.on('response',async r=>{if(r.status()<400)return;const u=new URL(r.url());if(u.pathname==='/favicon.ico')return;if(r.status()===409){const b=await r.json().catch(()=>null);if(['VERSION_CONFLICT','SCENE_NOT_FINISHED'].includes(b?.error)){report.retries++;return;}}report.httpFailures.push({path:u.pathname,status:r.status()});});
   p.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!==root)report.externalRequests.push(r.url());});
  }
  // All five actual routes must survive direct access and reload before preparation.
  for(const route of ['/admin','/display','/rehearsal','/checkin','/show-preview']){
   assert.equal((await page.goto(root+route)).status(),200);await page.reload();
   await until(page,()=>document.querySelector('h1')!==null);report.routes[route]='direct + reload 200';
  }
  await page.goto(root+'/rehearsal');await page.getByRole('heading',{name:'大会通しリハーサル',exact:true}).waitFor();
  if(publicRun)sourceBefore=hash(await read('/api/rehearsal/source'));
  await page.getByLabel('参加者の準備').selectOption('sample32');await page.getByLabel('新規大会の確認速度').selectOption(preset);
  await page.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();
  await until(page,()=>document.body.textContent.includes('参加者準備完了・受付中'),90000);
  const run=new URL(page.url()).searchParams.get('run');assert.match(run,/^cf-through-/);report.run=run;
  const state=()=>read('/api/rehearsal/status?run='+run);
  let s=await state();assert.equal(s.participants.length,32);assert.equal(s.format,'single_elimination');assert.equal(s.timingPreset,preset);assert.ok(s.participants.every(p=>p.rating!=null&&p.portraitUrl));
  await display.goto(root+'/display?run='+run);await display.getByRole('heading',{name:'大会開始待機',exact:true}).waitFor();
  const admin=await operator.newPage();await admin.goto(root+'/admin?run='+run);await admin.getByRole('heading',{name:'大会運営',exact:true}).waitFor();await admin.close();
  await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();
  let version=-1,pairingHash=null,manual=false;const deadline=Date.now()+1500000;
  while(Date.now()<deadline){
   s=await state();assert.equal(s.integrity.consistent,true);
   if(s.session){pairingHash??=hash(s.teams);assert.equal(hash(s.teams),pairingHash);assert.equal(s.teams.length,16);assert.equal(s.bracket.match.length,15);}
   if(s.version!==version){version=s.version;const record={at:new Date().toISOString(),scene:s.scene,phase:s.flow?.phase,version,match:s.flow?.currentMatch?.id,round:s.flow?.currentMatch?.roundName,completed:s.flow?.completedMatches};report.states.push(record);console.log(JSON.stringify(record));save();}
   const frame=await display.evaluate(()=>{
    const visible=e=>!!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.8;
    const names=e=>[...e.querySelectorAll('img')].filter(i=>i.alt&&i.complete&&i.naturalWidth>0&&(i.src.startsWith('blob:')||i.src.includes('/portrait'))).map(i=>i.alt);
    const line=document.querySelector('.advance-line'),flight=document.querySelector('.advance-flight'),advance=document.querySelector('.audience-advance');
    return {scene:document.querySelector('[data-draw-scene]')?.getAttribute('data-draw-scene'),version:Number(document.querySelector('[data-draw-version]')?.getAttribute('data-draw-version')),
     players:window.__drawObserved?.players??[],
     observedAdvances:window.__drawObserved?.advances??{},
     pairs:window.__drawObserved?.pairs??[],summary:visible(document.querySelector('.draw-team-summary')),
     bracketPhotos:[...document.querySelectorAll('.persisted-bracket svg image')].filter(e=>e.getAttribute('href')?.startsWith('blob:')).length,
     winner:visible(document.querySelector('.pm-win')),next:visible(document.querySelector('.pm-next')),vs:visible(document.querySelector('.pm-vs')),
     portraits:[...document.querySelectorAll('.pm-winner img,.pm-opponent img')].filter(i=>i.alt&&i.complete&&i.naturalWidth>0&&(i.src.startsWith('blob:')||i.src.includes('/portrait'))).map(i=>i.alt),
     from:advance?.getAttribute('data-advance-from'),to:advance?.getAttribute('data-advance-to'),offset:line?parseFloat(getComputedStyle(line).strokeDashoffset):null,
     flight:visible(flight)?flight.getAttribute('transform'):null};
   });
   for(const n of frame.players)if(!report.players.includes(n))report.players.push(n);
   for(const pair of frame.pairs)if(pair.length===2&&!report.pairs.some(p=>p.join('|')===pair.join('|')))report.pairs.push(pair);
   report.summarySeen||=frame.summary;
   if(frame.summary&&!report.summaryScreenshot){await display.screenshot({path:output+'/00-all-16-pairs.png'});report.summaryScreenshot=true;}
   report.bracketPhotos=Math.max(report.bracketPhotos??0,frame.bracketPhotos);
   report.advances=frame.observedAdvances;
   if(frame.scene==='result'&&frame.winner&&s.scene==='result'&&!report.winners.includes(s.flow.lastMatchId)){report.winners.push(s.flow.lastMatchId);if(report.winners.length===1)await display.screenshot({path:output+'/03-winner.png'});}
   if(frame.from!=null&&frame.to!=null){const a=report.advances[frame.from]??={target:Number(frame.to),offsets:[],positions:[]};if(frame.offset!=null&&!a.offsets.includes(frame.offset))a.offsets.push(frame.offset);if(frame.flight&&!a.positions.includes(frame.flight))a.positions.push(frame.flight);if(frame.flight&&!report.lineScreenshot){await display.screenshot({path:output+'/04-moving-bracket-line.png'});report.lineScreenshot=true;}}
   if(s.scene==='vs_card'&&frame.scene==='vs_card'&&frame.vs&&frame.next&&frame.portraits.length===4){const id=s.flow.currentMatch.id;const v=report.vs[id]??={first:Date.now(),last:Date.now(),round:s.flow.currentMatch.roundName,portraits:frame.portraits};v.last=Date.now();}
   if(s.scene==='vs_card'&&s.flow.currentMatch.id===0&&!manual){
    manual=true;await page.getByRole('button',{name:'一時停止',exact:true}).click();
    await until(display,()=>{const e=document.querySelector('.pm-next');return e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.9&&[...document.querySelectorAll('.pm-winner img,.pm-opponent img')].filter(i=>i.complete&&i.naturalWidth>0).length===4;});
    const before=await state();await page.waitForTimeout(2200);const held=await state();assert.equal(held.scene,'vs_card');assert.equal(held.version,before.version);
    await display.screenshot({path:output+'/02-first-vs-start-wait.png'});
    const manualAdmin=await operator.newPage();await manualAdmin.goto(root+'/admin?run='+run);await manualAdmin.getByRole('button',{name:'試合開始',exact:true}).waitFor();
    await manualAdmin.getByRole('button',{name:'試合開始',exact:true}).click();await until(manualAdmin,()=>document.body.textContent.includes('勝者を確定してください。'));
    assert.equal((await state()).scene,'match_live');await manualAdmin.close();report.manualStartVerified=true;report.pauseResumeVerified=true;
    // The first hold was observed while paused; later holds are sampled below.
    const faces=await display.locator('.pm-winner img,.pm-opponent img').evaluateAll(images=>images.filter(i=>i.alt&&i.complete&&i.naturalWidth>0&&(i.src.startsWith('blob:')||i.src.includes('/portrait'))).map(i=>i.alt));assert.equal(faces.length,4);
    report.vs[0]={first:Date.now()-2200,last:Date.now(),round:'Round of 16',portraits:faces};
    await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();
   }
   if(s.flow?.currentMatch?.roundName&&!report['shot'+s.flow.currentMatch.roundName]&&frame.next&&frame.scene==='vs_card'){
    const round=s.flow.currentMatch.roundName;await display.screenshot({path:output+'/round-'+round.replaceAll(' ','-')+'.png'});report['shot'+round]=true;
   }
   if(s.scene==='finished'){report.final=s;break;}
   save();await page.waitForTimeout(500);
  }
  assert.ok(report.final,'32-person run must reach CHAMPION');assert.equal(report.final.flow.completedMatches,15);assert.equal(report.players.length,32);assert.equal(report.pairs.length,16);assert.ok(report.summarySeen);
  assert.equal(Object.keys(report.vs).length,15);for(const v of Object.values(report.vs))assert.ok(v.last-v.first>=700,'Every NEXT/VS must remain visible, not flash by');
  assert.equal(report.winners.length,15);assert.equal(Object.keys(report.advances).length,14);for(const a of Object.values(report.advances)){assert.ok(a.positions.length>=2,'Real winner movement observed');assert.ok(a.offsets.some(v=>v>0&&v<1),'Line drawing observed');}
  assert.ok(report.bracketPhotos>=32,'All 32 decoded portraits must be available in the real bracket');
  await display.locator('[data-draw-scene="finished"]').waitFor();await display.screenshot({path:output+'/06-champion.png'});await display.reload();await display.locator('[data-draw-scene="finished"]').waitFor();assert.equal((await state()).version,report.final.version);report.reloadVerified=true;
  const matches=await d1(run,'SELECT status,COUNT(*) n FROM matches WHERE event_id=? GROUP BY status');assert.equal(matches.find(m=>m.status==='done').n,15);report.matches=matches;
  const logs=await d1(run,'SELECT action,COUNT(*) n FROM operation_log WHERE event_id=? GROUP BY action');assert.equal(logs.find(l=>l.action==='flow.winner').n,15);assert.equal(logs.find(l=>l.action==='flow.start').n,15);report.logs=logs;
  if(publicRun){assert.equal(hash(await read('/api/rehearsal/source')),sourceBefore);report.sourceUnchanged=true;}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);assert.deepEqual(report.externalRequests,[]);
  report.complete=true;report.finishedAt=new Date().toISOString();
 }catch(e){report.error=e.message.split('\n')[0];save();process.exitCode=1;try{await display?.screenshot({path:output+'/failure.png'});}catch{}}
 finally{
  save();if(display){const video=display.video();try{await monitor.close();if(video)report.video=await video.path();}catch(e){report.recordingError=e.message;}}
  await operator?.close();save();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({complete:report.complete,run:report.run,preset,players:report.players.length,pairs:report.pairs.length,vs:Object.keys(report.vs).length,winners:report.winners.length,advances:Object.keys(report.advances).length,error:report.error,video:report.video}));await browser.close();
 }
})();
