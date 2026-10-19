import test from 'node:test';
import assert from 'node:assert/strict';
import {BOOST_SECONDS,eventStart,score,verifySnapshot,movements,formatAmount,formatBoost} from '../site/roar-data.mjs';
const start=Date.parse('2026-10-12T00:00:00Z')/1000;
const a='0x'+'1'.repeat(40),b='0x'+'2'.repeat(40),c='0x'+'3'.repeat(40),token='0x'+'a'.repeat(40);
const snapshot=(rows)=>({schema:1,status:'verified',chainId:25,token,decimals:18,eventStart:start,snapshotTimestamp:start+6*86400+3600,snapshotBlock:100,complete:true,balancesVerified:true,openingBalancesVerified:true,dexClassificationVerified:true,ranking:rows});
test('weekly opening and exact maximum wallet boost',()=>{assert.equal(eventStart(start+6*86400+86399),start);assert.equal(eventStart(start+7*86400),start+7*86400);const row={balanceRaw:'1000000000000000000000',boostStartedAt:start};const s=score(row,start+7*86400-1,start);assert.equal(s.boostPercent,200);assert.equal(s.pointsNumerator,3000000000000000000000n*BigInt(BOOST_SECONDS));assert.equal(formatBoost(0),'0.00%');assert.equal(formatBoost(200),'200.00%')});
test('additional tokens immediately receive the active wallet boost',()=>{const r={balanceRaw:'1000',boostStartedAt:start};const before=score(r,start+6*86400,start);const after=score({...r,balanceRaw:'2000'},start+6*86400,start);assert.equal(after.pointsNumerator,before.pointsNumerator*2n);assert.equal(score({...r,boostStartedAt:null},start+6*86400,start).boostPercent,0)});
test('incomplete verification and stale boost starts are rejected',()=>{const row={rank:1,address:a,balanceRaw:'1000',boostStartedAt:start};assert.throws(()=>verifySnapshot({...snapshot([row]),complete:false}));assert.throws(()=>verifySnapshot({...snapshot([row]),openingBalancesVerified:false}));assert.throws(()=>verifySnapshot(snapshot([{...row,boostStartedAt:start-1}])));assert.throws(()=>verifySnapshot(snapshot([{...row,balanceRaw:'0'}])))});
test('movement compares against a fixed midnight UTC baseline, including NEW',()=>{const current=verifySnapshot(snapshot([{rank:1,address:a,balanceRaw:'300',boostStartedAt:start},{rank:2,address:c,balanceRaw:'200',boostStartedAt:start},{rank:3,address:b,balanceRaw:'100',boostStartedAt:start}]));const previous={...snapshot([{rank:1,address:b},{rank:2,address:a}]),snapshotTimestamp:start+6*86400,comparisonTimestamp:start+6*86400,snapshotBlock:99};const m=movements(current,previous);assert.equal(m.get(a).text,'↑1');assert.equal(m.get(b).text,'↓2');assert.equal(m.get(c).text,'NEW');assert.equal(movements(current,null).size,0);assert.equal(movements(current,{...previous,eventStart:start-7*86400}).size,0);assert.equal(movements(current,{...previous,token:b}).size,0);assert.equal(movements(current,{...previous,comparisonTimestamp:start+5*86400}).size,0);assert.equal(movements(current,{...previous,snapshotTimestamp:start+6*86400+1}).size,0)});
test('large balances retain exact digits and point scaling',()=>{assert.equal(formatAmount('123456789012345678901234567890',18),'123,456,789,012.34');assert.equal(formatAmount(3000n*10n**18n*BigInt(BOOST_SECONDS),18,BigInt(BOOST_SECONDS)),'3,000')});
test('equal scores use the canonical lower-case address tie break',()=>{const row={balanceRaw:'1000',boostStartedAt:start};assert.equal(verifySnapshot(snapshot([{...row,address:a,rank:1},{...row,address:b,rank:2}])).ranking[0].address,a);assert.throws(()=>verifySnapshot(snapshot([{...row,address:b,rank:1},{...row,address:a,rank:2}])),/ordered/)});

test('midnight resets the movement baseline independently of weekly boost',()=>{const row={rank:1,address:a,balanceRaw:'300',boostStartedAt:start};const current=verifySnapshot({...snapshot([row]),snapshotTimestamp:start+5*86400+86399});const baseline={...snapshot([{rank:1,address:a}]),snapshotTimestamp:start+5*86400,comparisonTimestamp:start+5*86400,snapshotBlock:90};assert.equal(movements(current,baseline).get(a).text,'—');const next=verifySnapshot({...current,snapshotTimestamp:start+6*86400});assert.equal(movements(next,baseline).size,0);assert(next.ranking[0].boostPercent>current.ranking[0].boostPercent)});
test('Monday movements accept the last pre-midnight block bound to the new opening',()=>{
 const current=verifySnapshot({...snapshot([{rank:1,address:a,balanceRaw:'300',boostStartedAt:start},{rank:2,address:b,balanceRaw:'100',boostStartedAt:start}]),snapshotTimestamp:start+3600});
 const baseline={status:'verified',chainId:25,token,eventStart:start,comparisonTimestamp:start,snapshotTimestamp:start-1,snapshotBlock:99,ranking:[{rank:1,address:b},{rank:2,address:a}]};
 assert.equal(movements(current,baseline).get(a).text,'↑1');
 assert.equal(movements(current,baseline).get(b).text,'↓1');
 assert.equal(movements(current,{...baseline,eventStart:start-604800}).size,0);
 assert.equal(movements(current,{...baseline,snapshotTimestamp:start-86401}).size,0);
 assert.equal(movements(current,{...baseline,comparisonTimestamp:start-86400}).size,0);
 assert.equal(movements(current,{...baseline,snapshotBlock:101}).size,0);
});

test('calendar periods, exact 0.01% boost steps, full points and close cutoffs',()=>{
 const at=s=>Date.parse(s+'T00:00:00Z')/1000,start=at('2026-11-01'),row={address:a,rank:1,balanceRaw:'1000000',boostStartedAt:start};
 assert.equal(score(row,start+27,start).boostPercent,0);assert.equal(score(row,start+28,start).boostPercent,.01);
 assert.equal(formatBoost(.01),'0.01%');assert.equal(score(row,start+86400,start).boostPercent,31.25);
 const max=score(row,start+8*86400,start);assert.equal(max.boostPercent,250);assert.equal(formatAmount(max.pointsNumerator,0,BigInt(max.pointsDenominator)),'3,500,000');
 const data={...snapshot([row]),eventStart:start,snapshotTimestamp:start+8*86400,eventEnd:at('2026-11-11')};assert.equal(verifySnapshot(data).ranking[0].boostPercent,250);
 assert.throws(()=>verifySnapshot({...data,snapshotTimestamp:at('2026-11-11')}));assert.throws(()=>verifySnapshot({...data,eventEnd:at('2026-11-10')}));
 for(const [date,expected] of [['2026-10-31','2026-10-21'],['2027-02-28','2027-02-21'],['2028-02-29','2028-02-21'],['2028-03-01','2028-03-01']])assert.equal(eventStart(at(date)),at(expected));
 assert.equal(eventStart(at('2026-10-21')),at('2026-10-21'));
});
