// Manual controls on the public rehearsal entry; uses the isolated copied four-person run.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),assert=require('node:assert/strict');
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev',output='.wrangler/through-rehearsal-e2e';
async function until(page,predicate,timeout=30000){await page.bringToFront();const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(100);}throw Error('Public UI condition timed out');}
(async()=>{
 const full=JSON.parse(fs.readFileSync(output+'/result.json','utf8'));let run=JSON.parse(fs.readFileSync(output+'/manual-progress.json','utf8')).run;
 const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const report={run,states:[],errors:[],commands:[],portraitErrorStopped:false};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));assert.equal((await context.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secrets.REHEARSAL_ACCESS_CODE}})).status(),200);
  const page=await context.newPage(),display=await context.newPage();for(const p of [page,display])p.on('pageerror',e=>report.errors.push(e.message));
  const status=async (id=run)=>{const r=await context.request.get(`${root}/api/rehearsal/status?run=${id}`,{maxRetries:3});if(r.status()===409)return status(id);assert.equal(r.status(),200);return r.json();};
  const click=async(name,path,confirm=false)=>{await page.bringToFront();if(confirm)page.once('dialog',d=>d.accept());const pending=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST');await page.getByRole('button',{name,exact:true}).click();const r=await pending;assert.equal(r.status(),200);report.commands.push(path);};
  await page.goto(root+'/rehearsal?run='+run);await display.goto(root+'/display?run='+run);
  if((await status()).scene==='bracket'&&(await status()).flow?.championTeamId){
   await display.bringToFront();await display.locator('[data-draw-scene="finished"]').waitFor({timeout:30000});report.oldFinalRecovered=true;
   await page.goto(root+'/rehearsal');await page.getByLabel('参加者の準備').selectOption('registered');await page.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();
   await until(page,()=>document.body.textContent.includes('参加者準備完了・受付中'));run=new URL(page.url()).searchParams.get('run');report.run=run;await display.goto(root+'/display?run='+run);
  }
  let winnerId=(await status()).flow?.championTeamId;
  if((await status()).scene!=='finished'){
  assert.ok(['open','closed'].includes((await status()).checkinStatus));
  if((await status()).checkinStatus==='open')await click('受付終了','/api/checkin/close',true);if((await status()).scene==='idle'){await display.getByRole('heading',{name:'大会開始待機',exact:true}).waitFor();await click('ペア発表開始','/api/draw/start',true);}report.states.push('draw');
  await display.bringToFront();await display.locator('[data-draw-scene="bracket"]').waitFor({timeout:90000});await until(page,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='ゲームスタート'&&!b.disabled));report.states.push('bracket');await click('ゲームスタート','/api/tournament/game-start');await display.bringToFront();await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();
  await until(page,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));const first=await status();assert.equal(first.participants.length,4);await page.waitForTimeout(1500);assert.equal((await status()).scene,'vs_card');report.states.push('vs_card');
  await click('試合開始','/api/tournament/start');report.states.push('match_live');const current=await status(),team=current.teams.find(t=>t.id===current.flow.currentMatch.teamA);winnerId=team.id;await click(`${team.name} の勝利を確定`,'/api/tournament/winner',true);report.states.push('result');
  }else{const prior=JSON.parse(fs.readFileSync(output+'/manual-progress.json','utf8'));report.states=prior.states.slice(0,prior.states.indexOf('finished')+1);report.commands=prior.commands;report.resumedVerification=true;}
  await display.bringToFront();await display.locator('[data-draw-scene="finished"]').waitFor({timeout:30000});const finished=await status();assert.equal(finished.flow.completedMatches,1);assert.equal(finished.flow.championTeamId,winnerId);if(report.states.at(-1)!=='finished')report.states.push('award','finished');report.champion=finished.teams.find(t=>t.id===winnerId).name;await display.screenshot({path:output+'/manual-champion.png'});
  // Test a portrait decode failure before starting the untouched fresh eight-person run.
  await page.goto(root+'/rehearsal?run='+full.readyRun);await until(page,()=>[...document.querySelectorAll('dd')].some(e=>e.textContent==='8 / 0'));
  await page.route('**/api/events/*/participants/*/portrait',route=>route.fulfill({status:404,contentType:'application/json',body:'{}'}));await page.getByRole('button',{name:'自動通し確認を開始・再開',exact:true}).click();await page.getByRole('alert').first().waitFor();assert.ok((await page.getByRole('alert').first().textContent()).includes('写真'));await page.waitForTimeout(1000);assert.equal((await status(full.readyRun)).checkinStatus,'open');assert.equal((await status(full.readyRun)).version,0);report.portraitErrorStopped=true;await page.unroute('**/api/events/*/participants/*/portrait');await page.reload();
  for(const route of ['/checkin','/admin','/show-preview']){await page.goto(root+route+'?run='+full.readyRun);await page.waitForTimeout(700);const links=await page.locator('a[href^="/"]').evaluateAll(elements=>elements.map(e=>e.getAttribute('href')));assert.ok(links.every(h=>h.includes(full.readyRun)));}
  await page.bringToFront();await page.setViewportSize({width:390,height:844});await page.goto(root+'/rehearsal?run='+full.readyRun);await page.getByRole('heading',{name:'大会通しリハーサル',exact:true}).waitFor();await until(page,()=>[...document.querySelectorAll('dd')].some(e=>e.textContent==='8 / 0'));await page.screenshot({path:output+'/ready-sp.png',fullPage:true});assert.deepEqual(report.errors,[]);report.complete=true;fs.writeFileSync(output+'/manual.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){fs.writeFileSync(output+'/manual-progress.json',JSON.stringify({...report,error:e.message.split('Call log:')[0]},null,2));console.error(e.name+': '+e.message.split('Call log:')[0]);process.exitCode=1;}finally{await browser.close();}
})();
