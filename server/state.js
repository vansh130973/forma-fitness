'use strict';

function defaults(){return {
  version:1,
  targets:{calories:2400,protein:150,carbs:300,fat:70},
  baseline:{weight:98,waist:37,bodyFatReference:33.5},
  meals:{},extras:{},exerciseSets:{},exerciseDetails:{},sessions:{},progress:[],notes:{}
};}
class StateError extends Error {constructor(message){super(message);this.name='StateError';}}
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const within=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(new Date(s+'T00:00:00Z').getTime())&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validID=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
function entries(obj,max=2500){if(!plain(obj)||Object.keys(obj).length>max)throw new StateError('Invalid log map');return Object.entries(obj)}
function dateMap(obj,convert){let out={};for(let [d,v] of entries(obj)){if(!validDate(d))throw new StateError('Invalid log date');out[d]=convert(v)}return out}
function capString(s,max){if(typeof s!=='string'||s.length>max)throw new StateError('Text entry is invalid or too long');return s}
function boundedNumber(x,max){if(!within(x,0,max))throw new StateError('A nutrition value is invalid');return x}
function parseState(raw){
 if(!plain(raw)||raw.version!==1)throw new StateError('Incompatible fitness state');
 const output=defaults();
 if(!plain(raw.targets))throw new StateError('Missing nutrition targets');
 const ranges={calories:[800,7000],protein:[0,350],carbs:[0,900],fat:[0,250]};
 for(const [key,[min,max]] of Object.entries(ranges)){
   if(!within(raw.targets[key],min,max))throw new StateError('Invalid nutrition target: '+key);
   output.targets[key]=raw.targets[key];
 }
 if(raw.baseline!==undefined){
   if(!plain(raw.baseline))throw new StateError('Invalid starting measurements');
   for(const [name,min,max] of [['weight',30,350],['waist',10,90],['bodyFatReference',2,75]]){
     if(!within(raw.baseline[name],min,max))throw new StateError('Invalid baseline '+name);
     output.baseline[name]=raw.baseline[name];
   }
 }
 output.meals=dateMap(raw.meals||{},list=>{
   if(!Array.isArray(list)||list.length>30||!list.every(validID))throw new StateError('Invalid meal check-offs');
   return [...new Set(list)];
 });
 output.extras=dateMap(raw.extras||{},list=>{
   if(!Array.isArray(list)||list.length>60)throw new StateError('Too many custom foods');
   return list.map(e=>{
     if(!plain(e)||!validID(e.id))throw new StateError('Invalid custom food entry');
     return {id:e.id,name:capString(e.name,80),kcal:boundedNumber(e.kcal,5000),protein:boundedNumber(e.protein,350),carbs:boundedNumber(e.carbs,600),fat:boundedNumber(e.fat,300)};
   });
 });
 output.exerciseSets=dateMap(raw.exerciseSets||{},map=>{
   let out={};for(let [id,flags] of entries(map,60)){
     if(!validID(id)||!Array.isArray(flags)||flags.length>12||!flags.every(x=>x===true||x===false||x===null))throw new StateError('Invalid exercise sets');
     out[id]=flags;
   }return out;
 });
 output.exerciseDetails=dateMap(raw.exerciseDetails||{},map=>{
   let out={};for(let [id,details] of entries(map,60)){
     if(!validID(id)||!plain(details))throw new StateError('Invalid exercise record');
     let load=capString(details.load||'',30),reps=capString(details.reps||'',35);
     if(!/^[0-9.,\s-]*$/.test(load)||!/^[0-9,\s-]*$/.test(reps))throw new StateError('Invalid weight or repetitions');
     out[id]={load,reps};
   }return out;
 });
 output.sessions=dateMap(raw.sessions||{},v=>{if(typeof v!=='boolean')throw new StateError('Invalid class attendance');return v;});
 if(!Array.isArray(raw.progress||[])||(raw.progress||[]).length>5000)throw new StateError('Invalid measurement history');
 output.progress=(raw.progress||[]).map(p=>{
   if(!plain(p)||!validDate(p.date)||!within(p.weight,30,350))throw new StateError('Invalid weight measurement');
   for(const [key,min,max] of [['waist',10,90],['bodyFat',2,75]]){
     if(p[key]!==''&&p[key]!==undefined&&!within(p[key],min,max))throw new StateError('Invalid '+key+' measurement');
   }
   const energy=capString(p.energy||'',100),recovery=capString(p.recovery||'',100);
   return {date:p.date,weight:p.weight,waist:p.waist??'',bodyFat:p.bodyFat??'',energy,recovery};
 });
 output.notes=dateMap(raw.notes||{},v=>capString(v,1000));
 if(Buffer.byteLength(JSON.stringify(output))>900_000)throw new StateError('Fitness history exceeds storage limit');
 return output;
}
module.exports={defaults,parseState,StateError};
