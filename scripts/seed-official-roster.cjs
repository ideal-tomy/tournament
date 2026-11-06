// Creates the fixed official event and registers the pre-confirmed roster with placeholder portraits.
// Re-running skips names already registered. Reception stays open so portraits can be replaced later.
const fs=require('node:fs'),assert=require('node:assert/strict');
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE (README). No browser/package is installed automatically.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev';
const official='cf-through-20261206-1206-4206-8206-000000000001';
const secrets=JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local','utf8'));
const roster=[
 [1,'山本 烈華',6],[2,'加藤 駿',13],[3,'山本 亜矢',5],[4,'岸 宗太',14],[5,'富井 淳一',12],[6,'富井 亮二',10],
 [7,'菅野 誠通',12],[8,'菅野 通',11],[9,'羽坂 健二郎',10],[10,'羽坂 なお',null],[11,'朝倉 亮',7],[13,'井上大暉',7],
 [15,'鈴木健太',4],[16,'刑部雄太',5],[17,'なおチャン',15],[19,'こうへい',10],[20,'奥ちゃん',10],[21,'斉藤 てつ',7],
 [22,'斉藤 あやか',7],[23,'まさし',7],[24,'トーイ',9],[25,'長谷川こーじ',null],[27,'古屋けーすけ',10],[28,'中澤ゆきこ',3],
 [29,'さやか',3],[30,'はやと',3],[31,'みのる',12],[33,'さつき',12],[35,'夏目正広',5],[36,'泉タロー',7],
 [37,'亮平',11],[38,'元気',11],[39,'橋口 真樹',4],[40,'しおちゃん',null],[41,'はるか',6],
];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'msedge'});
 try{
  const page=await browser.newPage();
  await page.goto(root+'/');
  const call=(path,body)=>page.evaluate(async({path,body})=>{const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};},{path,body});
  assert.equal((await call('/api/session',{code:secrets.REHEARSAL_ACCESS_CODE})).status,200);
  const created=await call('/api/rehearsal/create',{requestId:official.slice('cf-through-'.length),format:'double_elimination',timingPreset:'show'});
  assert.equal(created.status,200,JSON.stringify(created.body));assert.equal(created.body.eventId,official);
  const scoped=path=>`${path}?run=${official}`;
  const key=name=>name.normalize('NFKC').replace(/\s+/g,' ').trim();
  const before=await call(scoped('/api/checkin/state'));assert.equal(before.status,200);assert.equal(before.body.status,'open');
  const existing=new Set(before.body.participants.map(p=>key(p.name)));
  for(const [no,name,rating] of roster){
   if(existing.has(key(name)))continue;
   const photo=await page.evaluate(displayName=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=480;
    const ctx=canvas.getContext('2d');const label=[...displayName.replace(/\s+/g,'')].slice(0,2).join('')||'？';
    ctx.fillStyle='#1c2d43';ctx.fillRect(0,0,480,480);
    ctx.fillStyle='#334155';ctx.beginPath();ctx.arc(240,200,90,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#64748b';ctx.beginPath();ctx.ellipse(240,420,140,110,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e2e8f0';ctx.font='bold 96px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,240,210);
    ctx.fillStyle='#67e8f9';ctx.font='bold 28px system-ui,sans-serif';ctx.fillText('仮の画像',240,52);
    return canvas.toDataURL('image/jpeg',0.85);
   },name);
   const requestId=`20261206-0000-4000-8000-${String(no).padStart(12,'0')}`;
   const saved=await call(scoped('/api/participants'),{requestId,name,rating,photo});
   assert.ok([200,201].includes(saved.status),`${name}: ${saved.status} ${JSON.stringify(saved.body)}`);
   console.log(`registered No.${no} ${name}`);
  }
  const after=await call('/api/checkin/state');
  assert.equal(after.body.eventId,official);assert.equal(after.body.status,'open');
  console.log(JSON.stringify({eventId:after.body.eventId,status:after.body.status,count:after.body.count,issues:after.body.issues.map(i=>i.code)}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message.split('\n')[0]);process.exitCode=1;});
