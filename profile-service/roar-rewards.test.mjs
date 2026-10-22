import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocateRewards,poolState,rewardPoolState,POOL_RAW,POOL_START,verifyRewardFinal} from '../site/roar-rewards.mjs';
import {eventEnd} from '../site/roar-calendar.mjs';
import {snapshotHash} from './roar-relay.mjs';
import {createRewardsService} from './roar-rewards-service.mjs';
const odds=JSON.parse(readFileSync(new URL('../site/probabilities.json',import.meta.url))).probabilitiesPercent;
const fixture=JSON.parse(readFileSync(new URL('./fixtures/roar-draw-real.json',import.meta.url)));
function finalFixture(){
 const f=structuredClone(fixture.full),start=POOL_START,end=eventEnd(start);f.eventStart=start;f.eventId=`25:${f.token}:${start}`;f.snapshotTimestamp=end-1;
 f.ranking=f.ranking.map(r=>({...r,boostStartedAt:null})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 f.allRanking=f.ranking;f.boundary.block.timestamp='0x'+(end-1).toString(16);f.boundary.nextBlock.timestamp='0x'+end.toString(16);return f;
}
function service({full=finalFixture(),missing=false,now=eventEnd(POOL_START)*1000,corrupt=false}={}){
 const hash=snapshotHash(full),calls=[];
 const index={environment:'ULTON_TEST',prizesEnabled:false,events:[{id:full.eventId,snapshots:missing?[]:[{kind:'final',hash,block:full.snapshotBlock,at:full.snapshotTimestamp}]}]};
 const handler=createRewardsService({token:'test-read-token',now:()=>now,fetcher:async url=>{calls.push(url);return Response.json(url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:url.includes('/contents/index.json')?index:corrupt?{...full,snapshotTimestamp:full.snapshotTimestamp+1}:full)}});
 return {calls,get:start=>handler(new Request('https://example.com/api/roar/rewards?eventStart='+start))};
}
test('reward pool conserves every token and preserves exact 5% for first place',()=>{
 for(const total of [0n,1n,123456789n,POOL_RAW]){const shares=allocateRewards(total,odds);assert.equal(shares.reduce((a,b)=>a+b,0n),total);assert.equal(shares[0],total*5n/100n)}
 assert.equal(allocateRewards(POOL_RAW,odds)[0],50000n*10n**18n);
 assert(allocateRewards(POOL_RAW,odds).every(v=>v>0n));assert.throws(()=>allocateRewards(POOL_RAW,odds.slice(1)));assert.throws(()=>allocateRewards(POOL_RAW,odds.map(v=>v*2)));
});
test('linear pool release clamps at opening and deadline, including long and short months',()=>{
 for(const start of [POOL_START,Date.parse('2026-10-21Z')/1000,Date.parse('2027-02-21Z')/1000]){
  const end=eventEnd(start),duration=end-start;
  assert.equal(poolState(start,start-1).emitted,0n);assert.equal(poolState(start,start).remaining,POOL_RAW);
  const half=poolState(start,start+duration/2);assert.equal(half.emitted,POOL_RAW/2n);assert.equal(half.remaining+half.emitted,POOL_RAW);
  assert.equal(poolState(start,end-1).closed,false);assert.equal(poolState(start,end).remaining,0n);assert.equal(poolState(start,end+999999).emitted,POOL_RAW);
 }
});
test('current rank changes the live estimate, not a vested historical entitlement',()=>{
 const state=poolState(POOL_START,POOL_START+86400),shares=allocateRewards(state.emitted,odds);
 assert.equal(shares[0],25000n*10n**18n);assert(shares[1]<shares[0]);
});
test('final rewards stay locked before deadline without accessing private archive',async()=>{
 const s=service({now:eventEnd(POOL_START)*1000-1}),r=await s.get(POOL_START);assert.equal((await r.json()).status,'LOCKED');assert.equal(s.calls.length,0);
});
test('delayed final archive stays pending; never falls back to current snapshots',async()=>{
 const s=service({missing:true}),r=await s.get(POOL_START);assert.equal((await r.json()).status,'PENDING');assert.equal(s.calls.length,2);
});
test('verified final fixes all allocations without waiting for a lottery draw and hides private ranking',async()=>{
 const s=service(),r=await s.get(POOL_START);assert.equal(r.status,200);const payload=await r.json();
 assert.equal(payload.status,'FINAL');assert.equal(payload.snapshot.allRanking,undefined);assert.equal(payload.snapshot.audit,undefined);assert.equal(payload.prizesEnabled,false);
 assert.equal(verifyRewardFinal(payload,POOL_START,eventEnd(POOL_START)).ranking.length,100);
 assert(s.calls.slice(1).every(url=>url.endsWith('?ref='+'a'.repeat(40))));
 const invalid=structuredClone(payload);invalid.boundary.block.timestamp='0x'+eventEnd(POOL_START).toString(16);assert.throws(()=>verifyRewardFinal(invalid,POOL_START,eventEnd(POOL_START)));
 assert.throws(()=>verifyRewardFinal(payload,POOL_START,eventEnd(POOL_START)-1));assert.throws(()=>verifyRewardFinal(payload,POOL_START+864000,eventEnd(POOL_START)+864000));
});
test('hash mismatch, post-deadline block and incomplete Top 100 cannot finalize',async()=>{
 const corrupted=service({corrupt:true});assert.equal((await corrupted.get(POOL_START)).status,503);
 for(const mutate of [f=>{f.boundary.block.timestamp='0x'+eventEnd(POOL_START).toString(16)},f=>{f.ranking.pop()},f=>{f.boundary.nextBlock.number=f.boundary.block.number},f=>{f.prizesEnabled=true}]){const full=finalFixture();mutate(full);assert.equal((await service({full}).get(POOL_START)).status,503)}
});
test('reward endpoint rejects future, noncanonical and pre-simulation events',async()=>{
 const s=service();for(const start of [POOL_START+1,POOL_START-604800,Date.parse('2026-11-01Z')/1000,'abc'])assert.equal((await s.get(start)).status,400);
});

test('day-nine pool preview releases exactly 90% after nine days, preserves total and stops at the simulated deadline',()=>{
 const start=Date.parse('2026-10-11T00:00:00Z')/1000,end=Date.parse('2026-10-21T00:00:00Z')/1000;
 const preview=rewardPoolState(POOL_START,start+9*86400);
 assert.equal(preview.preview,true);assert.equal(preview.start,start);assert.equal(preview.end,end);assert.equal(preview.emitted,900000n*10n**18n);assert.equal(preview.remaining,100000n*10n**18n);
 assert.equal(allocateRewards(preview.emitted,odds)[0],45000n*10n**18n);
 assert.equal(rewardPoolState(POOL_START,end).remaining,0n);assert.equal(rewardPoolState(POOL_START,end+86400).emitted,POOL_RAW);
 const next=Date.parse('2026-10-21T00:00:00Z')/1000;assert.equal(rewardPoolState(next,next).preview,false);assert.equal(rewardPoolState(next,next).emitted,0n);
});
