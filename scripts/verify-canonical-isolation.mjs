import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root='https://tournament-through-rehearsal.pine-shaken.workers.dev';
const out='docs/environment-verification/consolidation-20261031/public';
const test=JSON.parse(readFileSync(out+'/result.json'));
const secret=JSON.parse(readFileSync('cloudflare/checkin/.secrets.local'));
const login=await fetch(root+'/api/session',{method:'POST',headers:{Origin:root,'Content-Type':'application/json'},body:JSON.stringify({code:secret.REHEARSAL_ACCESS_CODE})});
assert.equal(login.status,200);
const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
const checks=[];
for(const [path,status] of [
 ['/api/participants',409],
 ['/api/draw/state?run=cf-through-'+crypto.randomUUID(),404],
 ['/api/rehearsal/source',503],
 ['/api/participants?run='+test.run,200],
]){
 const r=await fetch(root+path,{headers});assert.equal(r.status,status);
 assert.equal(r.headers.get('cache-control'),'no-store');
 const body=await r.json();
 if(status===200){assert.equal(body.participants.length,8);assert.ok(body.participants.every(p=>p.eventId===test.run));}
 checks.push({path,status,cache:r.headers.get('cache-control')});
}
const html=await fetch(root+'/');const source=await html.text();
const asset=source.match(/src="([^"]+\.js)"/)?.[1];assert.ok(asset);
const r=await fetch(new URL(asset,root));assert.equal(r.status,200);assert.notEqual(r.headers.get('cache-control'),'no-store');
checks.push({path:asset,status:r.status,cache:r.headers.get('cache-control')});
writeFileSync(out+'/isolation.json',JSON.stringify({checkedAt:new Date().toISOString(),run:test.run,checks,complete:true},null,2));
console.log(JSON.stringify({complete:true,checks:checks.length}));
