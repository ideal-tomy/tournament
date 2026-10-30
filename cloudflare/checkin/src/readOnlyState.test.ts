import {it,expect} from 'vitest';
import {setup} from './testSupport';
it('keeps repeated initialized state polling read-only',async()=>{
 const s=setup();await s.login();expect((await s.request('/api/draw/state')).status).toBe(200);
 const original=s.env.DB.prepare.bind(s.env.DB),queries:string[]=[];
 s.env.DB.prepare=(sql:string)=>{queries.push(sql);return original(sql);};
 for(let i=0;i<3;i++)expect((await s.request('/api/draw/state')).status).toBe(200);
 expect(queries.length).toBeGreaterThan(0);expect(queries.every(sql=>/^\s*SELECT\b/i.test(sql))).toBe(true);
});
