// Explicitly prepares a fresh SHOW run on the existing canonical Worker only.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev';
const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
const output='.wrangler/rehearsal32-ready';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const host=new URL(root).hostname,ip=await new Promise((resolve,reject)=>require('node:dns').lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',args:['--disable-quic',`--host-resolver-rules=MAP ${host} ${ip}`]});
 const report={root,startedAt:new Date().toISOString(),errors:[],routes:{}};
 try{
  const c=await browser.newContext({viewport:{width:1440,height:1000}});
  assert.equal((await c.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secrets.REHEARSAL_ACCESS_CODE}})).status(),200);
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(root+'/rehearsal');await p.getByLabel('参加者の準備').selectOption('sample32');await p.getByLabel('新規大会の確認速度').selectOption('show');
  await p.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();
  const deadline=Date.now()+120000;while(Date.now()<deadline){if(await p.getByText('参加者準備完了・受付中',{exact:true}).count())break;await p.waitForTimeout(300);}
  report.run=new URL(p.url()).searchParams.get('run');assert.match(report.run,/^cf-through-/);
  await p.goto(root+'/admin?run='+report.run);await p.getByRole('heading',{name:'大会運営',exact:true}).waitFor();
  p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'受付終了',exact:true}).click();await p.getByRole('button',{name:'ペア発表開始',exact:true}).waitFor({timeout:60000});
  const r=await p.evaluate(async run=>{const response=await fetch('/api/rehearsal/status?run='+run,{credentials:'same-origin',cache:'no-store'});return {status:response.status,body:await response.json()};},report.run);assert.equal(r.status,200);const s=r.body;
  assert.equal(s.participants.length,32);assert.equal(s.teams.length,16);assert.equal(s.bracket.match.length,15);assert.equal(s.scene,'idle');assert.equal(s.timingPreset,'show');assert.equal(s.integrity.consistent,true);
  report.participants=32;report.teams=16;report.matches=15;report.scene=s.scene;report.version=s.version;report.checkinStatus=s.checkinStatus;
  for(const route of ['/rehearsal','/admin','/display','/checkin','/show-preview']){
   const url=root+route+'?run='+report.run;assert.equal((await p.goto(url)).status(),200);await p.reload();await p.locator('h1').first().waitFor();
   report.routes[route]=url;if(route==='/admin')await p.screenshot({path:output+'/admin-ready.png',fullPage:true});
  }
  assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.error=e.message;process.exitCode=1;}
 finally{fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
})();
