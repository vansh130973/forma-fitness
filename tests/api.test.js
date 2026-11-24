'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createAppServer}=require('../server/app-server');
const {defaults}=require('../server/state');
function mockRepo(){
 let stateDoc=null;const tokens=new Map();
 return {
  async getState(){return stateDoc},
  async setState(state,revision){
   if(revision!== (stateDoc?.revision||0))return null;
   stateDoc={state,revision:revision+1,updatedAt:new Date().toISOString()};
   return {revision:stateDoc.revision,updatedAt:stateDoc.updatedAt};
  },
  async createSession(token,expires){tokens.set(token,expires);},
  async hasSession(token){return tokens.has(token)&&tokens.get(token)>new Date();},
  async deleteSession(token){tokens.delete(token);}
 };
}
test('private API: login, persistence, validation, optimistic conflicts and logout',async()=>{
 const server=createAppServer({repository:mockRepo(),appPassword:'testing-only-password-123'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 let cookie='';
 async function call(route,{method='GET',body,headers={}}={}){
   const r=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{}),'X-Forma-Request':'1',...headers},body:body?JSON.stringify(body):undefined});
   const value=await r.json();
   const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];
   return {status:r.status,value,headers:r.headers};
 }
 try{
   let r=await call('/api/state');assert.equal(r.status,401);
   r=await call('/api/auth/session');assert.equal(r.value.authenticated,false);
   r=await call('/api/auth/login',{method:'POST',body:{password:'incorrect'}});assert.equal(r.status,401);
   r=await call('/api/auth/login',{method:'POST',body:{password:'testing-only-password-123'},headers:{Origin:'https://malicious.example'}});assert.equal(r.status,403);
   r=await call('/api/auth/login',{method:'POST',body:{password:'testing-only-password-123'}});assert.equal(r.status,200);
   assert.match(cookie,/^forma_session=/);
   assert.match(r.headers.get('set-cookie'),/HttpOnly/);
   assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
   r=await call('/api/auth/session');assert.equal(r.value.authenticated,true);
   r=await call('/api/state');assert.equal(r.value.revision,0);assert.equal(r.value.exists,false);
   const state=defaults();state.meals['2026-11-23']=['mon-breakfast'];
   r=await call('/api/state',{method:'PUT',body:{revision:0,state}});assert.equal(r.status,200);assert.equal(r.value.revision,1);
   r=await call('/api/state');assert.deepEqual(r.value.state.meals['2026-11-23'],['mon-breakfast']);
   r=await call('/api/state',{method:'PUT',body:{revision:0,state}});assert.equal(r.status,409);
   r=await call('/api/state',{method:'PUT',body:{revision:1,state:{...state,targets:{...state.targets,protein:1000}}}});assert.equal(r.status,400);
   r=await call('/api/auth/logout',{method:'POST',body:{}});assert.equal(r.status,200);
   r=await call('/api/state');assert.equal(r.status,401);
   r=await call('/server.js');assert.equal(r.status,404);
   r=await call('/.env');assert.equal(r.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
