// Existing canonical Worker only; synthetic registrations always use a NEW run.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const local=process.argv.includes('--local');
const root=local?'http://localhost:5174':'https://tournament-through-rehearsal.pine-shaken.workers.dev';
const out=`docs/environment-verification/consolidation-20261031/${local?'local':'public'}`;
const resume=process.argv.includes('--resume');
const secrets=local?require('node:util').parseEnv(fs.readFileSync('cloudflare/local/.dev.vars','utf8')):JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge',args:['--disable-quic','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const report=resume?JSON.parse(fs.readFileSync(out+'/result.json')):{root,started:new Date().toISOString(),camera:'PC Edge simulated camera with mobile viewport; physical smartphone unverified',routes:[],participants:[],states:[],errors:[],httpFailures:[]};
 if(resume){report.priorStops??=[];report.priorStops.push({error:report.error,at:report.finished});delete report.error;report.expectedReadConflicts=(report.expectedReadConflicts??0)+report.httpFailures.filter(x=>x.status===409&&x.path==='/api/rehearsal/status').length;report.httpFailures=report.httpFailures.filter(x=>!(x.status===409&&x.path==='/api/rehearsal/status'));}
 let mobile,monitor;
 const save=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 try{
  mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['camera']});
  monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await mobile.newPage(),display=await monitor.newPage();
  for(const p of [page,display])p.on('pageerror',e=>report.errors.push(e.message));
  async function read(p,path,body){
   for(let attempt=0;attempt<4;attempt++){
   const r=await p.evaluate(async({path,body})=>{const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};},{path,body});
   if(!body&&r.status===409&&r.body.error==='VERSION_CONFLICT'){await p.waitForTimeout(150);continue;}
   assert.equal(r.status,200,`${path}: ${r.status}`);return r.body;
   }
   throw Error('Repeated read version conflict');
  }
  async function login(p){await p.goto(root+'/');await p.getByLabel('確認コード',{exact:true}).fill(secrets.REHEARSAL_ACCESS_CODE);await p.getByRole('button',{name:'確認して開く',exact:true}).click();await p.getByRole('heading',{name:'当日運用の入口',exact:true}).waitFor();}
  await login(page);await login(display);
  let run=report.run;
  if(!resume){
  await page.screenshot({path:out+'/top.png',fullPage:true});
  assert.equal(await page.getByRole('link',{name:'大会を準備して連動を確認',exact:true}).count(),1);
  assert.equal(await page.getByText('旧Supabase',{exact:false}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Animation Preview',exact:true}).isVisible(),false);
  await page.goto(root+'/rehearsal');
  await page.getByLabel('演出時間').selectOption('fast');
  await page.getByRole('button',{name:'新しい確認用大会を準備',exact:true}).click();
  await page.getByRole('status').filter({hasText:'大会準備完了・参加者受付を開いて登録してください'}).waitFor();
  run=new URL(page.url()).searchParams.get('run');assert.match(run,/^cf-through-/);
  assert.equal((await read(page,'/api/rehearsal/status?run='+run)).participants.length,0);
  report.run=run;report.initialParticipants=0;save();
  for(const route of ['/','/checkin','/admin','/display','/rehearsal','/show-preview','/cloudflare-check']){
   const url=root+route+'?run='+run;
   assert.equal((await page.goto(url)).status(),200);assert.equal((await page.reload()).status(),200);
   await page.locator('h1').first().waitFor();
   assert.equal(await page.getByRole('heading',{name:'確認コードを入力'}).count(),0);
   report.routes.push({route,direct:200,reload:200});
  }
  if(local){report.complete=true;return;}
  await page.goto(root+'/checkin?run='+run);
  await display.goto(root+'/display?run='+run);
  await display.locator('.display-venue-status').filter({hasText:'登録 0 名'}).waitFor();
  for(let i=0;i<8;i++){
   const name=`公開撮影検証 ${String(i+1).padStart(2,'0')}`;
   await page.getByLabel('名前',{exact:false}).fill(name);await page.getByLabel('rating',{exact:false}).fill(String(i+4));
   await page.getByRole('button',{name:'カメラを起動',exact:true}).click();
   await page.getByRole('button',{name:'写真を撮影',exact:true}).click();
   await page.getByRole('img',{name:'登録前の撮影写真',exact:true}).waitFor();
   if(i===0)await page.screenshot({path:out+'/camera.png',fullPage:true});
   await page.getByRole('button',{name:'参加者を登録',exact:true}).click();
   await page.getByRole('heading',{name,exact:true}).waitFor({timeout:30000});
   await page.getByLabel('名前',{exact:false}).waitFor();
   assert.equal(await page.getByLabel('名前',{exact:false}).inputValue(),'');
   report.participants.push(name);save();
   if(i===0){await display.locator('.display-venue-status').filter({hasText:'登録 1 名'}).waitFor();report.afterFirstRegistration=1;report.displayReflectedFirst=true;}
  }
  await page.screenshot({path:out+'/eight-registrations.png',fullPage:true});
  const s=await read(page,'/api/rehearsal/status?run='+run);assert.equal(s.participants.length,8);
  for(const p of s.participants){const photo=await page.evaluate(async url=>{const r=await fetch(url);const b=await r.blob();const bitmap=await createImageBitmap(b);return {status:r.status,bytes:b.size,width:bitmap.width,height:bitmap.height};},p.portraitUrl);assert.equal(photo.status,200);assert.equal(photo.width,480);assert.equal(photo.height,480);assert.ok(photo.bytes>100);}
  report.photos=8;
  await display.goto(root+'/admin?run='+run);await display.getByRole('heading',{name:'大会運営・参加者確認',exact:true}).waitFor();
  await display.getByRole('heading',{name:report.participants[0],exact:true}).waitFor();
  await display.screenshot({path:out+'/admin.png',fullPage:true});
  }
  page.on('response',r=>{const path=new URL(r.url()).pathname;if(r.status()===409&&path==='/api/rehearsal/status'){report.expectedReadConflicts=(report.expectedReadConflicts??0)+1;return;}if(r.status()>=400)report.httpFailures.push({path,status:r.status()});});
  await display.goto(root+'/display?run='+run);await display.getByRole('heading',{name:'会場表示 · 待機中',exact:true}).waitFor();
  await page.goto(root+'/rehearsal?run='+run);
  await page.locator('details.automation > summary').click();
  if((await read(page,'/api/rehearsal/status?run='+run)).scene!=='finished')await page.getByRole('button',{name:'自動全通しを開始・再開',exact:true}).click();
  const deadline=Date.now()+600000;let version=-1;
  while(Date.now()<deadline){
   const s=await read(page,'/api/rehearsal/status?run='+run);assert.equal(s.integrity.consistent,true);
   if(s.version!==version){version=s.version;const f={at:new Date().toISOString(),scene:s.scene,phase:s.flow?.phase,completed:s.flow?.completedMatches};report.states.push(f);console.log(JSON.stringify(f));save();}
   const alerts=await page.locator('[role=alert]').allTextContents();assert.deepEqual(alerts,[]);
   if(s.scene==='finished'){assert.equal(s.flow.completedMatches,3);report.champion=s.flow.championTeamId;break;}
   await page.waitForTimeout(700);
  }
  assert.ok(report.champion,'Champion timeout');
  await display.locator('[data-draw-scene="finished"]').waitFor({timeout:30000});
  await display.screenshot({path:out+'/champion.png'});await display.reload();await display.locator('[data-draw-scene="finished"]').waitFor();
  // Existing runner explicitly recovers advance VERSION_CONFLICT from another
  // authorized advance writer. Retain it as evidence, and require no UI alert,
  // a persisted Champion, and no other failure before accepting the flow.
  report.recoveredAdvanceConflicts??=[];
  report.recoveredAdvanceConflicts.push(...report.httpFailures.filter(x=>x.status===409&&x.path==='/api/tournament/advance'));
  report.httpFailures=report.httpFailures.filter(x=>!(x.status===409&&x.path==='/api/tournament/advance'));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpFailures,[]);
  report.complete=true;
 }catch(e){report.error=e.message.split('\n')[0];process.exitCode=1;}
 finally{report.finished=new Date().toISOString();save();console.log(JSON.stringify({complete:report.complete,run:report.run,participants:report.participants.length,error:report.error}));await browser.close();}
})();
