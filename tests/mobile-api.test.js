'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createAppServer}=require('../server/app-server');
const {defaults}=require('../server/state');
function repo(){let state=null;const sessions=new Map();return {
 async getState(){return state},
 async setState(next,revision){if(revision!==(state?.revision||0))return null;state={state:next,revision:revision+1,updatedAt:new Date().toISOString()};return {revision:state.revision,updatedAt:state.updatedAt}},
 async hasSession(token){return sessions.has(token)&&sessions.get(token)>new Date()},
 async createSession(token,expires){sessions.set(token,expires)},
 async deleteSession(token){sessions.delete(token)}
}}
test('mobile bearer login, protected state, sync and logout without browser cookie',async()=>{
 const server=createAppServer({repository:repo(),appPassword:'long-private-test-password'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body=null,token='',extra={})=>{
   const r=await fetch(url+path,{method,headers:{'X-Forma-Request':'1',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
   return {status:r.status,body:await r.json(),headers:r.headers};
 };
 try{
  let r=await call('/api/state');assert.equal(r.status,401);
  r=await call('/api/mobile/login','POST',{password:'incorrect'});assert.equal(r.status,401);
  r=await call('/api/mobile/login','POST',{password:'long-private-test-password'},'',{Origin:'https://bad.example'});assert.equal(r.status,403);
  r=await call('/api/mobile/login','POST',{password:'long-private-test-password'});assert.equal(r.status,200);
  const token=r.body.token;assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(r.headers.get('set-cookie'),null);
  r=await call('/api/mobile/session','GET',null,token);assert.equal(r.body.authenticated,true);
  r=await call('/api/state','GET',null,token);assert.equal(r.status,200);assert.equal(r.body.revision,0);
  const state=defaults();state.meals['2026-11-25']=['monday-breakfast'];
  r=await call('/api/state','PUT',{revision:0,state},token);assert.equal(r.status,200);assert.equal(r.body.revision,1);
  r=await call('/api/state','GET',null,token);assert.deepEqual(r.body.state.meals['2026-11-25'],['monday-breakfast']);
  r=await call('/api/state','PUT',{revision:0,state},token);assert.equal(r.status,409);
  r=await call('/api/mobile/logout','POST',{},token);assert.equal(r.status,200);
  r=await call('/api/mobile/session','GET',null,token);assert.equal(r.body.authenticated,false);
  r=await call('/api/state','GET',null,token);assert.equal(r.status,401);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
