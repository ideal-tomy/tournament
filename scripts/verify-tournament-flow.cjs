// Public full-flow test. Writes only to this explicitly isolated rehearsal event.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='https://tournament-flow-e2e.pine-shaken.workers.dev',eventId='cf-flow-e2e-20261025',output='.wrangler/tournament-flow-e2e';
const resume=process.env.RESUME_TOURNAMENT_FLOW==='1';
async function until(page,predicate,timeout=30000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await page.evaluate(predicate))return;await page.waitForTimeout(120);}throw new Error('Timed out waiting for public UI predicate');}
const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
async function d1(sql){const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];const r=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[eventId]})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const hostname=new URL(root).hostname;const address=await new Promise((resolve,reject)=>require('node:dns').lookup(hostname,{family:4},(error,ip)=>error?reject(error):resolve(ip)));const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic',`--host-resolver-rules=MAP ${hostname} ${address}`]});
 const prior=resume&&fs.existsSync(output+'/progress.json')?JSON.parse(fs.readFileSync(output+'/progress.json','utf8')):{};
 const report={root,eventId,photoSource:'8 test image files uploaded through the real reception form; not physical smartphone captures',matches:prior.matches??[],operatorHoldVerified:prior.operatorHoldVerified,liveReloadStable:prior.liveReloadStable,errors:[],failures:[],networkFailures:[],automaticAdvanceRaces:0};
 try{
  const operator=await browser.newContext({viewport:{width:1280,height:900}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  const admin=await operator.newPage(),display=await monitor.newPage();
  for(const p of [admin,display]){p.on('requestfailed',r=>{const value={path:new URL(r.url()).pathname,error:r.failure()?.errorText};report.networkFailures.push(value);console.log(JSON.stringify({networkRetry:value}));});p.on('pageerror',e=>report.errors.push(e.message));p.on('response',async r=>{if(r.status()<400||(r.status()===401&&new URL(r.url()).pathname==='/api/session'))return;if(r.status()===409&&new URL(r.url()).pathname==='/api/tournament/advance'){const b=await r.json();if(['VERSION_CONFLICT','SCENE_NOT_FINISHED'].includes(b.error)){report.automaticAdvanceRaces++;return;}}report.failures.push({path:new URL(r.url()).pathname,status:r.status()});});}
  const state=()=>operator.request.get(root+'/api/draw/state').then(r=>r.json());
  async function login(p,route){await p.goto(root+route);await p.getByLabel('確認コード',{exact:true}).fill(secrets.REHEARSAL_ACCESS_CODE);await p.getByRole('button',{name:'確認して開く',exact:true}).click();}
  await login(admin,resume?'/admin':'/checkin');await admin.getByRole('heading',{name:resume?'大会運営':'参加者受付',exact:true}).waitFor();
  const before=await state();let committed;
  if(!resume){
  assert.equal(before.participants.length,0,'Test event must be empty; never delete/reset existing data automatically.');
  for(let i=1;i<=8;i++){
   const name=`進行検証 ${String(i).padStart(2,'0')}`;await admin.getByRole('textbox',{name:/名前/}).fill(name);await admin.getByLabel('rating',{exact:false}).fill(String(i+2));await admin.locator('input[type=file]').setInputFiles(`public/images/test${String(i).padStart(2,'0')}.png`);await admin.locator('img.photo-preview').waitFor();
   const response=admin.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/participants');await admin.getByRole('button',{name:'参加者を登録',exact:true}).click();assert.equal((await response).status(),201);await admin.getByRole('heading',{name,exact:true}).waitFor();await until(admin,()=>document.querySelector('input[autocomplete=name]')?.value==='');
  }
  await admin.getByTestId('participant-count').filter({hasText:'8名'}).waitFor();await admin.locator('.participant img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await admin.screenshot({path:output+'/reception-eight.png',fullPage:true});
  admin.once('dialog',d=>d.accept());const close=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkin/close');await admin.getByRole('button',{name:'受付終了',exact:true}).click();assert.equal((await close).status(),200);await admin.getByRole('heading',{name:/受付完了/}).waitFor();report.receptionClosed=true;
  await login(display,'/display');await admin.goto(root+'/admin');await admin.getByRole('heading',{name:'大会運営',exact:true}).waitFor();
  // Decode existing artwork and saved portraits before starting the real full Draw.
  await display.evaluate(async()=>{const sources=['backgrounds/card-table-bg.webp','cards/card-front.webp','cards/card-back.webp','cards/impact-mark.png','darts/dart-main.png','darts/dart-motion-streak.png','effects/impact-flash.png','effects/golden-sparks.png','effects/blue-ring.png','effects/impact-cloud.png','effects/debris.png','frames/nameplate.png','frames/team-plate.png'];await Promise.all(sources.map(src=>{const i=new Image();i.src='/tournament-effects/'+src;return i.decode();}));});
  admin.once('dialog',d=>d.accept());const draw=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/draw/start');await admin.getByRole('button',{name:'ペア発表開始',exact:true}).click();assert.equal((await draw).status(),200);await display.locator('[data-draw-scene="draw"] .draw-reveal-card').first().waitFor({state:'attached'});
  committed=await state();
  }else{assert.equal(before.participants.length,8);assert.ok(before.participants.every(p=>/^進行検証 /.test(p.name)));assert.equal(before.checkinStatus,'closed');assert.ok(before.session);report.receptionClosed=true;await login(display,'/display');committed=await state();}
  report.sessionId=committed.session.id;report.teams=committed.teams;assert.equal(committed.teams.length,4);
  console.log(JSON.stringify({stage:committed.scene,participants:8,teams:4,durationSec:committed.durationSec}));
  if(committed.scene==='draw'&&!resume){await until(display,()=>[...document.querySelectorAll('.draw-pair-stage')].some(e=>getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.95),45000);await display.screenshot({path:output+'/draw-pair.png'});}
  if((await state()).scene!=='vs_card'){
   await display.locator('[data-draw-scene="bracket"]').waitFor({timeout:130000});
   await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='ゲームスタート'&&!b.disabled));
   await admin.getByRole('button',{name:'ゲームスタート',exact:true}).click();
  }
  await display.locator('[data-draw-scene="vs_card"]').waitFor({timeout:30000});
  let current=await state(),guard=report.matches.length;
  while(current.scene==='vs_card'&&guard++<20){
   const match=current.flow.currentMatch;assert.ok(match?.teamA&&match?.teamB);assert.equal(await admin.getByRole('combobox').count(),0);
   await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));
   await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();await display.waitForTimeout(300);
   assert.ok((await display.locator('.pm-stage').textContent()).includes(current.teams.find(t=>t.id===match.teamA).name));
   if(guard===1){const version=(await state()).version;await display.waitForTimeout(2000);const waiting=await state();assert.equal(waiting.scene,'vs_card');assert.equal(waiting.version,version);report.operatorHoldVerified=true;await display.screenshot({path:output+'/next-match-hold.png'});}
   const start=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/tournament/start');await admin.getByRole('button',{name:'試合開始',exact:true}).click();assert.equal((await start).status(),200);await display.locator('[data-draw-scene="match_live"]').waitFor();
   const live=await state();assert.equal(live.flow.currentMatch.id,match.id);
   if(guard===1){await display.reload();await display.locator('[data-draw-scene="match_live"]').waitFor();const restored=await state();assert.equal(restored.version,live.version);assert.equal(restored.flow.currentMatch.id,match.id);report.liveReloadStable=true;}
   const winnerSlot=match.kind==='grand_final'?1:0,winnerId=winnerSlot===0?match.teamA:match.teamB,winnerName=current.teams.find(t=>t.id===winnerId).name;
   await admin.getByRole('button',{name:`${winnerName} の勝利を確定`,exact:true}).waitFor();admin.once('dialog',d=>d.accept());const result=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/tournament/winner');await admin.getByRole('button',{name:`${winnerName} の勝利を確定`,exact:true}).click();const resultResponse=await result;assert.equal(resultResponse.status(),200);const applied=await resultResponse.json();assert.equal(applied.flow.winnerTeamId,winnerId);assert.equal(applied.scene,'result');assert.equal(resultResponse.request().postDataJSON().matchId,undefined);
   await display.locator('[data-draw-scene="result"] .pm-win').waitFor();await display.screenshot({path:`${output}/result-${guard}.png`});
   report.matches.push({matchId:match.id,kind:match.kind,teamA:match.teamA,teamB:match.teamB,winner:winnerId,resultVersion:applied.version});
   fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stage:'result',match:guard,matchId:match.id,kind:match.kind,winner:winnerName}));
   // No operator-selected next match and no manual advance request from this test.
   await until(admin,()=>{const p=document.querySelector('[data-draw-scene]');return ['vs_card','award','finished'].includes(p?.getAttribute('data-draw-scene'));},90000);current=await state();
  }
  assert.ok(guard<20);await display.locator('.ap-champion-title').waitFor({timeout:20000});await display.waitForTimeout(1000);await display.screenshot({path:output+'/champion.png'});
  await admin.locator('[data-draw-scene="finished"]').waitFor({timeout:20000});const done=await state();assert.equal(done.scene,'finished');assert.ok(done.flow.championTeamId);assert.equal(done.flow.completedMatches,report.matches.length);report.champion=done.teams.find(t=>t.id===done.flow.championTeamId);assert.ok(report.champion);assert.equal(new Set(report.matches.map(m=>m.matchId)).size,report.matches.length);assert.ok(report.matches.some(m=>m.kind==='loser'));assert.equal(report.matches.filter(m=>m.kind==='grand_final').length,2);
  await display.reload();await display.locator('[data-draw-scene="finished"] .ap-champion-title').waitFor();assert.ok((await display.locator('.ap-champions').textContent()).includes(report.champion.name));
  const event=await d1('SELECT status,bm_current_match_id,bracket_snapshot FROM events WHERE id=?');assert.equal(event[0].status,'finished');assert.equal(event[0].bm_current_match_id,null);assert.deepEqual(JSON.parse(event[0].bracket_snapshot),done.bracket);
  const matches=await d1('SELECT sequence,status,winner_team_id FROM matches WHERE event_id=? ORDER BY sequence');for(const m of report.matches){const saved=matches.find(x=>x.sequence===m.matchId);assert.equal(saved.status,'done');assert.equal(saved.winner_team_id,m.winner);}report.d1={matches:matches.length,done:matches.filter(m=>m.status==='done').length,snapshotEqual:true};
  const scenes=await d1('SELECT scene,version,current_match_id FROM event_state WHERE event_id=?');assert.equal(scenes[0].scene,'finished');assert.equal(scenes[0].version,done.version);report.finalVersion=done.version;report.participants=done.participants.map(p=>({id:p.id,name:p.name,portraitUrl:p.portraitUrl}));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failures,[]);report.complete=true;report.checkedAt=new Date().toISOString();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,root,participants:8,teams:4,matches:report.matches.length,champion:report.champion.name,version:done.version,d1:report.d1}));
 }catch(error){for(const [i,c] of browser.contexts().entries())for(const [j,p] of c.pages().entries())await p.screenshot({path:`${output}/failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
