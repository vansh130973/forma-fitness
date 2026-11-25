'use strict';
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {defaults,parseState,StateError}=require('./state');
const PUBLIC=path.join(__dirname,'..','public');
const WEEK_MS=7*24*60*60*1000;
const STATIC={
 '/':['index.html','text/html; charset=utf-8'],
 '/index.html':['index.html','text/html; charset=utf-8'],
 '/styles.css':['styles.css','text/css; charset=utf-8'],
 '/app.js':['app.js','text/javascript; charset=utf-8'],
 '/data.js':['data.js','text/javascript; charset=utf-8'],
 '/assets/favicon.svg':['assets/favicon.svg','image/svg+xml']
};
function cookieValue(req,name){
 const str=req.headers.cookie||'';
 const match=str.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
 return match?match.slice(name.length+1):'';
}
function secureCookie(token,prod){return `forma_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7*24*60*60}${prod?'; Secure':''}`;}
function clearCookie(prod){return `forma_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${prod?'; Secure':''}`;}
function send(res,status,value,more={}){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...more});
 res.end(JSON.stringify(value));
}
async function getBody(req,max=1_000_000){
 if(!(req.headers['content-type']||'').startsWith('application/json')){
   const err=new Error('Expected a JSON request');err.status=415;throw err;
 }
 let size=0,chunks=[];
 for await(const chunk of req){
   size+=chunk.length;
   if(size>max){const err=new Error('Request is too large');err.status=413;throw err;}
   chunks.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch(e){const err=new Error('Invalid JSON');err.status=400;throw err;}
}
function sameOrigin(req){
 if(req.headers['x-forma-request']!=='1')return false;
 const fetchSite=req.headers['sec-fetch-site'];
 if(fetchSite==='cross-site')return false;
 const origin=req.headers.origin;
 if(!origin)return true; // custom header plus no CORS protects non-browser clients.
 try{return new URL(origin).host===req.headers.host;}
 catch{return false;}
}
function bearerToken(req){
 const value=req.headers.authorization||'';
 const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(value);
 return match?match[1]:'';
}
function safeCompare(a,b){
 const x=crypto.createHash('sha256').update(String(a)).digest();
 const y=crypto.createHash('sha256').update(String(b)).digest();
 return crypto.timingSafeEqual(x,y);
}
function createAppServer({repository,appPassword,production=false}){
 if(!repository||typeof repository.getState!=='function')throw new Error('Missing MongoDB repository');
 if(typeof appPassword!=='string'||appPassword.length<12)throw new Error('APP_PASSWORD must contain at least 12 characters');
 const attempts=new Map();
 const handler=async(req,res)=>{
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('X-Frame-Options','DENY');
   res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src https://www.youtube-nocookie.com; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
   res.setHeader('Cache-Control','no-store');
   const p=new URL(req.url||'/', 'http://localhost').pathname;
   try{
     if(req.method==='GET'&&p==='/api/health')return send(res,200,{status:'ok'});
     if(req.method==='GET'&&(p==='/api/auth/session'||p==='/api/mobile/session')){
       const token=p==='/api/mobile/session'?bearerToken(req):cookieValue(req,'forma_session');
       const authenticated=Boolean(token&&/^[A-Za-z0-9_-]{43}$/.test(token)&&await repository.hasSession(token));
       return send(res,200,{authenticated});
     }
     if(req.method==='POST'){
       if(!sameOrigin(req))return send(res,403,{error:'Invalid request origin'});
       if(p==='/api/auth/login'||p==='/api/mobile/login'){
         const key=req.socket.remoteAddress||'unknown',now=Date.now();
         let record=attempts.get(key);
         if(!record||record.until<=now)record={count:0,until:now+15*60*1000};
         if(record.count>=5)return send(res,429,{error:'Too many attempts; try again in 15 minutes'});
         const body=await getBody(req,4096);
         if(typeof body.password!=='string'||!safeCompare(body.password,appPassword)){
           record.count+=1;attempts.set(key,record);
           return send(res,401,{error:'Incorrect password'});
         }
         attempts.delete(key);
         const token=crypto.randomBytes(32).toString('base64url');
         await repository.createSession(token,new Date(Date.now()+WEEK_MS));
         if(p==='/api/mobile/login')return send(res,200,{authenticated:true,token,expiresIn:7*24*60*60});
         return send(res,200,{authenticated:true},{'Set-Cookie':secureCookie(token,production)});
       }
       if(p==='/api/auth/logout'||p==='/api/mobile/logout'){
         const token=p==='/api/mobile/logout'?bearerToken(req):cookieValue(req,'forma_session');
         if(token)await repository.deleteSession(token);
         return p==='/api/mobile/logout'?send(res,200,{authenticated:false}):send(res,200,{authenticated:false},{'Set-Cookie':clearCookie(production)});
       }
     }
     if(p.startsWith('/api/')){
       const token=bearerToken(req)||cookieValue(req,'forma_session');
       if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)||!await repository.hasSession(token)){
         return send(res,401,{error:'Sign in to access your fitness records'});
       }
       if(p==='/api/state'&&req.method==='GET'){
         const doc=await repository.getState();
         return send(res,200,doc?{exists:true,state:doc.state,revision:doc.revision,updatedAt:doc.updatedAt}:{exists:false,state:defaults(),revision:0});
       }
       if(p==='/api/state'&&req.method==='PUT'){
         if(!sameOrigin(req))return send(res,403,{error:'Invalid request origin'});
         const body=await getBody(req);
         if(!body||!Number.isSafeInteger(body.revision)||body.revision<0)return send(res,400,{error:'Missing or invalid revision'});
         const state=parseState(body.state);
         const result=await repository.setState(state,body.revision);
         if(!result)return send(res,409,{error:'Cloud data changed on another device. Download your current data before reloading.'});
         return send(res,200,result);
       }
       return send(res,404,{error:'API endpoint not found'});
     }
     if(req.method==='GET'||req.method==='HEAD'){
       const entry=STATIC[p];
       if(!entry)return send(res,404,{error:'Not found'});
       const [file,mime]=entry;
       const bytes=await fs.readFile(path.join(PUBLIC,file));
       res.writeHead(200,{'Content-Type':mime,'Content-Length':bytes.length});
       if(req.method==='HEAD')res.end();else res.end(bytes);
       return;
     }
     return send(res,405,{error:'Method not allowed'});
   }catch(err){
     if(err instanceof StateError)return send(res,400,{error:err.message});
     if(err.status&&err.status<500)return send(res,err.status,{error:err.message});
     console.error('Application request failed:',err.message); // Never print credentials, URI, or request bodies.
     return send(res,500,{error:'A server error occurred. Your changes were not saved.'});
   }
 };
 return http.createServer(handler);
}
module.exports={createAppServer};
