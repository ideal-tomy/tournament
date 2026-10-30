// Creates a new empty reception through the existing public UI. No existing data is modified.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const c=await browser.newContext(),p=await c.newPage();
  await p.goto(root+'/');await p.getByLabel('確認コード',{exact:true}).fill(JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local')).REHEARSAL_ACCESS_CODE);
  await p.getByRole('button',{name:'確認して開く',exact:true}).click();await p.getByRole('link',{name:'大会リハーサルを開始',exact:true}).click();
  await p.getByLabel('参加者の準備').selectOption('empty');await p.getByLabel('新規大会の確認速度').selectOption('show');
  await p.getByRole('button',{name:'初期化・参加者準備',exact:true}).click();
  await p.getByRole('status').filter({hasText:'大会準備完了・参加者受付を開いて登録してください'}).waitFor();
  const run=new URL(p.url()).searchParams.get('run');assert.match(run,/^cf-through-/);
  const r=await p.evaluate(async run=>{const r=await fetch('/api/rehearsal/status?run='+run);return r.json();},run);
  assert.equal(r.participants.length,0);assert.equal(r.checkinStatus,'open');assert.equal(r.scene,'idle');
  const urls=Object.fromEntries(['/','/checkin','/admin','/display','/rehearsal','/show-preview'].map(path=>[path,root+path+'?run='+run]));
  fs.writeFileSync('docs/environment-verification/smartphone-ready.json',JSON.stringify({run,createdAt:new Date().toISOString(),participants:0,checkinStatus:'open',timingPreset:r.timingPreset,urls},null,2));
  console.log(JSON.stringify({run,checkin:urls['/checkin']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.split('\n')[0]);process.exitCode=1;});
