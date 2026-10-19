import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDrawService} from './roar-draw-service.mjs';
import {verifyPublicDraw,hash,units,wheelStop,selectRank} from './draw-proof.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/roar-draw-real.json',import.meta.url)));
const request=()=>new Request('https://example.invalid/api/roar/draw');
function setup({mutate=x=>x,fetchFail=false}={}){let calls=[];const service=createDrawService({token:'test-read-only',now:()=>Date.parse('2026-10-19T04:00:00Z'),fetcher:async(url,opts)=>{calls.push(url);assert.equal(opts.headers.Authorization,'Bearer test-read-only');assert(!url.includes('test-read-only'));if(fetchFail)return new Response(null,{status:403});const path=new URL(url).pathname;if(path.includes('/git/ref/'))return Response.json({object:{sha:'a'.repeat(40)}});assert.equal(new URL(url).searchParams.get('ref'),'a'.repeat(40));return Response.json(mutate(structuredClone(path.endsWith('index.json')?fixture.index:fixture.full),path))}});return {service,calls}}
test('real closed event and signed beacon reproduce the archived winner without a new draw',async()=>{
 const {service,calls}=setup();const response=await service(request());assert.equal(response.status,200);const proof=await response.json(),verified=await verifyPublicDraw(proof);
 assert.equal(verified.rank,12);assert.equal(verified.winner,'0x5078bd367a5df4195288ea9e48b6f435d761d835');assert.equal(proof.final.snapshotTimestamp,Date.parse('2026-10-18T23:59:59Z')/1000);
 assert.equal(proof.onchain.status,'NOT_REGISTERED');assert.equal(proof.onchain.transactionHash,null);assert(!('allRanking' in proof.final));assert.equal(proof.prizesEnabled,false);
 assert.deepEqual(await (await service(request())).json(),proof);assert.equal(calls.length,3);
});
test('changed snapshot, forged signature and unavailable private archive block playback',async()=>{
 for(const mode of ['snapshot','signature','winner','round']){
  const {service}=setup({mutate:(d,path)=>{if(mode==='snapshot'&&!path.endsWith('index.json'))d.ranking[0].balanceRaw='1';if(path.endsWith('index.json')){const draw=d.events[0].draw;if(mode==='signature')draw.proof.signature='0'.repeat(192);if(mode==='winner')draw.winner='0x'+'1'.repeat(40);if(mode==='round')draw.round++}return d}});assert.equal((await service(request())).status,503,mode);
 }
 assert.equal((await setup({fetchFail:true}).service(request())).status,503);
});
test('browser rejects next-week cutoff, wrong probabilities and a counterfeit chain registration',async()=>{
 const p=await (await setup().service(request())).json();
 for(const tamper of [x=>x.final.snapshotTimestamp++,x=>x.final.boundary.block.timestamp='0x'+(x.final.eventStart+604800).toString(16),x=>x.probabilitiesPercent[0]=6,x=>x.draw.ticket='0',x=>x.onchain.status='REGISTERED']){const bad=structuredClone(p);tamper(bad);await assert.rejects(verifyPublicDraw(bad))}
});
test('weighted wheel stop lies within every exact probability sector including rank 100',()=>{
 const w=units(JSON.parse(readFileSync(new URL('../site/probabilities.json',import.meta.url))).probabilitiesPercent),total=w.reduce((a,b)=>a+b,0n);let before=0n;
 for(let rank=1;rank<=100;rank++){const angle=wheelStop(w,rank);assert(angle>360*Number(before)/Number(total));before+=w[rank-1];assert(angle<360*Number(before)/Number(total))}
});
test('a pending draw cannot fabricate a winner and HTTP methods never create state',async()=>{
 const {service}=setup({mutate:(d,path)=>path.endsWith('index.json')?{...d,events:[]}:d});const pending=await (await service(request())).json();assert.equal(pending.status,'PENDING');assert(!pending.draw);assert.equal((await service(new Request(request(),{method:'POST'}))).status,405);
});
