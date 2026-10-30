export function sample(index:number){
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;const ctx=canvas.getContext('2d');if(!ctx)throw Error('サンプル画像を準備できません。');
 ctx.fillStyle=['#164e63','#312e81','#7c2d12','#14532d'][index%4];ctx.fillRect(0,0,320,320);ctx.fillStyle='#e2e8f0';ctx.beginPath();ctx.arc(160,112,53,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(160,265,100,85,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0f172a';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(`SAMPLE ${index+1}`,160,280);
 return {requestId:crypto.randomUUID(),name:`リハーサル参加者${String(index+1).padStart(2,'0')}`,rating:[13,9,10,5,12,8,11,6][index%8],photo:canvas.toDataURL('image/png')};
}
