import {useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import gsap from 'gsap';
import BracketView from '../features/bracket/BracketView';
import {toStageData} from '../features/bracket/stageData';
import {resolveResultAdvance} from '../features/bracket/resultAdvance';
import type {DrawState} from './DrawControl';
import {portraitUrlFor} from './portraitCache';

export default function AnimatedBracketAdvance({state,winnerOverlay,controlledTime}:{state:DrawState;winnerOverlay:ReactNode;controlledTime?:number}){
 const root=useRef<HTMLDivElement>(null),timeline=useRef<gsap.core.Timeline>();
 const presentation=state.flow?.resultPresentation;
 const data=useMemo(()=>{if(!state.bracket||!presentation)return null;const before=toStageData(presentation.beforeBracket),after=toStageData(state.bracket);return {before,after,advance:resolveResultAdvance(before,after,presentation.match.id,presentation.winnerTeamId)};},[state.bracket,presentation]);
 useLayoutEffect(()=>{if(!root.current||!data)return;const ctx=gsap.context(()=>{
  const tl=gsap.timeline({paused:true});timeline.current=tl;
  tl.set('.advance-after,.advance-flight',{autoAlpha:0}).set('.advance-line',{strokeDashoffset:1}).set('.advance-before',{autoAlpha:0}).set('.advance-winner-out',{autoAlpha:1});
  tl.to('.advance-before',{autoAlpha:1,duration:.65},0).to('.advance-winner-out',{autoAlpha:0,duration:.65},0);
  const path=root.current!.querySelector<SVGPathElement>('.advance-line'),flight=root.current!.querySelector<SVGGElement>('.advance-flight');
  if(data.advance&&path&&flight){const motion={progress:0},length=path.getTotalLength();
   tl.to('.advance-line',{strokeDashoffset:0,autoRound:false,duration:1.8,ease:'power1.inOut'},1.1)
    .to('.advance-flight',{autoAlpha:1,duration:.15},1.1)
    .to(`.advance-before [data-match-id="${data.advance.sourceMatchId}"] [data-slot="${data.advance.sourceSlot}"]`,{opacity:.25,duration:.3},1.1)
    .to(motion,{progress:1,duration:2.4,ease:'power1.inOut',onUpdate:()=>{const p=path.getPointAtLength(length*motion.progress);flight.setAttribute('transform',`translate(${p.x},${p.y})`);}},1.1)
    .to('.advance-flight',{autoAlpha:0,duration:.35},3.65);
  }
  tl.to('.advance-after',{autoAlpha:1,duration:.5},3.5).to('.advance-before',{autoAlpha:0,duration:.5},3.5).to('.advance-line',{autoAlpha:0,duration:.4},4).to({},{duration:6},0);
  tl.seek(Math.min(6,controlledTime??state.elapsedSeconds),false);if(controlledTime==null&&state.elapsedSeconds<6)tl.play();
 },root);return()=>{timeline.current=undefined;ctx.revert();};},[data]);
 useLayoutEffect(()=>{if(controlledTime!=null)timeline.current?.pause().seek(Math.max(0,Math.min(6,controlledTime)),false);},[controlledTime]);
 if(!data||!presentation)return null;
 const faceUrlByTeamId=Object.fromEntries(state.teams.map(t=>[t.id,t.memberIds.map(id=>(()=>{const p=state.participants.find(p=>p.id===id);return p?portraitUrlFor(p):'';})())]));
 const labels=Object.fromEntries(state.teams.map(t=>[t.id,t.name])),names=Object.fromEntries(state.teams.map(t=>[t.id,t.memberIds.map(id=>state.participants.find(p=>p.id===id)?.name??'')]));
 const winner=state.teams.find(t=>t.id===presentation.winnerTeamId),people=winner?.memberIds.map(id=>state.participants.find(p=>p.id===id)).filter(p=>!!p)??[];
 const view=data.advance?.layout;
 return <div ref={root} className="audience-advance" data-advance-from={data.advance?.sourceMatchId} data-advance-to={data.advance?.targetMatchId}>
  <div className="advance-before"><BracketView data={data.before} layoutData={data.after} faceUrlByTeamId={faceUrlByTeamId} labelByTeamId={labels} memberNamesByTeamId={names}/></div>
  <div className="advance-after"><BracketView data={data.after} faceUrlByTeamId={faceUrlByTeamId} labelByTeamId={labels} memberNamesByTeamId={names}/></div>
  {data.advance&&view&&<svg className="advance-overlay" viewBox={`0 0 ${view.width} ${view.height}`} preserveAspectRatio="xMidYMid meet" aria-label="勝者の実Bracket進出">
   <path className="advance-line" pathLength={1} strokeDasharray={1} d={data.advance.path} fill="none" stroke="#86efac" strokeWidth={3}/>
   <g className="advance-flight" transform={`translate(${data.advance.source.x},${data.advance.source.y})`}><rect x={-17} y={-24} width={34} height={48} rx={3} fill="#102c3b" stroke="#fde68a"/>{people.map((p,i)=><image key={p.id} href={portraitUrlFor(p)} x={-15} y={-22+i*21} width={30} height={20} preserveAspectRatio="xMidYMid slice"/>)}<title>{winner?.name}</title></g>
  </svg>}
  <div className="advance-winner-out">{winnerOverlay}</div>
 </div>;
}
