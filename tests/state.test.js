'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,parseState,StateError}=require('../server/state');
test('default personal plan is stored with correct goals and baseline',()=>{
 const x=parseState(defaults());
 assert.equal(x.targets.calories,2400);
 assert.equal(x.targets.protein,150);
 assert.equal(x.baseline.weight,98);
 assert.deepEqual(x.meals,{});
});
test('saved meal, food, workout, measurement and note data survive validation',()=>{
 const state=defaults();
 state.meals['2026-11-23']=['mon-breakfast'];
 state.extras['2026-11-23']=[{id:'id-xyz',name:'Milk',kcal:100,protein:8,carbs:12,fat:3}];
 state.exerciseSets['2026-11-23']={plank:[true,false]};
 state.exerciseDetails['2026-11-24']={pulldown:{load:'10',reps:'12, 12'}};
 state.sessions['2026-11-25']=true;
 state.progress=[{date:'2026-11-23',weight:98,waist:37,bodyFat:'',energy:'Good',recovery:'Fine'}];
 state.notes['2026-11-23']='Warm up first';
 const saved=parseState(state);
 assert.deepEqual(saved.meals,state.meals);
 assert.deepEqual(saved.extras,state.extras);
 assert.deepEqual(saved.exerciseSets,state.exerciseSets);
 assert.deepEqual(saved.exerciseDetails,state.exerciseDetails);
 assert.deepEqual(saved.progress,state.progress);
 assert.equal(saved.notes['2026-11-23'],'Warm up first');
});
test('invalid imported date, values and prototype-like keys are blocked',()=>{
 const x=defaults();x.meals['not-a-date']=['foo'];
 assert.throws(()=>parseState(x),StateError);
 const y=defaults();y.meals['2026-02-30']=['foo'];
 assert.throws(()=>parseState(y),StateError);
 const z=defaults();z.targets.calories=-100;
 assert.throws(()=>parseState(z),StateError);
 const w=defaults();w.exerciseDetails['2026-11-23']={'$set':{load:'5',reps:'12'}};
 assert.throws(()=>parseState(w),StateError);
});
