import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const local=read('.wrangler/rehearsal32-local-fast/result.json');
const show=read('.wrangler/rehearsal32-public-show/result.json');
const ready=read('.wrangler/rehearsal32-ready/result.json');
for(const report of [local,show,ready])assert.equal(report.complete,true,'Only successful runs can become acceptance evidence');
const out='docs/rehearsal32-verification';mkdirSync(out,{recursive:true});
const summarize=p=>({complete:p.complete,startedAt:p.startedAt,finishedAt:p.finishedAt,run:p.run,preset:p.preset,
 participants:p.final.participants.length,teams:p.final.teams.length,matches:p.final.flow.completedMatches,
 players:p.players.length,pairs:p.pairs.length,vs:Object.keys(p.vs).length,winners:p.winners.length,advances:Object.keys(p.advances).length,
 minVsObservedMs:Math.min(...Object.values(p.vs).map(v=>v.last-v.first)),minMovementPositions:Math.min(...Object.values(p.advances).map(a=>a.positions.length)),
 manualStartVerified:p.manualStartVerified,reloadVerified:p.reloadVerified,transportRetries:p.transportRetries??0,
 sourceUnchanged:p.sourceUnchanged??null,logs:p.logs,matchesStored:p.matches,errors:p.errors,httpFailures:p.httpFailures});
const deployment=readFileSync('.wrangler/deploy32-readonly.log','utf8').match(/Current Version ID:\s*([a-f0-9-]+)/)?.[1];
const summary={worker:'tournament-through-rehearsal',deployment,local:summarize(local),publicShow:summarize(show),ready};
writeFileSync(out+'/result.json',JSON.stringify(summary,null,2)+'\n');
for(const [from,to]of [
 ['00-all-16-pairs.png','public-all-16-pairs.png'],['02-first-vs-start-wait.png','public-start-wait.png'],
 ['03-winner.png','public-winner.png'],['04-moving-bracket-line.png','public-moving-line.png'],
 ['round-Quarter-Final.png','public-quarter-final.png'],['round-Semi-Final.png','public-semi-final.png'],
 ['round-Final.png','public-final.png'],['06-champion.png','public-champion.png']
])copyFileSync('.wrangler/rehearsal32-public-show/'+from,out+'/'+to);
copyFileSync('.wrangler/rehearsal32-ready/admin-ready.png',out+'/public-admin-ready.png');
// A short excerpt of the continuous public recording makes the central transition reviewable.
const firstWinner=show.states.find(s=>s.scene==='result');
const start=Math.max(0,(Date.parse(firstWinner.at)-Date.parse(show.startedAt))/1000-8);
const ffmpeg=resolve(process.env.LOCALAPPDATA,'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
const code=await new Promise((fulfill,reject)=>{const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',String(start),'-i',show.video,'-t','55','-c:v','copy','-an',out+'/public-winner-to-next.webm'],{windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',fulfill);});
assert.equal(code,0,'Existing ffmpeg must produce the excerpt without installation');
console.log(JSON.stringify({complete:true,deployment,readyRun:ready.run,publicShow:summarize(show),video:show.video,excerpt:out+'/public-winner-to-next.webm'}));
