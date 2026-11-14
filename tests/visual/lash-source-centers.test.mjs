import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refineCenters,windowDirections} from './lash-source-centers.mjs';

test('profile center follows a measured shifted dark ridge and keeps tip fixed',()=>{
 const w=32,h=32,luma=Float32Array.from({length:w*h},(_,i)=>.7-.3*Math.exp(-((i%w-15.3)**2)/1.2));
 const p=Array.from({length:12},(_,i)=>({x:15,y:6+i})),r=refineCenters(luma,w,h,p);
 assert.deepEqual([r[0].x,r[0].y],[15,6]);
 for(const q of r.slice(1)){assert.equal(q.accepted,true);assert.ok(q.x>15&&q.x<15.75);}
});
test('flat background and one-sided step cannot supply an observed center',()=>{
 const w=32,h=32,p=Array.from({length:10},(_,i)=>({x:15,y:6+i}));
 for(const luma of [new Float32Array(w*h).fill(.5),Float32Array.from({length:w*h},(_,i)=>i%w<15?.2:.8)]){
  assert.ok(refineCenters(luma,w,h,p).slice(1).every(p=>!p.accepted));
 }
});
test('missing center evidence remains explicit even when a window angle exists',()=>{
 const p=Array.from({length:11},(_,i)=>({x:5,y:5+i,accepted:i!==3}));
 const r=windowDirections(p);assert.equal(r.find(r=>r.window===2).allProfilesAccepted,true);
 assert.equal(r.find(r=>r.window===4).allProfilesAccepted,false);
 assert.equal(r.find(r=>r.window===8).angle,-90);
});
test('an unsupported fixed tip cannot validate any distal window',()=>{
 const points=Array.from({length:11},(_,i)=>({x:5,y:5+i,accepted:i!==0}));
 assert.ok(windowDirections(points).every(d=>!d.anchorProfileAccepted&&!d.allProfilesAccepted));
});
