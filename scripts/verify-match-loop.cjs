// Public rehearsal only. Eight explicitly labelled test registrations reuse four saved real portraits.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const root='https://tournament-match-loop-e2e.pine-shaken.workers.dev';
const source='https://tournament-checkin-rehearsal.pine-shaken.workers.dev';
const eventId='cf-match-loop-e2e-20261025',output='.wrangler/match-loop-e2e';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function until(page,predicate,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(predicate))return;await page.waitForTimeout(80);}throw Error('Public UI condition timed out');}
async function d1(sql){const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];const r=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[eventId]})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
 const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const resume=process.env.RESUME_MATCH_LOOP==='1';
 const report=resume?JSON.parse(fs.readFileSync(output+'/progress.json','utf8')):{root,eventId,photoSource:'Four saved real portraits each reused for two explicitly labelled test registrations. Not eight real people or new camera captures.',states:[],participants:[],errors:[],httpFailures:[],advanceRaces:0,operatorActions:[]};
 const save=()=>fs.writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));
 try{
  const operator=await browser.newContext({viewport:{width:1440,height:1000}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}}),original=await browser.newContext();
  const auth=async(context,url)=>{const r=await context.request.post(url+'/api/session',{headers:{Origin:url},data:{code:secrets.REHEARSAL_ACCESS_CODE}});assert.equal(r.status(),200);};
  await auth(operator,root);await auth(monitor,root);await auth(original,source);
  const state=async()=>{const r=await operator.request.get(root+'/api/draw/state',{maxRetries:3});assert.equal(r.status(),200);return r.json();};
  const post=async(endpoint,body)=>operator.request.post(root+endpoint,{headers:{Origin:root},data:body,maxRetries:3});
  const sourceRoster=await(await original.request.get(source+'/api/checkin/roster',{maxRetries:3})).json();assert.equal(sourceRoster.participants.length,4);
  let current=await state();assert.equal(current.eventId,eventId);
  if(!resume){assert.equal(current.checkinStatus,'open');assert.equal(current.session,null);const existing=current.participants;
   for(const group of ['A','B'])for(const p of sourceRoster.participants){const name=`${p.name}（進行検証${group}）`;const photo=await original.request.get(source+p.portraitUrl,{maxRetries:3});assert.equal(photo.status(),200);const bytes=await photo.body();let saved=existing.find(e=>e.name===name);if(!saved){const r=await post('/api/participants',{requestId:randomUUID(),name,rating:p.rating,photo:`data:image/jpeg;base64,${bytes.toString('base64')}`});assert.equal(r.status(),201);saved=(await r.json()).participant;}assert.equal(saved.rating,p.rating);const copied=await operator.request.get(root+saved.portraitUrl,{maxRetries:3});assert.equal(sha(await copied.body()),sha(bytes));report.participants.push({id:saved.id,name,rating:p.rating,sourceId:p.id,portraitUrl:saved.portraitUrl,photoSha256:sha(bytes)});save();}
  }
  const admin=await operator.newPage(),display=await monitor.newPage();
  for(const page of [admin,display]){page.on('pageerror',e=>report.errors.push(e.message));page.on('response',async r=>{if(r.status()<400)return;const url=new URL(r.url());if(r.status()===409&&url.pathname==='/api/tournament/advance'){const b=await r.json();if(['VERSION_CONFLICT','SCENE_NOT_FINISHED'].includes(b.error)){report.advanceRaces++;return;}}report.httpFailures.push({path:url.pathname,status:r.status()});});}
  await admin.goto(root+'/admin');await display.goto(root+'/display');
  const click=async(name,endpoint,confirm=false)=>{if(confirm)admin.once('dialog',d=>d.accept());const response=admin.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()==='POST');await admin.getByRole('button',{name,exact:true}).click();const r=await response;assert.equal(r.status(),200);const value={body:await r.json(),request:r.request().postDataJSON()};report.operatorActions.push(endpoint);save();return value;};
  const record=async(step)=>{const s=await state();const row={step,scene:s.scene,phase:s.flow?.phase,version:s.version,sceneSeq:s.sceneSeq,currentMatch:s.flow?.currentMatch?.id??null};report.states.push(row);save();console.log(JSON.stringify(row));return s;};
  if(!resume){await until(admin,()=>document.body.textContent.includes('対象 8名'));await click('受付終了','/api/checkin/close',true);await click('ペア発表開始','/api/draw/start',true);await record('announcement');}
  current=await state();if(current.scene==='draw'||(current.scene==='bracket'&&current.flow.phase!=='bracket_update')){await display.locator('[data-draw-scene="bracket"]').waitFor({timeout:150000});await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='ゲームスタート'&&!b.disabled));await click('ゲームスタート','/api/tournament/game-start');}
  current=await state();
  if(current.scene==='vs_card'&&current.flow.completedMatches===0){
   await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));current=await record('first-vs-wait');
   report.firstMatch=current.flow.currentMatch;report.teams=current.teams;report.sessionId=current.session.id;save();
   await display.waitForTimeout(4000);assert.equal((await state()).version,current.version);report.firstStartHold=true;
   const started=await click('試合開始','/api/tournament/start');report.startRequest=started.request;assert.equal(started.request.matchId,undefined);assert.equal(started.body.flow.currentMatch.id,report.firstMatch.id);await display.locator('[data-draw-scene="match_live"]').waitFor();await record('first-match-live');
   assert.equal((await post('/api/tournament/start',started.request)).status(),200);assert.equal((await post('/api/tournament/start',{...started.request,requestId:randomUUID()})).status(),409);report.doubleStartProtected=true;
  }
  current=await state();
  if(current.scene==='match_live'){
   const match=report.firstMatch;assert.equal(current.flow.currentMatch.id,match.id);assert.equal(await admin.getByRole('combobox').count(),0);
   await until(admin,()=>document.querySelectorAll('.current-teams img').length===4);await admin.locator('.current-teams img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));const operatorText=await admin.locator('.current-match').textContent();assert.ok(operatorText.includes(`Round ${match.round}`));assert.ok(operatorText.includes(`Match #${match.id+1}`));assert.ok(operatorText.includes('Team A'));assert.ok(operatorText.includes('Team B'));await admin.screenshot({path:output+'/01-match-live-operator.png',fullPage:true});
   await display.reload();await display.locator('[data-draw-scene="match_live"]').waitFor();assert.equal((await state()).flow.currentMatch.id,match.id);report.liveReloadStable=true;
   const winner=current.teams.find(t=>t.id===match.teamA);report.winnerTeam=winner;save();
   const scored=await click(`${winner.name} の勝利を確定`,'/api/tournament/winner',true);report.winnerRequest=scored.request;assert.equal(scored.body.scene,'result');assert.equal(scored.body.flow.winnerTeamId,winner.id);assert.equal(scored.request.matchId,undefined);report.resultVersion=scored.body.version;await record('winner-persisted');save();
   await until(display,()=>{const e=document.querySelector('[data-draw-scene="result"] .pm-win');return !!e&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>.95;});
   await display.locator('.pm-winner img[src*="/portrait"]').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));assert.equal(await display.locator('.pm-winner img[src*="/portrait"]').count(),2);for(const id of winner.memberIds){const p=report.participants.find(p=>p.id===id);assert.ok((await display.locator('.pm-winner').textContent()).includes(p.name));}await display.screenshot({path:output+'/02-winner.png'});report.winnerVisual=true;save();
   // Same committed command succeeds; changing the winner or replaying stale state cannot overwrite it.
   assert.equal((await post('/api/tournament/winner',scored.request)).status(),200);assert.equal((await post('/api/tournament/winner',{...scored.request,winnerSlot:1})).status(),409);assert.equal((await post('/api/tournament/winner',{...scored.request,requestId:randomUUID(),winnerSlot:1})).status(),409);report.doubleWinnerProtected=true;
   const stored=await d1('SELECT id,status,winner_team_id,loser_team_id FROM matches WHERE event_id=? ORDER BY sequence');const played=stored.find(m=>m.id===`${eventId}-bm-${match.id}`);assert.equal(played.status,'done');assert.equal(played.winner_team_id,winner.id);assert.equal(stored.filter(m=>m.status==='done').length,1);report.d1MatchesAfterWinner=stored;
   const snapshot=scored.body.bracket,winnerNumeric=snapshot.participant.find(p=>p.name===winner.id).id;assert.ok(snapshot.match.some(m=>m.id!==match.id&&(m.opponent1?.id===winnerNumeric||m.opponent2?.id===winnerNumeric)));report.winnerAdvanced=true;
  }
  if(!report.updatedBracketVisual){await display.locator('[data-draw-scene="bracket"] svg[role="img"]').waitFor();await display.screenshot({path:output+'/03-updated-bracket.png'});const bracket=await record('automatic-bracket-update');assert.equal(bracket.flow.phase,'bracket_update');assert.equal(bracket.flow.canGameStart,false);assert.equal(bracket.flow.currentMatch,null);assert.equal(await admin.getByRole('button',{name:'ゲームスタート',exact:true}).count(),0);report.updatedBracketVisual=true;save();}
  await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();await until(admin,()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='試合開始'&&!b.disabled));current=await record('second-vs-wait');report.secondMatch=current.flow.currentMatch;assert.notEqual(report.secondMatch.id,report.firstMatch.id);assert.equal(current.flow.completedMatches,1);
  const ready=await d1("SELECT id,sequence,team_a_id,team_b_id,status FROM matches WHERE event_id=? AND status='ready' AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL ORDER BY sequence");assert.equal(ready[0].id,`${eventId}-bm-${report.secondMatch.id}`);assert.equal(ready[0].team_a_id,report.secondMatch.teamA);assert.equal(ready[0].team_b_id,report.secondMatch.teamB);
  await display.locator('.pm-stage img[src*="/portrait"]').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));assert.equal(await display.locator('.pm-stage img[src*="/portrait"]').count(),4);for(const teamId of [report.secondMatch.teamA,report.secondMatch.teamB]){const team=current.teams.find(t=>t.id===teamId);assert.ok((await display.locator('.pm-stage').textContent()).includes(team.name));}
  await display.waitForTimeout(5000);assert.equal((await state()).version,current.version);assert.equal((await state()).scene,'vs_card');report.secondStartHold=true;await display.screenshot({path:output+'/04-second-vs-wait.png'});
  await display.reload();await display.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();assert.equal((await state()).version,current.version);report.waitReloadStable=true;
  report.operationLog=await d1('SELECT request_id,version,action,before_data,after_data FROM operation_log WHERE event_id=? ORDER BY id');assert.equal(report.operationLog.filter(l=>l.action==='flow.start').length,1);assert.equal(report.operationLog.filter(l=>l.action==='flow.winner').length,1);
  report.d1Current=await d1('SELECT e.bm_current_match_id,s.current_match_id,s.scene,s.version,s.scene_seq FROM events e JOIN event_state s ON s.event_id=e.id WHERE e.id=?');assert.equal(report.d1Current[0].bm_current_match_id,report.secondMatch.id);assert.equal(report.d1Current[0].current_match_id,`${eventId}-bm-${report.secondMatch.id}`);
  assert.deepEqual(await(await original.request.get(source+'/api/checkin/roster',{maxRetries:3})).json(),sourceRoster);report.sourceRosterUnchanged=true;
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);report.complete=true;save();fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,states:report.states,first:report.firstMatch,winner:report.winnerTeam,second:report.secondMatch,errors:report.errors,httpFailures:report.httpFailures}));
 }catch(e){save();console.error(e.name+': '+(e.name==='AssertionError'?e.message:'public verification interrupted; resume using saved progress'));process.exitCode=1;}finally{await browser.close();}
})();
