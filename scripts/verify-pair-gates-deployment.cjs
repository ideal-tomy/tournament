// Read-only production compatibility check; never starts or scores a match.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'),assert=require('node:assert/strict'),dns=require('node:dns');
const root='https://tournament-checkin-rehearsal.pine-shaken.workers.dev',preview='https://tournament-animation-preview.pine-shaken.workers.dev';
const output='.wrangler/pair-gates-e2e';
(async()=>{
 const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
 const rules=await Promise.all([root,preview].map(async url=>{const host=new URL(url).hostname;const ip=await new Promise((resolve,reject)=>dns.lookup(host,{family:4},(e,a)=>e?reject(e):resolve(a)));return `MAP ${host} ${ip}`;}));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--disable-quic','--host-resolver-rules='+rules.join(',')]});
 const report={checks:[],errors:[],writes:[]};
 try{
  const context=await browser.newContext();const auth=await context.request.post(root+'/api/session',{headers:{Origin:root},data:{code:secrets.REHEARSAL_ACCESS_CODE}});assert.equal(auth.status(),200);
  const state=async()=>{const r=await context.request.get(root+'/api/draw/state',{maxRetries:3});assert.equal(r.status(),200);return r.json();};const before=await state();assert.equal(before.eventId,'cf-rehearsal-001');assert.equal(before.participants.length,4);assert.equal(before.session.id,'fc819566-8c6a-4d6b-8f6a-08bfaeb3224a');
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))report.writes.push(new URL(r.url()).pathname);});
  for(const [name,viewport] of [['pc',{width:1365,height:900}],['sp',{width:390,height:844}],['monitor',{width:1920,height:1080}]]){
   await page.setViewportSize(viewport);await page.goto(root+'/display');await page.locator('[data-draw-scene="vs_card"] .pm-next').waitFor();await page.locator('.pm-stage img[src*="/portrait"]').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));assert.equal(await page.locator('.pm-stage img[src*="/portrait"]').count(),4);assert.equal(await page.getByRole('button').count(),0);await page.screenshot({path:`${output}/primary-${name}.png`});report.checks.push({screen:'display',name,viewport,photos:4});
  }
  await page.goto(root+'/admin');await page.getByRole('button',{name:'試合開始',exact:true}).waitFor();assert.equal(await page.getByRole('combobox').count(),0);
  await page.goto(root+'/show-preview');await page.locator('.pm-stage,.draw-reveal-card').first().waitFor({state:'attached'});report.checks.push({screen:'real-participant-preview',available:true});
  for(const script of await page.locator('script[src]').evaluateAll(elements=>elements.map(e=>e.src))){const text=await(await context.request.get(script)).text();for(const secret of Object.values(secrets))assert.equal(text.includes(secret),false);assert.equal(/ADMIN_API_TOKEN|DISPLAY_API_TOKEN|supabase\.co/.test(text),false);}
  for(const scene of ['draw','vs','result','bracket','next','champion']){await page.goto(`${preview}/?scene=${scene}&mode=full`);await page.locator('main').waitFor();report.checks.push({screen:'standalone-preview',scene,available:true});}
  const after=await state();assert.equal(after.version,before.version);assert.deepEqual(after.teams,before.teams);assert.deepEqual(after.participants,before.participants);assert.equal(after.flow.currentMatch.id,before.flow.currentMatch.id);assert.deepEqual(report.errors,[]);assert.deepEqual(report.writes,[]);report.state={scene:after.scene,version:after.version,session:after.session.id,currentMatch:after.flow.currentMatch.id,completedMatches:after.flow.completedMatches};report.complete=true;fs.writeFileSync(output+'/deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){console.error(e.name+': '+e.message.split('Call log:')[0]);process.exitCode=1;}finally{await browser.close();}
})();
