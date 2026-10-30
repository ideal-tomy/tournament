import {buildOrthogonalConnectorPath,computeBracketLayout,isConnectorHighlighted,resolveTeamId,type StageData} from './layout';

/** Locate a committed winner's actual source and destination. No bracket decisions are made here. */
export function resolveResultAdvance(before:StageData,after:StageData,matchId:number,winnerTeamId:string){
 const original=before.match.find(m=>m.id===matchId),completed=after.match.find(m=>m.id===matchId);
 if(!original||!completed||completed.status<4)return null;
 const winner=completed.opponent1?.result==='win'?completed.opponent1:completed.opponent2?.result==='win'?completed.opponent2:null;
 if(!winner||resolveTeamId(winner.id,after.participant)!==winnerTeamId)return null;
 const layout=computeBracketLayout(after),source=layout.byId[matchId];if(!source)return null;
 const connector=layout.connectors.find(c=>c.kind==='advance'&&c.fromMatchId===matchId&&isConnectorHighlighted(c,after));if(!connector)return null;
 const destination=layout.byId[connector.toMatchId],sourceSlot=source.slots.find(s=>s.teamRef===winner.id),targetSlot=destination?.slots.find(s=>s.teamRef===winner.id);
 if(!sourceSlot||!targetSlot)return null;
 return {layout,sourceMatchId:matchId,targetMatchId:connector.toMatchId,sourceSlot:sourceSlot.slot,targetSlot:targetSlot.slot,source:sourceSlot.center,target:targetSlot.center,path:buildOrthogonalConnectorPath(sourceSlot.center,targetSlot.center)};
}
