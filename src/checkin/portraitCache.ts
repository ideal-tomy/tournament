import { ApiError, type Participant } from './api';
type PresentedParticipant=Participant&{presentationPortraitUrl?:string};
const cache=new Map<string,Promise<string>>();
const urls=new Set<string>();
let eventId:string|null=null;

const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(data:Uint8Array){let c=0xffffffff;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u32(bytes:Uint8Array,offset:number){return((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;}

/**
 * Some stored PNGs have four 0x00 bytes written in front of every chunk CRC.
 * Browsers refuse to decode them, and the venue screen then never leaves the opening.
 * A file whose CRCs already match is returned unchanged.
 */
export function repairStoredPng(bytes:Uint8Array){
  if(bytes.length<8||bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47)return bytes;
  const parts:Uint8Array[]=[bytes.subarray(0,8)];
  let offset=8,stripped=0;
  while(offset+8<=bytes.length){
    const length=u32(bytes,offset);
    const dataEnd=offset+8+length;
    if(length>bytes.length||dataEnd+4>bytes.length)return bytes;
    const expect=crc32(bytes.subarray(offset+4,dataEnd));
    let crcAt=dataEnd;
    if(u32(bytes,crcAt)===0&&crcAt+8<=bytes.length&&u32(bytes,crcAt+4)===expect){stripped++;crcAt+=4;}
    else if(u32(bytes,crcAt)!==expect)return bytes;
    parts.push(bytes.subarray(offset,dataEnd),bytes.subarray(crcAt,crcAt+4));
    const type=String.fromCharCode(bytes[offset+4],bytes[offset+5],bytes[offset+6],bytes[offset+7]);
    offset=crcAt+4;
    if(type==='IEND')break;
  }
  if(!stripped||offset!==bytes.length)return bytes;
  const fixed=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));
  let cursor=0;
  for(const part of parts){fixed.set(part,cursor);cursor+=part.length;}
  return fixed;
}
export function portraitUrlFor(participant:PresentedParticipant){
  return participant.presentationPortraitUrl??`${participant.portraitUrl}?version=${participant.version}`;
}
// Authenticated, per-page memory only. No public bucket or HTTP cache is introduced.
export async function preparePortraits<T extends {eventId:string;participants:Participant[]}>(state:T,signal:AbortSignal):Promise<T>{
  if(eventId!==state.eventId){for(const url of urls)URL.revokeObjectURL(url);urls.clear();cache.clear();eventId=state.eventId;}
  const participants=await Promise.all(state.participants.map(async participant=>{
    const key=`${participant.portraitUrl}?version=${participant.version}`;
    let value=cache.get(key);
    if(!value){
      value=fetch(key,{credentials:'same-origin',cache:'no-store',signal}).then(async response=>{
        if(response.status===401)throw new ApiError(401,'UNAUTHORIZED');
        if(!response.ok)throw Error(`${participant.name}の保存写真を取得できません（${response.status}）。`);
        const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('保存写真の形式が不正です。');
        const bytes=new Uint8Array(await blob.arrayBuffer());
        const portrait=blob.type==='image/png'?new Blob([repairStoredPng(bytes)],{type:blob.type}):blob;
        const url=URL.createObjectURL(portrait);urls.add(url);
        try{const image=new Image();image.src=url;await image.decode();}catch{URL.revokeObjectURL(url);urls.delete(url);throw Error(`${participant.name}の保存写真を表示できません。`);}
        return url;
      }).catch(error=>{cache.delete(key);throw error;});
      cache.set(key,value);
    }
    return {...participant,presentationPortraitUrl:await value};
  }));
  return {...state,participants};
}
