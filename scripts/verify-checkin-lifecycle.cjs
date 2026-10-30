// Writes ONLY to the explicitly isolated E2E event. Never targets the primary reception.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root='https://tournament-checkin-e2e.pine-shaken.workers.dev';
const eventId='cf-checkin-e2e-20261025', output='.wrangler/checkin-lifecycle-e2e';
const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];
const base='https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786';
async function query(sql,params=[]){const r=await fetch(base+'/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);return b.result[0].results;}
const records=()=>query('SELECT id,display_name,rating,photo_path,checkin_version FROM participants WHERE event_id=?',[eventId]);
async function r2(key){return fetch(base+'/r2/buckets/tournament-rehearsal-portraits/objects/'+key,{headers:{Authorization:`Bearer ${token}`}});}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
 const errors=[];const evidence={root,eventId,photoSource:'Uploaded existing test image files via the real file input; not four physical smartphone camera captures',steps:[]};
 try{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const monitor=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await mobile.newPage(), display=await monitor.newPage();
  for(const p of [page,display])p.on('pageerror',e=>errors.push(e.message));
  async function login(p,url){await p.goto(root+url);await p.getByLabel('確認コード',{exact:true}).fill(secrets.REHEARSAL_ACCESS_CODE);await p.getByRole('button',{name:'確認して開く',exact:true}).click();}
  await login(page,'/checkin');await page.getByRole('heading',{name:'参加者受付',exact:true}).waitFor();
  let edited;
  if(process.env.RESUME_CHECKIN_E2E!=='1'){
  const initial=await records();assert.equal(initial.length,0,'Isolated event must be empty. Do not reset or delete existing data.');
  await login(display,'/display');
  async function register(number,file=number){
   const name=`受付E2E ${String(number).padStart(2,'0')}`;
   await page.getByRole('textbox',{name:/名前/}).fill(name);
   await page.getByLabel('rating',{exact:false}).fill(String(number+2));
   await page.locator('input[type=file]').setInputFiles(`public/images/test${String(file).padStart(2,'0')}.png`);
   await page.locator('img.photo-preview').waitFor();
   const result=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/participants'&&r.request().method()==='POST');
   await page.getByRole('button',{name:'参加者を登録',exact:true}).click();
   const response=await result;assert.equal(response.status(),201,await response.text());
   const saved=(await response.json()).participant;
   await page.getByRole('heading',{name,exact:true}).waitFor();
   await page.waitForFunction(()=>document.querySelector('input[autocomplete=name]')?.value==='');
   evidence.steps.push({action:'create',id:saved.id,name});return saved;
  }
  const people=[];for(let n=1;n<=4;n++)people.push(await register(n));
  await page.getByTestId('participant-count').filter({hasText:'4名'}).waitFor();
  for(const p of people)await display.getByRole('heading',{name:p.name,exact:true}).waitFor({timeout:20000});
  await display.locator('.participant img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await display.screenshot({path:output+'/display-four.png',fullPage:true});
  const before=await records(), oldPhoto=before.find(p=>p.id===people[0].id).photo_path;
  const row=page.locator(`[data-participant-id="${people[0].id}"]`);
  await row.getByRole('button',{name:'編集',exact:true}).click();
  await page.getByRole('textbox',{name:/名前/}).fill('受付E2E 01 編集済み');
  await page.getByLabel('rating',{exact:false}).fill('12.5');
  await page.locator('input[type=file]').setInputFiles('public/images/test05.png');
  const editResult=page.waitForResponse(r=>r.request().method()==='PATCH');
  await page.getByRole('button',{name:'変更を保存',exact:true}).click();assert.equal((await editResult).status(),200);
  await page.getByRole('heading',{name:'受付E2E 01 編集済み',exact:true}).waitFor();
  await display.getByRole('heading',{name:'受付E2E 01 編集済み',exact:true}).waitFor({timeout:20000});
  edited=(await records()).find(p=>p.id===people[0].id);assert.equal(edited.rating,12.5);assert.notEqual(edited.photo_path,oldPhoto);assert.equal((await r2(oldPhoto)).status,404);
  evidence.steps.push({action:'edit',id:edited.id,version:edited.checkin_version,oldR2Deleted:true});
  const deleted=before.find(p=>p.id===people[3].id);
  page.once('dialog',dialog=>dialog.accept());
  const deleteResult=page.waitForResponse(r=>r.request().method()==='DELETE');
  await page.locator(`[data-participant-id="${deleted.id}"]`).getByRole('button',{name:'削除',exact:true}).click();assert.equal((await deleteResult).status(),200);
  await page.getByTestId('participant-count').filter({hasText:'3名'}).waitFor();
  assert.equal((await r2(deleted.photo_path)).status,404);assert.equal((await records()).length,3);
  evidence.steps.push({action:'delete',id:deleted.id,d1Removed:true,r2Removed:true});
  await register(4,4);await page.getByTestId('participant-count').filter({hasText:'4名'}).waitFor();
  await page.locator('.participant img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  const final=await records();assert.equal(final.length,4);evidence.participants=[];
  for(const p of final){const stored=await r2(p.photo_path);assert.equal(stored.status,200);const bytes=Buffer.from(await stored.arrayBuffer());assert.ok(bytes.length>1000);evidence.participants.push({...p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  assert.equal(new Set(evidence.participants.map(p=>p.sha256)).size,4);
  const jobs=await query("SELECT phase,COUNT(*) count FROM checkin_object_gc WHERE event_id=? GROUP BY phase",[eventId]);assert.ok(jobs.every(j=>j.phase==='done'));evidence.cleanup=jobs;
  await page.screenshot({path:output+'/checkin-final-four-mobile.png',fullPage:true});
  fs.writeFileSync(output+'/progress.json',JSON.stringify(evidence,null,2));
  }else{
    const final=await records();assert.equal(final.length,4);assert.ok(final.every(p=>/^受付E2E 0[1-4]/.test(p.display_name)));edited=final.find(p=>p.display_name==='受付E2E 01 編集済み');assert.ok(edited);
    const receipts=await query('SELECT action,COUNT(*) count FROM checkin_receipts WHERE event_id=? GROUP BY action',[eventId]);assert.ok(receipts.some(r=>r.action==='create'&&r.count===5));assert.ok(receipts.some(r=>r.action==='update'&&r.count===1));assert.ok(receipts.some(r=>r.action==='delete'&&r.count===1));evidence.receipts=receipts;
    evidence.participants=[];for(const p of final){const r=await r2(p.photo_path);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());evidence.participants.push({...p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}assert.equal(new Set(evidence.participants.map(p=>p.sha256)).size,4);
    const jobs=await query('SELECT object_key,phase FROM checkin_object_gc WHERE event_id=?',[eventId]);for(const job of jobs){assert.equal(job.phase,'done');assert.equal((await r2(job.object_key)).status,404);}evidence.cleanup=jobs;
    await login(display,'/display');
  }
  const operation=await monitor.newPage();await operation.goto(root+'/admin');await operation.getByRole('heading',{name:'大会運営・参加者確認',exact:true}).waitFor();await operation.locator('.participant').nth(3).waitFor();assert.equal(await operation.locator('.participant').count(),4);
  for(const scene of ['draw','vs','result','bracket','next','champion']){
   await operation.goto(`${root}/show-preview?participant=${edited.id}&scene=${scene}`);await operation.getByRole('button',{name:'スキップ',exact:true}).click();const stage=operation.locator('.pm-stage');await stage.locator('img[src^="/api/events/"]').first().evaluate(image=>image.decode());assert.ok((await stage.textContent()).includes('受付E2E 01 編集済み'));assert.equal(await stage.locator('img[src*="test01"],img[src^="blob:"],img[src^="data:"]').count(),0);await operation.screenshot({path:`${output}/scene-${scene}.png`,fullPage:true});evidence.steps.push({action:'presentation',scene,participantId:edited.id});
  }
  await page.getByRole('button',{name:'一覧を更新',exact:true}).click();await page.getByRole('button',{name:'受付終了',exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='受付終了'&&!b.disabled));
  page.once('dialog',dialog=>dialog.accept());const closeResult=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/checkin/close');await page.getByRole('button',{name:'受付終了',exact:true}).click();assert.equal((await closeResult).status(),200);
  await page.getByRole('heading',{name:/受付完了/}).waitFor();await page.screenshot({path:output+'/closed-mobile.png',fullPage:true});
  const roster=await mobile.request.get(root+'/api/checkin/roster');assert.equal(roster.status(),200);const closed=await roster.json();assert.equal(closed.participants.length,4);evidence.closedRoster=closed;
  const blocked=await mobile.request.post(root+'/api/participants',{headers:{Origin:root},data:{requestId:require('node:crypto').randomUUID(),name:'must block',photo:'data:image/jpeg;base64,'+Buffer.from(await (await r2(evidence.participants[0].photo_path)).arrayBuffer()).toString('base64')}});assert.equal(blocked.status(),409);
  assert.deepEqual(errors,[]);evidence.checkedAt=new Date().toISOString();evidence.complete=true;evidence.browserErrors=errors;fs.writeFileSync(output+'/result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({complete:true,root,count:4,d1:true,r2:true,edit:true,delete:true,closed:true,scenes:6,output}));
 }catch(error){await pageSafeScreenshot(browser,output);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
async function pageSafeScreenshot(browser,output){for(const [i,c] of browser.contexts().entries())for(const [j,p] of c.pages().entries())await p.screenshot({path:`${output}/failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});}
