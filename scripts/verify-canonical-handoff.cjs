const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 let p;
 try{
  p=await browser.newPage({viewport:{width:1440,height:1000}});
  await p.goto(root+'/');await p.getByLabel('確認コード',{exact:true}).fill(JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local')).REHEARSAL_ACCESS_CODE);
  await p.getByRole('button',{name:'確認して開く',exact:true}).click();await p.getByRole('heading',{name:'大会リハーサル',exact:true}).waitFor();
  const ready=JSON.parse(fs.readFileSync('docs/environment-verification/smartphone-ready.json'));
  const routes=[];
  for(const [route,url] of Object.entries(ready.urls)){
   assert.equal((await p.goto(url)).status(),200);await p.reload();await p.locator('h1').first().waitFor();
   routes.push(route);
  }
  const test=JSON.parse(fs.readFileSync('docs/environment-verification/public/result.json'));assert.equal(test.complete,true);
  await p.goto(root+'/admin?run='+test.run);
  await p.waitForFunction(()=>[...document.querySelectorAll('.participants img')].filter(i=>i.complete&&i.naturalWidth>0).length===8);
  await p.getByText('対象 8名 · 受付終了',{exact:true}).waitFor();
  await p.screenshot({path:'docs/environment-verification/public/admin.png',fullPage:true});
  const js=fs.readdirSync('dist-checkin/assets').filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync('dist-checkin/assets/'+x,'utf8')).join('');
  for(const value of Object.values(JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local'))))if(typeof value==='string'&&value.length>=16)assert.equal(js.includes(value),false);
  const r={readyRun:ready.run,routes,adminRun:test.run,adminDecodedPortraits:8,secretsAbsentFromBundle:true,complete:true,checkedAt:new Date().toISOString()};
  fs.writeFileSync('docs/environment-verification/handoff.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));
 }catch(e){if(p)console.log(JSON.stringify(await p.evaluate(()=>({url:location.pathname,headings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent),images:[...document.querySelectorAll('.participants img')].map(x=>({alt:x.alt,complete:x.complete,width:x.naturalWidth})),text:document.body.innerText.slice(0,550)}))));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e.message.split('\n')[0]);process.exitCode=1;});
