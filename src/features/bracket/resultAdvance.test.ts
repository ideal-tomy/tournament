import {describe,it,expect} from 'vitest';
import {buildSnapshotForTeamCount,createManagerFromSnapshot,exportSnapshot,toStageData} from './manager';
import {applyResult} from '../progression/progression';
import {resolveResultAdvance} from './resultAdvance';
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
});
