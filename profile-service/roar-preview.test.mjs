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
function addOpening(data){
 const original=data.full.allRanking.map(r=>({...r,boostStartedAt:start}));
 const block=data.source.snapshotBlock-1000,blockHash='0x'+'c'.repeat(64);
 const source={...data.source,snapshotTimestamp:start,snapshotBlock:block,blockHash,ranking:original.slice(0,100),prizesEnabled:false};
 const boundary={block:{number:'0x'+block.toString(16),timestamp:'0x'+(start-1).toString(16),hash:blockHash},nextBlock:{number:'0x'+(block+1).toString(16),timestamp:'0x'+start.toString(16),parentHash:blockHash},safeHead:data.source.snapshotBlock};
 const opening={...source,schema:2,kind:'opening',eventId:data.full.eventId,environment:'ULTON_TEST',allRanking:original,excludedAddresses:[],boundary};
 const hash=snapshotHash(opening);data.index.events[0].snapshots.push({kind:'opening',at:start,block,hash});
 return {opening,hash};
}
test('yesterday closing balances produce a fixed midnight simulation baseline with real up/down/NEW movements',async()=>{
 const data=fixture(),{opening,hash}=addOpening(data);
 const handler=createPreviewService({token:'test-token',now:()=>data.source.snapshotTimestamp*1000,fetcher:async url=>{const p=new URL(url).pathname;return Response.json(p.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:p.endsWith('/latest.json')?data.source:p.endsWith('/index.json')?data.index:p.includes(hash)?opening:data.full)}});
 const response=await handler(new Request('https://test.example/api/roar/preview'));assert.equal(response.status,200);const raw=await response.json(),preview=verifyRoarPreview(raw);
 assert(preview.baseline);assert.equal(preview.baseline.snapshotTimestamp,start-1);assert.equal(preview.baseline.comparisonTimestamp,start);assert.equal(preview.baseline.ranking.length,100);assert.equal(raw.baseline.source.allRanking,undefined);
 const {movements}=await import('../site/roar-data.mjs');const changes=movements({...preview.source,ranking:preview.ranking},preview.baseline);
 assert.deepEqual(changes.get(wallet(12)),{type:'up',text:'↑11',label:'Up 11 positions since 00:00 UTC'});
 assert.equal(changes.get(wallet(1)).type,'down');assert.equal(changes.get(wallet(105)).type,'new');
 const baselineBefore=JSON.stringify(raw.baseline);await handler(new Request('https://test.example/api/roar/preview'));assert.equal(JSON.stringify(raw.baseline),baselineBefore);
 for(const alter of [p=>{p.baseline.comparisonTimestamp-=86400},p=>{p.baseline.source.snapshotBlock=data.source.snapshotBlock+1},p=>{p.baseline.boundary.block.timestamp='0x'+start.toString(16)},p=>{p.baseline.ranking[0].sourceBoostStartedAt=null}]){const changed=structuredClone(raw);alter(changed);assert.equal(verifyRoarPreview(changed).baseline,null)}
});
test('tampered archived opening cannot invent arrows or prevent the current preview',async()=>{
 const data=fixture(),{opening,hash}=addOpening(data);opening.allRanking[0].balanceRaw='1';
 const handler=createPreviewService({token:'test-token',now:()=>data.source.snapshotTimestamp*1000,fetcher:async url=>{const p=new URL(url).pathname;return Response.json(p.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:p.endsWith('/latest.json')?data.source:p.endsWith('/index.json')?data.index:p.includes(hash)?opening:data.full)}});
 const response=await handler(new Request('https://test.example/api/roar/preview'));assert.equal(response.status,200);const preview=verifyRoarPreview(await response.json());assert.equal(preview.baseline,null);assert.equal(preview.ranking.length,100);
});
