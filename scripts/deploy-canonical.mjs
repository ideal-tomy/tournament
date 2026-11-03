// The only supported public deployment target. Never accept --name/--env overrides.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const config='cloudflare/checkin/wrangler.through-rehearsal.jsonc';
const args=process.argv.slice(2);
if(args.length && (args.length!==1 || args[0]!=='--dry-run')) throw Error('Only --dry-run is accepted; Worker and environment overrides are disabled.');
const settings=JSON.parse(readFileSync(resolve(root,config),'utf8'));
if(settings.name!=='tournament-through-rehearsal') throw Error('Canonical Worker name changed; refusing deployment.');
async function run(command){
 const code=await new Promise((accept,reject)=>{
  const child=spawn(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),...command,'--config',resolve(root,config)],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'1'}});
  child.once('error',reject);child.once('exit',accept);
 });
 if(code!==0)throw Error('Canonical preflight/deploy failed; no alternate target will be created.');
}
// A missing/inaccessible existing Worker must fail before deploy can create one.
if(!args.length)await run(['deployments','list']);
await run(['deploy',...args]);
