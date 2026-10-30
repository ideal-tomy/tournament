export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface StoredPhoto {
  body?: ReadableStream;
  customMetadata?: Record<string,string>;
  httpMetadata?: { contentType?: string };
  size?: number;
}
export interface CheckinEnv {
  DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> };
  PORTRAITS: {
    put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string,string>; onlyIf: { etagDoesNotMatch: string } }): Promise<unknown | null>;
    head(key: string): Promise<StoredPhoto | null>;
    get(key: string): Promise<StoredPhoto | null>;
    delete(key: string): Promise<void>;
  };
  ASSETS: { fetch(request: Request): Promise<Response> };
  CHECKIN_EVENT_ID: string;
  REHEARSAL_ENABLED?: string;
  REHEARSAL_SOURCE_EVENT_ID?: string;
  REHEARSAL_ACCESS_CODE?: string;
  SESSION_SECRET?: string;
}
export interface Participant {
  id: string; event_id: string; display_name: string; rating: number | null; photo_path: string;
  note: string; created_at: string; updated_at: string; checkin_version: number;
}
export const AUTOMATED_CAMERA_TEST_ID = 'checkin-981ee495-ed79-44fd-a00c-6a8792e17102';
export const imageTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
export class ClientError extends Error {
  constructor(public code: string, public status: number, public details?: unknown) { super(code); }
}
export const response = (body: unknown, status=200) => Response.json(body,{status});
export async function hash(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function requestId(value: unknown): string {
  if (typeof value!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) throw new ClientError('INVALID_REQUEST_ID',400);
  return value;
}
export function fields(body: Record<string,unknown>) {
  if (typeof body.name!=='string') throw new ClientError('INVALID_NAME',400);
  const name=body.name.trim().normalize('NFC');
  if (!name || name.length>80 || /[\u0000-\u001f\u007f]/.test(name)) throw new ClientError('INVALID_NAME',400);
  const rating=body.rating??null;
  if (rating!==null && (typeof rating!=='number' || !Number.isFinite(rating) || rating<=0 || rating>30)) throw new ClientError('INVALID_RATING',400);
  return {name,rating:rating as number|null};
}
export function decodePortrait(value: unknown) {
  const encoded=typeof value==='string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value):null;
  if (!encoded) throw new ClientError('INVALID_PHOTO',400);
  let bytes:Uint8Array;
  try {bytes=Uint8Array.from(atob(encoded[2]),char=>char.charCodeAt(0));} catch {throw new ClientError('INVALID_PHOTO',400);}
  if (bytes.length>512*1024) throw new ClientError('PHOTO_TOO_LARGE',413);
  let format:keyof typeof imageTypes|null=null;
  if(bytes.length>=64) {
    if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217) format='jpg';
    else if([137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte)) format='png';
    else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP') format='webp';
  }
  if(!format || imageTypes[format]!==encoded[1]) throw new ClientError('INVALID_PHOTO',400);
  return {bytes,format,contentType:imageTypes[format]};
}
export function validKey(key: string, eventId: string, participantId: string) {
  const prefix=`events/${eventId}/participants/${participantId}/`;
  return key===`checkin/${eventId}/${participantId}.jpg` || (key.startsWith(prefix) && /^[a-f0-9-]{36}\/portrait\.(jpg|png|webp)$/.test(key.slice(prefix.length)));
}
export function participantDto(row:Participant,eventId:string) {
  const extension=row.photo_path?.split('.').at(-1) as keyof typeof imageTypes;
  return {id:row.id,eventId,name:row.display_name,rating:row.rating,portraitUrl:`/api/events/${eventId}/participants/${row.id}/portrait`,photoUrl:`/api/participants/${row.id}/photo`,portraitContentType:imageTypes[extension]??null,portraitSource:row.id===AUTOMATED_CAMERA_TEST_ID?'automated-test':'uploaded',version:row.checkin_version??0,createdAt:row.created_at,updatedAt:row.updated_at};
}
export async function readBody(request:Request,limit=700*1024) {
  if(Number(request.headers.get('Content-Length'))>limit) throw new ClientError('PAYLOAD_TOO_LARGE',413);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ClientError('JSON_REQUIRED',415);
  const reader=request.body?.getReader(); if(!reader) throw new ClientError('INVALID_INPUT',400);
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new ClientError('PAYLOAD_TOO_LARGE',413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const body:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body as Record<string,unknown>;}catch{throw new ClientError('INVALID_INPUT',400);}
}
