import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewRows,verifyRoarPreview,PREVIEW_START,PREVIEW_END} from '../site/roar-preview.mjs';
import {createPreviewService} from './roar-preview-service.mjs';
import {snapshotHash} from './roar-relay.mjs';
const base=JSON.parse(readFileSync(new URL('./public/roar-snapshot.json',import.meta.url)));
const start=1792368000;
const wallet=i=>'0x'+i.toString(16).padStart(40,'0');
function fixture(){
 const rows=Array.from({length:105},(_,i)=>({rank:i+1,address:wallet(i+1),balanceRaw:String(1000-i),boostStartedAt:i<10?null:i===10?start+100:start}));
 const source={...base,eventStart:start,snapshotTimestamp:start+3600,ranking:rows.slice(0,100),dayStartSnapshot:undefined,eligibleWallets:105};
 delete source.dayStartSnapshot;
 // Canonical source ranking uses its real boost rules.
 source.ranking=rows.slice().sort((a,b)=>{const points=r=>BigInt(r.balanceRaw)*BigInt(r.boostStartedAt===null?518400:518400+2*(source.snapshotTimestamp-r.boostStartedAt));return points(a)===points(b)?a.address.localeCompare(b.address):points(a)>points(b)?-1:1}).map((r,i)=>({...r,rank:i+1})).slice(0,100);
 const full={...source,schema:2,eventId:`25:${source.token}:${start}`,kind:'current',allRanking:rows,excludedAddresses:[],boundary:null};
 const hash=snapshotHash(full),index={environment:'ULTON_TEST',prizesEnabled:false,events:[{id:full.eventId,snapshots:[{kind:'current',at:source.snapshotTimestamp,block:source.snapshotBlock,hash}]}]};
 return {source,full,index};
}
test('simulated opening holders reach 250%, later activations retain real times, inactive wallets remain at zero',()=>{
 const {source,full}=fixture(),rows=previewRows(source,full.allRanking);
 assert.equal(rows.find(r=>r.address===wallet(12)).boostPercent,250);assert.equal(rows.find(r=>r.address===wallet(12)).pointsNumerator,BigInt(989)*35000n);
 assert.equal(rows.find(r=>r.address===wallet(1)).boostPercent,0);assert.equal(rows.find(r=>r.address===wallet(11)).boostPercent,1.26);
 assert.equal(rows.length,105);assert(rows.findIndex(r=>r.address===wallet(101))<100);
});
test('preview validates exact integer order and cannot cross the simulated deadline',()=>{
 const {source,full}=fixture(),ranking=previewRows(source,full.allRanking).slice(0,100).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:full.allRanking.find(x=>x.address===r.address).boostStartedAt}));
 const payload={schema:1,status:'SIMULATED',prizesEnabled:false,start:PREVIEW_START,end:PREVIEW_END,source,ranking};
 assert.equal(verifyRoarPreview(payload).ranking[0].boostPercent,250);
 assert.throws(()=>verifyRoarPreview({...payload,ranking:ranking.toReversed()}));
 assert.throws(()=>previewRows({...source,snapshotTimestamp:PREVIEW_END},full.allRanking));assert.throws(()=>previewRows(source,[...full.allRanking,full.allRanking[0]]));
});
test('server simulation uses all eligible wallets, returns only the two Top 100 views and never discloses full archive',async()=>{
 const data=fixture(),calls=[];
 const handler=createPreviewService({token:'test-token',now:()=>data.source.snapshotTimestamp*1000,fetcher:async url=>{calls.push(url);const p=new URL(url).pathname;return Response.json(p.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:p.endsWith('/latest.json')?data.source:p.endsWith('/index.json')?data.index:data.full)}});
 const response=await handler(new Request('https://test.example/api/roar/preview'));assert.equal(response.status,200);const payload=await response.json();
 assert.equal(payload.ranking.length,100);assert.equal(payload.allRanking,undefined);assert.equal(payload.source.allRanking,undefined);assert.equal(payload.prizesEnabled,false);assert.equal(verifyRoarPreview(payload).ranking[0].boostPercent,250);assert(calls.slice(1).every(u=>u.endsWith('?ref='+'a'.repeat(40))));
 assert.equal((await handler(new Request('https://test.example/api/roar/preview',{method:'POST'}))).status,405);
});
