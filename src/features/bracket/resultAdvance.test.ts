import {describe,it,expect} from 'vitest';
import {buildSnapshotForTeamCount,createManagerFromSnapshot,exportSnapshot,toStageData} from './manager';
import {applyResult} from '../progression/progression';
import {maskUnrevealedAdvances,resolveLoserDropPlacement,resolveResultAdvance} from './resultAdvance';
import {getMatchBracketKind} from '../progression/tiers';
describe('actual committed bracket advance geometry',()=>{
 it.each([0,1] as const)('uses the actual winning side and destination for slot %i',async slot=>{
  const snapshot=await buildSnapshotForTeamCount(4),before=structuredClone(snapshot),manager=createManagerFromSnapshot(snapshot),data=toStageData(snapshot),match=data.match.find(m=>m.id===0)!;
  const winner=slot===0?match.opponent1!.id:match.opponent2!.id,team=data.participant.find(p=>p.id===winner)!.name;
  await applyResult(manager,data,0,slot,0);const after=await exportSnapshot(manager),geometry=resolveResultAdvance(toStageData(before),toStageData(after),0,team);
  expect(geometry).not.toBeNull();expect(geometry!.sourceSlot).toBe(slot);expect(geometry!.targetMatchId).toBe(2);
  const old=before.match.find(m=>m.id===geometry!.targetMatchId)!;expect([old.opponent1?.id,old.opponent2?.id]).not.toContain(winner);
  const updated=after.match.find(m=>m.id===geometry!.targetMatchId)!;expect([updated.opponent1?.id,updated.opponent2?.id]).toContain(winner);
  expect(geometry!.path).toContain(`M ${geometry!.source.x} ${geometry!.source.y}`);expect(geometry!.target.y).toBeLessThan(geometry!.source.y);
  expect(resolveResultAdvance(toStageData(before),toStageData(after),0,'wrong-team')).toBeNull();
 });
 it('never invents a route for an unfinished match or the terminal two-team final',async()=>{
  const snapshot=await buildSnapshotForTeamCount(4);expect(resolveResultAdvance(toStageData(snapshot),toStageData(snapshot),0,'team-0')).toBeNull();
  const final=await buildSnapshotForTeamCount(2),before=structuredClone(final),manager=createManagerFromSnapshot(final);await applyResult(manager,toStageData(final),0,0,0);
  expect(resolveResultAdvance(toStageData(before),toStageData(await exportSnapshot(manager)),0,'team-0')).toBeNull();
 });
 it('ウィナーズ敗者の入り先だけを返し、線は持たない',async()=>{
  const snapshot=await buildSnapshotForTeamCount(8),before=structuredClone(snapshot),manager=createManagerFromSnapshot(snapshot),data=toStageData(snapshot);
  const match=data.match.find(m=>getMatchBracketKind(data,m)==='winner'&&m.id!=null)!;
  const loserSlot=match.opponent1&&match.opponent2?1:0;
  const loserId=(loserSlot===0?match.opponent1:match.opponent2)!.id!;
  const loserTeam=data.participant.find(p=>p.id===loserId)!.name;
  await applyResult(manager,data,match.id,loserSlot===0?1:0,0);
  const after=await exportSnapshot(manager);
  const drop=resolveLoserDropPlacement(toStageData(before),toStageData(after),match.id,loserTeam);
  expect(drop).not.toBeNull();
  expect(drop!.targetMatchId).toBeTypeOf('number');
  expect([0,1]).toContain(drop!.targetSlot);
  const placed=toStageData(after).match.find(m=>m.id===drop!.targetMatchId)!;
  expect(getMatchBracketKind(toStageData(after),placed)).toBe('loser');
  const opp=drop!.targetSlot===0?placed.opponent1:placed.opponent2;
  expect(opp?.id).toBe(loserId);
 });
 it('ウィナーズ決勝とルーザーズ決勝はグランドファイナルへつなぐ',async()=>{
  const snapshot=await buildSnapshotForTeamCount(8),manager=createManagerFromSnapshot(snapshot);
  const linked:string[]=[];
  for(let step=0;step<40;step++){
   const before=await exportSnapshot(manager);
   const data=toStageData(before);
   const playable=data.match.find(m=>m.opponent1?.id!=null&&m.opponent2?.id!=null&&(m.status===2||m.status===3));
   if(!playable)break;
   const winnerId=playable.opponent1!.id!;
   const team=data.participant.find(p=>p.id===winnerId)!.name;
   const kind=getMatchBracketKind(data,playable);
   await applyResult(manager,data,playable.id,0,playable.id);
   const geometry=resolveResultAdvance(toStageData(before),toStageData(await exportSnapshot(manager)),playable.id,team);
   if(kind==='winner'||kind==='loser'){
    expect(geometry,`${kind} match ${playable.id}`).not.toBeNull();
    if(geometry!.attachGrandFinal)linked.push(kind);
   }
  }
  expect(linked).toContain('winner');
  expect(linked).toContain('loser');
 });
 it('まだ演出していない勝者は次の枠から外し、元の試合と演出済みの勝者は残す',async()=>{
  const snapshot=await buildSnapshotForTeamCount(8),manager=createManagerFromSnapshot(snapshot);
  const first=toStageData(await exportSnapshot(manager));
  const opening=first.match.find(m=>m.opponent1?.id!=null&&m.opponent2?.id!=null&&m.status<4)!;
  await applyResult(manager,first,opening.id,0,opening.id);
  const mid=await exportSnapshot(manager);
  const secondData=toStageData(mid);
  const next=secondData.match.find(m=>m.id!==opening.id&&m.opponent1?.id!=null&&m.opponent2?.id!=null&&m.status<4)!;
  await applyResult(manager,secondData,next.id,0,next.id);
  const after=toStageData(await exportSnapshot(manager));
  const firstWinner=getWinner(after,opening.id);
  const secondWinner=getWinner(after,next.id);
  const masked=maskUnrevealedAdvances(after,new Set([opening.id]));
  expect(playerIds(masked,opening.id)).toEqual(playerIds(after,opening.id));
  expect(playerIds(masked,next.id)).toEqual(playerIds(after,next.id));
  expect(placedIds(masked)).toContain(firstWinner);
  expect(placedIds(masked)).not.toContain(secondWinner);
  expect(placedIds(after)).toContain(secondWinner);
 });
});

function getWinner(data:ReturnType<typeof toStageData>,matchId:number){
 const match=data.match.find(m=>m.id===matchId)!;
 return match.opponent1?.result==='win'?match.opponent1.id:match.opponent2?.id;
}
function playerIds(data:ReturnType<typeof toStageData>,matchId:number){
 const match=data.match.find(m=>m.id===matchId)!;
 return [match.opponent1?.id??null,match.opponent2?.id??null];
}
function placedIds(data:ReturnType<typeof toStageData>){
 const sources=new Set(data.match.filter(m=>m.status>=4).map(m=>m.id));
 return data.match.filter(m=>!sources.has(m.id)).flatMap(m=>[m.opponent1?.id,m.opponent2?.id]).filter((id):id is number=>id!=null);
}
