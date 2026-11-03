// Local, isolated user-flow check for the shared-run guidance and manual first operations.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {parseEnv}=require('node:util');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root='http://localhost:5174',out='.wrangler/shared-run-ux';
const code=parseEnv(fs.readFileSync('cloudflare/local/.dev.vars','utf8')).REHEARSAL_ACCESS_CODE;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const report={root,startedAt:new Date().toISOString(),steps:[],run:null,errors:[]};
 const save=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
 try{
  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['camera']});
  const pc=await browser.newContext({viewport:{width:1440,height:1000}});
  const p=await phone.newPage(),admin=await pc.newPage(),display=await pc.newPage();
  for(const page of [p,admin,display])page.on('pageerror',e=>report.errors.push(e.message));
  async function login(page){await page.goto(root+'/');await page.getByLabel('確認コード',{exact:true}).fill(code);await page.getByRole('button',{name:'確認して開く',exact:true}).click();}
  await login(p);await p.getByRole('heading',{name:'当日運用の入口',exact:true}).waitFor();
  assert.equal(await p.getByRole('link',{name:'大会を準備して連動を確認',exact:true}).count(),1);
  assert.equal(await p.getByText('Supabase',{exact:false}).count(),0);
  assert.equal(await p.getByRole('link',{name:'Animation Preview',exact:true}).isVisible(),false);
  await p.screenshot({path:out+'/home.png',fullPage:true});report.steps.push('整理されたTOPと隠れた開発ツール');
  await p.getByRole('link',{name:'大会を準備して連動を確認',exact:true}).click();
  await p.getByLabel('演出時間').selectOption('fast');
  await p.getByRole('button',{name:'新しい確認用大会を準備',exact:true}).click();
  await p.getByRole('heading',{name:/スマホ受付を続けてください/}).waitFor();
  report.run=new URL(p.url()).searchParams.get('run');assert.match(report.run,/^cf-through-/);
  for(const [name,path] of [['① スマホ受付','/checkin'],['② 運営（スマホ・PC）','/admin'],['③ 会場モニター','/display']]){
   const link=p.getByRole('link',{name,exact:true}),href=new URL(await link.getAttribute('href'),root);
   assert.equal(href.pathname,path);assert.equal(href.searchParams.get('run'),report.run);
   assert.equal((await admin.goto(root+path+'?run='+report.run)).status(),200);
  }
  const qr=p.getByRole('img',{name:'受付QR',exact:true});await qr.waitFor();
  const qrData=new URL(await qr.getAttribute('src')).searchParams.get('data');
  assert.equal(qrData,root+'/checkin?run='+report.run);
  report.steps.push('3リンクと受付QRが同じrunを指定');
  await login(admin);await admin.goto(root+'/admin?run='+report.run);
  await admin.getByRole('heading',{name:'大会運営',exact:true}).waitFor();
  await display.goto(root+'/display?run='+report.run);
  await display.getByRole('heading',{name:'会場表示 · 待機中',exact:true}).waitFor();
  assert.equal(await display.locator('.run-context').count(),0);
  report.steps.push('別PCセッションでAdmin/Displayを表示。Displayに運営用バナーなし');
  await p.goto(root+'/checkin?run=cf-through-'+randomUUID());
  await p.locator('.run-context [role=alert]').waitFor();
  report.steps.push('存在しない大会IDの受付で警告を表示');
  await p.goto(root+'/checkin?run='+report.run);
  await p.locator('.run-context').getByText(report.run.slice(-12)).waitFor();
  assert.equal(await p.locator('.run-context [role=alert]').count(),0);
  const people=[];
  for(let i=0;i<4;i++){
   const name='連動確認 '+(i+1);
   await p.getByLabel('名前',{exact:false}).fill(name);await p.getByLabel('rating',{exact:false}).fill(String(i+5));
   await p.getByRole('button',{name:'カメラを起動',exact:true}).click();await p.getByRole('button',{name:'写真を撮影',exact:true}).click();
   await p.getByRole('button',{name:'参加者を登録',exact:true}).click();await p.getByRole('heading',{name,exact:true}).waitFor();
   people.push(name);
  }
  const status=await p.evaluate(async run=>(await(await fetch('/api/rehearsal/status?run='+run)).json()),report.run);
  assert.equal(status.participants.length,4);report.steps.push('受付APIへ4名を登録。D1/R2経由で同一大会状態を取得');
  await admin.getByRole('button',{name:'今すぐ更新',exact:true}).click();
  await admin.getByRole('heading',{name:people[0],exact:true}).waitFor();
  await display.locator('.display-wait-count',{hasText:'登録 4 名'}).waitFor({timeout:12000});
  report.steps.push('別セッションのAdminへ受付内容、Displayへ登録人数が反映');
  await admin.once('dialog',d=>d.accept());await admin.getByRole('button',{name:'受付終了',exact:true}).click();
  await admin.getByRole('button',{name:'ペア発表開始',exact:true}).waitFor({timeout:15000});
  await admin.once('dialog',d=>d.accept());await admin.getByRole('button',{name:'ペア発表開始',exact:true}).click();
  await display.locator('[data-draw-scene=draw] .live-draw-stage').waitFor({timeout:15000});
  report.steps.push('Admin操作で受付を閉じ、Displayがペア発表演出へ遷移');
  await display.waitForTimeout(2000);await display.screenshot({path:out+'/display-pair-reveal.png'});
  assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.error=e.message.split('\n')[0];process.exitCode=1;}
 finally{report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e.message.split('\n')[0]);process.exitCode=1;});
