import { expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { type CheckinEnv } from './index';
import type { Statement } from './domain';
export function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_tournament.sql','0002_command_receipts.sql','0003_checkin_lifecycle.sql'])db.exec(readFileSync(`cloudflare/migrations/${file}`,'utf8'));
 db.exec("INSERT INTO events(id,title,environment) VALUES('cf-rehearsal-001','test','rehearsal')");
 const photos=new Map<string,{bytes:ArrayBuffer;httpMetadata:{contentType:string}}>();const faults={put:false,delete:false,batch:false,lostReply:false,failAt:-1};
 class Sql implements Statement {values:unknown[]=[];constructor(public sql:string){} bind(...values:unknown[]){this.values=values;return this;} async first<T>(){return (db.prepare(this.sql).get(...this.values as never[])??null) as T|null;} async all<T>(){return {results:db.prepare(this.sql).all(...this.values as never[]) as T[]};} async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.values as never[]).changes)}};}}
 const env:CheckinEnv={CHECKIN_EVENT_ID:'cf-rehearsal-001',REHEARSAL_ACCESS_CODE:'test-access-code-long',SESSION_SECRET:'test-session-secret-at-least-32-characters',ASSETS:{async fetch(){return new Response('static');}},DB:{prepare:sql=>new Sql(sql),async batch(statements){if(faults.batch)throw new Error('db down');db.exec('BEGIN');try{const result=[];for(const [index,s] of statements.entries()){if(index===faults.failAt)throw new Error('transaction failed');result.push({meta:{changes:Number(db.prepare((s as Sql).sql).run(...(s as Sql).values as never[]).changes)}});}db.exec('COMMIT');if(faults.lostReply)throw new Error('reply lost');return result;}catch(error){if(!faults.lostReply)db.exec('ROLLBACK');throw error;}}},PORTRAITS:{async put(key,bytes,options){if(faults.put)throw new Error('r2 down');photos.set(key,{bytes,httpMetadata:options.httpMetadata});return {};},async head(key){const photo=photos.get(key);return photo?{size:photo.bytes.byteLength,httpMetadata:photo.httpMetadata}:null;},async get(key){const photo=photos.get(key);return photo?{...photo,size:photo.bytes.byteLength,body:new Response(photo.bytes).body!}:null;},async delete(key){if(faults.delete)throw new Error('r2 down');photos.delete(key);}}};
 let cookie='';const origin='https://checkin.test';
 async function request(path:string,method='GET',body?:unknown,from=origin){return worker.fetch(new Request(origin+path,{method,headers:{Origin:from,Cookie:cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);}
 async function login(){const result=await request('/api/session','POST',{code:env.REHEARSAL_ACCESS_CODE});expect(result.status).toBe(200);expect(result.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Strict');cookie=result.headers.get('set-cookie')!.split(';')[0];}
 const jpeg=new Uint8Array(80);jpeg.set([255,216,255]);jpeg.set([255,217],78);
 const input=(name='test')=>({requestId:crypto.randomUUID(),name,rating:null,photo:`data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`});
 async function create(name='test'){const body=input(name),response=await request('/api/participants','POST',body);expect(response.status).toBe(201);return {body,...await response.json() as {participant:{id:string;version:number;portraitUrl:string}}};}
 const count=()=>Number(db.prepare('SELECT COUNT(*) n FROM participants').get()!.n);
 return {db,env,photos,faults,request,login,input,create,count};
}
