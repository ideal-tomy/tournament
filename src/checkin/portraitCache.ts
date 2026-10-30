import { ApiError, type Participant } from './api';
type PresentedParticipant=Participant&{presentationPortraitUrl?:string};
const cache=new Map<string,Promise<string>>();
const urls=new Set<string>();
let eventId:string|null=null;
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
        const url=URL.createObjectURL(blob);urls.add(url);
        try{const image=new Image();image.src=url;await image.decode();}catch{URL.revokeObjectURL(url);urls.delete(url);throw Error(`${participant.name}の保存写真を表示できません。`);}
        return url;
      }).catch(error=>{cache.delete(key);throw error;});
      cache.set(key,value);
    }
    return {...participant,presentationPortraitUrl:await value};
  }));
  return {...state,participants};
}
