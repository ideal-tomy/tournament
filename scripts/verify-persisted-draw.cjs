// Real public API/UI verification. Default target is the isolated, closed four-person test event.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||'https://tournament-checkin-e2e.pine-shaken.workers.dev';
assert.ok(['https://tournament-checkin-e2e.pine-shaken.workers.dev','https://tournament-checkin-rehearsal.pine-shaken.workers.dev'].includes(root));
const output=process.argv[3]||'.wrangler/draw-e2e';
const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
async function d1(sql,params){const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];const r=await fetch('https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});const errors=[],failures=[];
 const report={root,checkedAt:new Date().toISOString(),photoSource:root.includes('-e2e.')?'Previously registered test-image uploads; not four physical smartphone captures':'D1 participants registered through reception',playersRevealed:[],pairsConfirmed:[]};
 try{
  const operations=await browser.newContext({viewport:{width:1280,height:900}}),monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  const admin=await operations.newPage(),display=await monitor.newPage();
  for(const page of [admin,display]){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!(r.status()===401&&new URL(r.url()).pathname==='/api/session'))failures.push({path:new URL(r.url()).pathname,status:r.status()});});}
  async function login(page,route){await page.goto(root+route);await page.getByLabel('確認コード',{exact:true}).fill(secrets.REHEARSAL_ACCESS_CODE);await page.getByRole('button',{name:'確認して開く',exact:true}).click();}
  await login(admin,'/admin');await admin.getByRole('heading',{name:'Draw運営',exact:true}).waitFor();
  let before=await operations.request.get(root+'/api/draw/state').then(r=>r.json());
  if(process.env.WAIT_FOR_DRAW_ROSTER==='1'){
   const until=Date.now()+10*60*1000;let previous=-1;
   while((before.participants.length<4||before.participants.length%2!==0)&&Date.now()<until){if(previous!==before.participants.length){console.log(JSON.stringify({waitingForRegisteredRoster:true,count:before.participants.length}));previous=before.participants.length;}await admin.waitForTimeout(3000);before=await operations.request.get(root+'/api/draw/state').then(r=>r.json());}
  }
  assert.ok(before.participants.length>=4&&before.participants.length%2===0,'Need >=4 registered participants. Never fabricate real participant data.');
  if(before.checkinStatus==='open'&&process.env.CLOSE_RECEPTION_FOR_DRAW==='1'){
   await admin.goto(root+'/checkin');await admin.getByRole('button',{name:'受付終了',exact:true}).waitFor();await admin.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='受付終了'&&!b.disabled));admin.once('dialog',d=>d.accept());const closed=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkin/close');await admin.getByRole('button',{name:'受付終了',exact:true}).click();assert.equal((await closed).status(),200);await admin.getByRole('heading',{name:/受付完了/}).waitFor();await admin.screenshot({path:output+'/reception-closed.png',fullPage:true});await admin.goto(root+'/admin');await admin.getByRole('heading',{name:'Draw運営',exact:true}).waitFor();before=await operations.request.get(root+'/api/draw/state').then(r=>r.json());report.receptionClosedThroughUi=true;
  }
  assert.equal(before.checkinStatus,'closed','Reception must be closed before Draw verification.');report.eventId=before.eventId;report.participantCount=before.participants.length;
  await login(display,'/display');
  // Warm the actual pre-existing Draw assets before starting the venue scene.
  await display.evaluate(async()=>{const sources=['backgrounds/card-table-bg.webp','cards/card-front.webp','cards/card-back.webp','cards/impact-mark.png','darts/dart-main.png','darts/dart-motion-streak.png','effects/impact-flash.png','effects/golden-sparks.png','effects/blue-ring.png','effects/impact-cloud.png','effects/debris.png','frames/nameplate.png','frames/team-plate.png'];await Promise.all(sources.map(src=>{const i=new Image();i.src='/tournament-effects/'+src;return i.decode();}));});
  for(const p of before.participants){const r=await monitor.request.get(root+p.portraitUrl);assert.equal(r.status(),200);assert.match(r.headers()['content-type'],/^image\//);assert.ok((await r.body()).length>1000);}
  let committed=before;
  if(!before.session){
   admin.once('dialog',d=>d.accept());const response=admin.waitForResponse(r=>new URL(r.url()).pathname==='/api/draw/start');await admin.getByRole('button',{name:'Draw開始',exact:true}).click();const result=await response;assert.equal(result.status(),200,await result.text());committed=await result.json();
   const submitted=result.request().postDataJSON();
   const retries=await Promise.all([submitted,{requestId:crypto.randomUUID(),expectedVersion:0}].map(data=>operations.request.post(root+'/api/draw/start',{headers:{Origin:root},data})));
   for(const retry of retries){assert.equal(retry.status(),200);const repeated=await retry.json();assert.deepEqual(repeated.teams,committed.teams);assert.deepEqual(repeated.session,committed.session);}report.retryStable=true;
  }
  report.session=committed.session;report.teams=committed.teams;
  assert.equal(committed.teams.length,committed.participants.length/2);
  assert.deepEqual([...new Set(committed.teams.flatMap(t=>t.memberIds))].sort(),committed.participants.map(p=>p.id).sort());
  const players=new Set(),pairs=new Set();let reloaded=false;const deadline=Date.now()+90000;
  if(committed.scene==='draw')await display.locator('.live-draw-stage').waitFor();
  while(Date.now()<deadline){
   if(await display.locator('[data-draw-scene="bracket"]').count())break;
   const visible=await display.evaluate(()=>{
    const shown=e=>{const c=getComputedStyle(e);return c.visibility!=='hidden'&&Number(c.opacity)>.95;};
    return {players:[...document.querySelectorAll('.draw-reveal-card')].filter(shown).filter(e=>[...e.querySelectorAll('.draw-player-reveal')].every(shown)).flatMap(e=>[...e.querySelectorAll('img[alt]')].filter(i=>i.src.includes('/api/events/')).map(i=>i.alt)),pairs:[...document.querySelectorAll('.draw-pair-stage')].filter(shown).map(e=>({names:[...e.querySelectorAll('img[alt]')].filter(i=>i.src.includes('/api/events/')).map(i=>i.alt),title:e.querySelector('p')?.textContent,confirmed:e.textContent.includes('PAIR CONFIRMED')})),summary:[...document.querySelectorAll('.draw-team-summary')].some(shown)};
   });
   visible.players.forEach(name=>players.add(name));
   for(const pair of visible.pairs){assert.equal(pair.confirmed,true);const key=pair.names.join(' & ');if(!pairs.has(key)){pairs.add(key);report.pairsConfirmed.push(pair);await display.screenshot({path:`${output}/pair-${pairs.size}.png`});}}
   if(visible.summary&&!report.summary){report.summary=true;await display.screenshot({path:output+'/all-pairs.png'});}
   // Reconnect while the draw is in progress, using persisted time and pairs.
   if(pairs.size===1&&!reloaded){const restored=await monitor.request.get(root+'/api/draw/state').then(r=>r.json());assert.deepEqual(restored.teams,committed.teams);await display.reload();reloaded=true;report.midDrawReloadStable=true;}
   await display.waitForTimeout(160);
  }
  await display.locator('[data-draw-scene="bracket"]').waitFor({timeout:10000});await display.getByRole('img',{name:'トーナメント表',exact:true}).waitFor();
  const done=await monitor.request.get(root+'/api/draw/state').then(r=>r.json());assert.equal(done.scene,'bracket');assert.deepEqual(done.teams,committed.teams);assert.deepEqual(done.session,committed.session);report.playersRevealed=[...players];
  if(!before.session){assert.deepEqual([...players].sort(),committed.participants.map(p=>p.name).sort());assert.equal(pairs.size,committed.teams.length);assert.equal(report.summary,true);}
  await display.screenshot({path:output+'/bracket.png'});await display.reload();await display.getByRole('img',{name:'トーナメント表',exact:true}).waitFor();const restored=await monitor.request.get(root+'/api/draw/state').then(r=>r.json());assert.deepEqual(restored.teams,committed.teams);report.bracketReloadStable=true;
  const sessions=await d1('SELECT id,reveal_order FROM draw_sessions WHERE event_id=? AND committed_at IS NOT NULL',[done.eventId]);assert.equal(sessions.length,1);assert.equal(sessions[0].id,done.session.id);assert.deepEqual(JSON.parse(sessions[0].reveal_order),done.session.revealOrder);
  const members=await d1('SELECT t.id,t.name,m.participant_id,m.position FROM teams t JOIN team_members m ON m.team_id=t.id WHERE t.event_id=? ORDER BY t.seed,m.position',[done.eventId]);assert.equal(members.length,done.participants.length);for(const team of done.teams)assert.deepEqual(members.filter(m=>m.id===team.id).map(m=>m.participant_id),team.memberIds);
  const snapshot=await d1('SELECT bracket_snapshot FROM events WHERE id=?',[done.eventId]);assert.deepEqual(JSON.parse(snapshot[0].bracket_snapshot),done.bracket);report.d1={drawSessions:sessions.length,teams:done.teams.length,teamMembers:members.length,bracketMatches:done.bracket.match.length};
  for(const p of done.participants){await display.locator(`svg image[href^="${p.portraitUrl}"]`).first().waitFor();}
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);report.errors=errors;report.failures=failures;report.publicFlowVerified=!before.session;report.complete=true;report.version=done.version;
  fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){for(const [i,c] of browser.contexts().entries())for(const [j,p] of c.pages().entries())await p.screenshot({path:`${output}/failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});fs.writeFileSync(output+'/progress.json',JSON.stringify({...report,errors,failures},null,2));throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
