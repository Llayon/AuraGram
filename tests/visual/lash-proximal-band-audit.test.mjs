import test from 'node:test';
import assert from 'node:assert/strict';
import {auditProximalBands} from './lash-proximal-band-audit.mjs';

const width=24,height=24;
const shaft=(x,c)=>.4*Math.exp(-((x-c)**2)/.28);
const image=f=>Float32Array.from({length:width*height},(_,i)=>f(i%width));
const path=[{x:10,y:8},{x:10,y:8.5},{x:10,y:9}];
const audit=(luma,points=path)=>auditProximalBands(luma,width,height,points);

test('a single isolated observed shaft clears the branch veto without authorizing ownership',()=>{
 const r=audit(image(x=>.8-shaft(x,10)));
 assert.equal(r.status,'no-veto');
 assert.equal(r.proximalConnection,undefined);
});

test('an observed separated second band yields ambiguity and retains the measured witness',()=>{
 const r=audit(image(x=>.8-Math.max(shaft(x,10),shaft(x,12))));
 assert.equal(r.status,'ambiguous');
 assert.ok(r.bands>=2);
 assert.equal(r.samples.length,25);
});

test('an incomplete cross section is censored rather than cleared',()=>{
 const r=audit(image(x=>.8-shaft(x,1)),path.map(p=>({...p,x:1})));
 assert.equal(r.status,'censored');
 assert.equal(r.reason,'unavailable-band-sample');
});

test('a second band clipped by the scan edge is censored',()=>{
 const r=audit(image(x=>.8-Math.max(shaft(x,10),shaft(x,13))));
 assert.equal(r.status,'censored');
 assert.equal(r.reason,'supported-band-at-side-boundary');
 assert.equal(r.bands,2);
 assert.ok(r.samples[0].supported || r.samples.at(-1).supported);
});
