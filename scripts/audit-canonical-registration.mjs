// Read-only D1/R2 verification for the fresh synthetic run in the current public test.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const test=JSON.parse(readFileSync('docs/environment-verification/public/result.json'));
assert.match(test.run,/^cf-through-/);
const token=/oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8'))?.[1];
const account='https://api.cloudflare.com/client/v4/accounts/5b27490470fa62bc7b51865e4e2cd786';
const h={Authorization:'Bearer '+token};
const query=await fetch(account+'/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({sql:'SELECT id,display_name,photo_path FROM participants WHERE event_id=?',params:[test.run]})});
assert.equal(query.status,200);const q=await query.json();assert.equal(q.success,true);
const rows=q.result[0].results;assert.equal(rows.length,8);
let matches;
if(test.complete){
 const r=await fetch(account+'/d1/database/0a7528e1-7f14-4e54-a896-4fbe2cf2c42c/query',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({sql:'SELECT status,COUNT(*) n FROM matches WHERE event_id=? GROUP BY status',params:[test.run]})});
 assert.equal(r.status,200);const b=await r.json();assert.equal(b.success,true);matches=b.result[0].results;assert.equal(matches.find(x=>x.status==='done')?.n,3);
}
const root=test.root,secret=JSON.parse(readFileSync('cloudflare/checkin/.secrets.local'));
const login=await fetch(root+'/api/session',{method:'POST',headers:{Origin:root,'Content-Type':'application/json'},body:JSON.stringify({code:secret.REHEARSAL_ACCESS_CODE})});assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
const results=[];
for(const row of rows){
 const remote=await fetch(account+'/r2/buckets/tournament-rehearsal-portraits/objects/'+row.photo_path,{headers:h});assert.equal(remote.status,200);
 const api=await fetch(root+`/api/events/${test.run}/participants/${row.id}/portrait`,{headers:{Cookie:cookie}});assert.equal(api.status,200);
 const a=Buffer.from(await remote.arrayBuffer()),b=Buffer.from(await api.arrayBuffer());assert.deepEqual(a,b);
 results.push({id:row.id,d1Name:row.display_name,r2Bytes:a.length,apiStatus:200,byteMatch:true,sha256:createHash('sha256').update(a).digest('hex')});
}
writeFileSync('docs/environment-verification/public/data-audit.json',JSON.stringify({run:test.run,checkedAt:new Date().toISOString(),d1Count:rows.length,portraits:results,matches,complete:true},null,2));
console.log(JSON.stringify({run:test.run,d1:rows.length,r2:results.length,byteMatch:true}));
