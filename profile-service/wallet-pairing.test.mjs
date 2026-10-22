import test from 'node:test';
import assert from 'node:assert/strict';
import {pairWallet} from './wallet-pairing.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function wallet(connect=()=>Promise.resolve()){
 const events=new Map();return {stops:0,connect,on:(e,fn)=>events.set(e,fn),removeListener:(e)=>events.delete(e),disconnect(){this.stops++},emit:(e,value)=>events.get(e)?.(value),events};
}
test('pairing succeeds and removes pairing listeners',async()=>{const w=wallet();assert.equal(await pairWallet({createProvider:()=>w}),w);assert.equal(w.events.size,0);assert.equal(w.stops,0)});
test('cancel before initialization resolves disconnects the late provider',async()=>{const init=deferred(),c=new AbortController(),w=wallet();const p=pairWallet({createProvider:()=>init.promise,signal:c.signal});c.abort();await assert.rejects(p,{name:'AbortError'});init.resolve(w);await new Promise(r=>setImmediate(r));assert.equal(w.stops,1);assert.equal(w.events.size,0)});
test('cancel during pairing ignores URI and disconnects a late connection',async()=>{const ready=deferred(),c=new AbortController(),w=wallet(()=>ready.promise);let uris=0;const p=pairWallet({createProvider:()=>w,signal:c.signal,onUri:()=>uris++});await new Promise(r=>setImmediate(r));w.emit('display_uri','first');c.abort();await assert.rejects(p,{name:'AbortError'});w.emit('display_uri','late');ready.resolve();await new Promise(r=>setImmediate(r));assert.equal(uris,1);assert.equal(w.stops,2);assert.equal(w.events.size,0)});
test('pairing timeout releases provider and rejects',async()=>{const w=wallet(()=>new Promise(()=>{}));await assert.rejects(pairWallet({createProvider:()=>w,timeoutMs:5}),/timed out/);assert.equal(w.stops,1);assert.equal(w.events.size,0)});
