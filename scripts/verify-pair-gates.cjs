// Public first-match gate verification. Copies four existing portraits into an isolated event only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const root='https://tournament-pair-gates-e2e.pine-shaken.workers.dev';
const source='https://tournament-checkin-rehearsal.pine-shaken.workers.dev';
const eventId='cf-pair-gates-e2e-20261025',output='.wrangler/pair-gates-e2e';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function until(page,predicate,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(100);}throw Error('Public UI condition timed out');}
async function d1(sql){const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];const r=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[eventId]})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
 const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const resume=process.env.RESUME_PAIR_GATES==='1';
 const report=resume?JSON.parse(fs.readFileSync(output+'/progress.json','utf8')):{root,eventId,source,photoSource:'Four existing real registered portraits copied byte-for-byte; no new physical camera captures',states:[],players:[],pairs:[],revealed:[],confirmed:[],summary:false,errors:[],httpFailures:[],advanceRaces:0};
 const save=()=>fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));
 try{
  const original=await browser.newContext(),operator=await browser.newContext({viewport:{width:1365,height:900}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  const auth=async(context,url)=>{const r=await context.request.post(url+'/api/session',{headers:{Origin:url},data:{code:secrets.REHEARSAL_ACCESS_CODE}});assert.equal(r.status(),200);};
  await auth(original,source);const sourceRoster=await (await original.request.get(source+'/api/checkin/roster')).json();assert.equal(sourceRoster.participants.length,4);
  await auth(operator,root);await auth(monitor,root);
  const state=async()=>{const r=await operator.request.get(root+'/api/draw/state',{maxRetries:3});assert.equal(r.status(),200);return r.json();};
  let current=await state();if(!resume){assert.equal(current.checkinStatus,'open');assert.equal(current.session,null);assert.ok(current.participants.every(p=>sourceRoster.participants.some(s=>s.name===p.name&&s.rating===p.rating)));const existing=current.participants;
  for(const p of sourceRoster.participants){const photo=await original.request.get(source+p.portraitUrl);assert.equal(photo.status(),200);const bytes=await photo.body();const r=existing.some(e=>e.name===p.name)?null:await operator.request.post(root+'/api/participants',{headers:{Origin:root},data:{requestId:randomUUID(),name:p.name,rating:p.rating,photo:`data:${photo.headers()['content-type']};base64,${bytes.toString('base64')}`}});if(r)assert.equal(r.status(),201);const saved=r?(await r.json()).participant:existing.find(e=>e.name===p.name);const copied=await operator.request.get(root+saved.portraitUrl);assert.equal(copied.status(),200);assert.equal(sha(await copied.body()),sha(bytes));report.players.push({sourceId:p.id,id:saved.id,name:p.name,rating:p.rating,portraitUrl:saved.portraitUrl,photoSha256:sha(bytes),bytes:bytes.length});save();}
  }
  const admin=await operator.newPage(),display=await monitor.newPage();
  for(const page of [admin,display]){page.on('pageerror',e=>report.errors.push(e.message));page.on('response',async r=>{if(r.status()<400)return;const url=new URL(r.url());if(r.status()===409&&url.pathname==='/api/tournament/advance'){const b=await r.json();if(['VERSION_CONFLICT','SCENE_NOT_FINISHED'].includes(b.error)){report.advanceRaces++;return;}}report.httpFailures.push({path:url.pathname,status:r.status()});});}
  await admin.goto(root+'/admin');await display.goto(root+'/display');
  await until(admin,()=>document.body.textContent.includes('対象 4名'));
  const click=async(name,endpoint,confirm=false)=>{if(confirm)admin.once('dialog',d=>d.accept());const response=admin.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()==='POST');await admin.getByRole('button',{name,exact:true}).click();const r=await response;assert.equal(r.status(),200);return {body:await r.json(),request:r.request().postDataJSON()};};
  if(!resume){await click('受付終了','/api/checkin/close',true);current=await state();assert.equal(current.scene,'idle');assert.ok(current.session);assert.equal(current.flow.currentMatch,null);assert.equal(current.teams.length,2);assert.equal(current.flow.canAdvance,false);report.states.push({step:'closed-pairs-prepared',scene:current.scene,version:current.version,currentMatch:null});report.sessionId=current.session.id;report.pairs=current.teams;save();
  const stored=await d1('SELECT t.id,t.name,t.rating_total,p.id participant_id,p.display_name,p.rating FROM teams t JOIN team_members tm ON tm.team_id=t.id JOIN participants p ON p.id=tm.participant_id WHERE t.event_id=? ORDER BY t.seed,tm.position');assert.equal(stored.length,4);assert.deepEqual([...new Set(stored.map(r=>r.rating_total))].sort((a,b)=>a-b),[18,19]);report.storedPairs=stored;
  await display.getByRole('heading',{name:'大会開始待機',exact:true}).waitFor();await display.waitForTimeout(4000);assert.equal((await state()).version,current.version);assert.equal(await display.locator('.draw-reveal-card,.pm-stage').count(),0);assert.equal(await display.getByRole('button').count(),0);await display.screenshot({path:output+'/01-announcement-wait.png'});report.announcementHold=true;
  const announced=await click('ペア発表開始','/api/draw/start',true);assert.equal(announced.body.scene,'draw');assert.deepEqual(announced.body.teams,current.teams);assert.equal(announced.body.session.id,current.session.id);report.states.push({step:'operator-announcement',scene:'draw',version:announced.body.version});save();
  const deadline=Date.now()+90000;
  while(Date.now()<deadline){
   const frame=await display.evaluate(()=>{const visible=e=>!!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.95;const people=e=>[...e.querySelectorAll('img[src*="/portrait"]')].filter(i=>i.complete&&i.naturalWidth>0).map(i=>i.alt);return {scene:document.querySelector('[data-draw-scene]')?.getAttribute('data-draw-scene'),revealed:[...document.querySelectorAll('.draw-reveal-card')].filter(e=>visible(e)&&[...e.querySelectorAll('.draw-player-reveal')].every(visible)).flatMap(people),pairs:[...document.querySelectorAll('.draw-pair-stage')].filter(visible).map(people),summary:[...document.querySelectorAll('.draw-team-summary')].some(visible)};});
   for(const name of frame.revealed)if(!report.revealed.includes(name)){report.revealed.push(name);save();}
   for(const names of frame.pairs){if(names.length===2&&!report.confirmed.some(p=>p.slice().sort().join('|')===names.slice().sort().join('|'))){report.confirmed.push(names);await display.screenshot({path:`${output}/pair-${report.confirmed.length}.png`});save();}}
   if(frame.summary&&!report.summary){report.summary=true;await display.screenshot({path:output+'/02-all-pairs.png'});save();}
   if(frame.scene==='bracket')break;await display.waitForTimeout(90);
  }
  assert.deepEqual(report.revealed.slice().sort(),report.players.map(p=>p.name).sort());assert.equal(report.confirmed.length,2);assert.equal(report.summary,true);
  }
  assert.deepEqual(report.confirmed.map(p=>p.slice().sort().join('|')).sort(),current.teams.map(t=>t.memberIds.map(id=>report.players.find(p=>p.id===id).name).sort().join('|')).sort());
  current=await state();assert.equal(current.scene,'bracket');assert.equal(current.flow.currentMatch,null);assert.equal(current.flow.canAdvance,false);report.states.push({step:'draw-complete-bracket-wait',scene:'bracket',version:current.version,currentMatch:null});
  await display.getByRole('img',{name:'トーナメント表',exact:true}).waitFor();await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='ゲームスタート'&&!b.disabled));await display.waitForTimeout(6000);assert.equal((await state()).version,current.version);assert.equal((await state()).flow.currentMatch,null);assert.equal(await admin.getByRole('combobox').count(),0);assert.equal(await admin.getByRole('button',{name:'試合開始',exact:true}).count(),0);await display.screenshot({path:output+'/03-bracket-wait.png'});report.gameStartHold=true;
  const beforeGame=await d1('SELECT e.bm_current_match_id,s.current_match_id FROM events e JOIN event_state s ON s.event_id=e.id WHERE e.id=?');assert.equal(beforeGame[0].bm_current_match_id,null);assert.equal(beforeGame[0].current_match_id,null);
  const game=await click('ゲームスタート','/api/tournament/game-start');assert.equal(game.request.matchId,undefined);assert.equal(game.body.scene,'vs_card');assert.ok(game.body.flow.currentMatch);report.states.push({step:'operator-game-start',scene:'vs_card',version:game.body.version,currentMatch:game.body.flow.currentMatch.id});report.currentMatch=game.body.flow.currentMatch;save();
  await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));await display.locator('.pm-stage img[src*="/portrait"]').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));assert.equal(await display.locator('.pm-stage img[src*="/portrait"]').count(),4);
  for(const p of report.players)assert.ok((await display.locator('.pm-stage').textContent()).includes(p.name));
  await display.waitForTimeout(4000);current=await state();assert.equal(current.scene,'vs_card');assert.equal(current.version,game.body.version);assert.equal(current.flow.completedMatches,0);assert.equal(current.flow.canStart,true);report.matchStartHold=true;
  report.d1Current=await d1('SELECT e.bm_current_match_id,s.current_match_id,m.team_a_id,m.team_b_id,m.winner_team_id FROM events e JOIN event_state s ON s.event_id=e.id LEFT JOIN matches m ON m.id=s.current_match_id WHERE e.id=?');assert.equal(report.d1Current[0].bm_current_match_id,current.flow.currentMatch.id);assert.equal(report.d1Current[0].current_match_id,`${eventId}-bm-${current.flow.currentMatch.id}`);assert.equal(report.d1Current[0].winner_team_id,null);
  await display.reload();await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();assert.equal((await state()).version,current.version);await display.screenshot({path:output+'/04-first-vs-start-wait.png'});report.reloadStable=true;
  const afterRoster=await (await original.request.get(source+'/api/checkin/roster')).json();assert.deepEqual(afterRoster,sourceRoster);report.sourceRosterUnchanged=true;
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);report.complete=true;save();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,states:report.states,revealed:report.revealed,confirmed:report.confirmed,holds:[report.announcementHold,report.gameStartHold,report.matchStartHold],errors:report.errors,httpFailures:report.httpFailures}));
 }catch(e){save();console.error(e.name+': verification failed; inspect saved stage without exposing request cookies');process.exitCode=1;}finally{await browser.close();}
})();


