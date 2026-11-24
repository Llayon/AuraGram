import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSpatialEnding} from './lash-spatial-ending.mjs';
const w=48,h=48;
const make=(f)=>Float32Array.from({length:w*h},(_,i)=>f(i%w,Math.floor(i/w)));
const line=make((x)=>.8-.5*Math.exp(-((x-24)**2)/.35));
const path=[{x:24,y:26},{x:24,y:24}], u={x:0,y:-1};
test('spatial audit preserves measured path and finds continuing shaft deterministically',()=>{
 const a=auditSpatialEnding(line,w,h,path,u,{proximalConnection:true});
 assert.equal(a.status,'continuing');assert.equal(a.endpointConfirmed,false);
 assert.deepEqual(a,auditSpatialEnding(line,w,h,path,u,{proximalConnection:true}));
 assert.equal(a.path,path);assert.equal(a.profiles.length,2);
 assert.equal(a.profiles[0].rows.length,25);assert.equal(a.profiles[0].rows[0].samples.length,25);
});
test('budget and missing pixels remain censored',()=>{
 assert.equal(auditSpatialEnding(line,w,h,path,u,{budgetExhausted:true}).status,'censored');
 assert.equal(auditSpatialEnding(line,w,h,[{x:1,y:1}],u).status,'censored');
});
test('weak response and a disconnected apparent end cannot certify a tip',()=>{
 const flat=make(()=>.8);
 assert.equal(auditSpatialEnding(flat,w,h,path,u).status,'ambiguous');
 const end=make((x,y)=>.8-(y>=24?.5*Math.exp(-((x-24)**2)/.35):0));
 const a=auditSpatialEnding(end,w,h,path,u,{proximalConnection:true});
 assert.equal(a.endpointConfirmed,false);assert.notEqual(a.status,'terminal');
});

import {analyzeLuma} from '../../src/retouch/lashAnalysis.mjs';
test('automatic audit ledger preserves baseline Density and tips without replacement seeds',()=>{
 const width=96,height=64;
 const a=Float32Array.from({length:width*height},(_,i)=>{
   const x=i%width,y=Math.floor(i/width);
   return .8-(y>=15&&y<=39&&x%6===0?.6:0);
 });
 const lid=[{x:8,y:40},{x:88,y:40}],lower=[{x:8,y:52},{x:88,y:52}];
 const args=[a,width,height,lid,lower,24,{x:8,y:40}];
 const baseline=analyzeLuma(...args), audited=analyzeLuma(...args,[],{structureAudit:true});
 assert.ok(audited.structureAudit.seeds.length>128);
 const {structureAudit,...rest}=audited;assert.deepEqual(rest,baseline);
 assert.equal(structureAudit.seeds.filter(s=>s.scheduled).length,128);
 assert.ok(structureAudit.seeds.slice(128).every(s=>s.reason==='seed-budget'));
 assert.ok(structureAudit.seeds.every((s,i)=>s.rank===i&&s.status==='censored'));
});
