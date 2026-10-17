import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createRoarRelay,verifyPublisher,validatePublishedSnapshot,strictBlobFetch,TOKEN,PUBLISH_URL} from './roar-relay.mjs';
import {createRoarFeed} from '../site/roar-feed.mjs';
const now=Date.parse('2026-10-17T14:00:00Z'),seconds=now/1000,start=1791763200;
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test',alg:'RS256',use:'sig'};
const claims={iss:'https://token.actions.githubusercontent.com',aud:PUBLISH_URL,repository:'bennyE90/loadthelion-indexer',repository_id:'1422080818',repository_owner_id:'343509444',repository_visibility:'private',ref:'refs/heads/test-ulton-roar-boost',sub:'repo:bennyE90/loadthelion-indexer:ref:refs/heads/test-ulton-roar-boost',workflow_ref:'bennyE90/loadthelion-indexer/.github/workflows/roar-cycle-test.yml@refs/heads/test-ulton-roar-boost',event_name:'push',run_id:'123',run_attempt:'1',iat:seconds-10,nbf:seconds-10,exp:seconds+290};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function jwt(overrides={},header={}){const data=encode({alg:'RS256',typ:'JWT',kid:'test',...header})+'.'+encode({...claims,...overrides});return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url')}
const opts={loadKeys:async()=>[jwk],now:()=>now};
export function fixture(){return {schema:1,status:'verified',environment:'ULTON_TEST',chainId:25,token:TOKEN,decimals:18,eventStart:start,snapshotTimestamp:seconds-120,snapshotBlock:100475440,complete:true,balancesVerified:true,openingBalancesVerified:true,dexClassificationVerified:true,eligibleWallets:1,ranking:[{rank:1,address:'0x'+'1'.repeat(40),balanceRaw:'1000000000000000000',boostStartedAt:start}],prizesEnabled:false,audit:{snapshotBlockHash:'0x'+'a'.repeat(64),activeHolders:3,zeroBalanceAddresses:2,historicalWallets:5,eligiblePlainWallets:1,eligibleDelegatedWallets:0,excludedActiveContracts:1,excludedActiveBurnAddresses:1,prizesEnabled:false}}}
const archive={commit:'a'.repeat(40),eventId:`25:${TOKEN}:${start}`,snapshotHash:'b'.repeat(64)};
function memoryStore(){const map=new Map();let seq=0;return {map,async getWithMetadata(k){return structuredClone(map.get(k)||null)},async setJSON(k,data,o={}){const old=map.get(k);if(o.onlyIfNew&&old||o.onlyIfMatch&&old?.etag!==o.onlyIfMatch)return {modified:false};const etag=String(++seq);map.set(k,{data:structuredClone(data),etag});return {modified:true,etag}}}}
function setup(store=memoryStore()){const handler=createRoarRelay({store,...opts});return {store,handler,post:(snapshot=fixture(),authorization='Bearer '+jwt(),ref=archive)=>handler(new Request(PUBLISH_URL,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify({snapshot,archive:ref})})),get:(headers={})=>handler(new Request(PUBLISH_URL.replace('publish','snapshot'),{headers}))}}
test('only the signed private repository and exact workflow may publish',async()=>{
 assert.equal((await verifyPublisher(jwt(),opts)).run_id,'123');
 const main='refs/heads/main';assert.equal((await verifyPublisher(jwt({ref:main,sub:claims.sub.replace(claims.ref,main),workflow_ref:claims.workflow_ref.replace(claims.ref,main),event_name:'schedule'}),opts)).ref,main);
 for(const override of [{aud:'other'},{iss:'https://evil.invalid'},{repository_id:'42'},{repository_owner_id:'42'},{repository_visibility:'public'},{repository:'fork/repo'},{ref:'refs/heads/other'},{sub:'repo:fork/repo:ref:refs/heads/main'},{workflow_ref:'other'},{event_name:'pull_request'},{exp:seconds},{iat:seconds-601},{nbf:seconds+31},{iat:seconds+31},{exp:seconds+2000}])await assert.rejects(verifyPublisher(jwt(override),opts));
 await assert.rejects(verifyPublisher(jwt({}, {alg:'none'}),opts));await assert.rejects(verifyPublisher(jwt()+'.extra',opts));await assert.rejects(verifyPublisher(jwt().replace(/.$/,'!'),opts));
});
test('publication authenticates first, reconciles holder counts, requires permanent archive reference',async()=>{
 const s=setup();assert.equal((await s.post(fixture(),'')).status,401);
 for(const change of [{token:'0x'+'f'.repeat(40)},{prizesEnabled:true},{eligibleWallets:2},{snapshotTimestamp:seconds+121},{audit:{...fixture().audit,historicalWallets:6}}])assert.equal((await s.post({...fixture(),...change})).status,422);
 assert.equal((await s.post(fixture(),undefined,{...archive,commit:''})).status,422);
 assert.throws(()=>validatePublishedSnapshot({...fixture(),ranking:[{...fixture().ranking[0],address:'0x'+'0'.repeat(36)+'dead'}]},archive,now));
 assert.equal(s.store.map.size,0);
});
test('published snapshots support ETags, idempotency and immutable content',async()=>{
 const s=setup();assert.equal((await s.get()).status,503);assert.equal((await s.post()).status,200);
 const r=await s.get(),data=await r.json();assert.equal(data.eligibleWallets,1);assert.equal(data.publication.archiveCommit,archive.commit);assert.equal(data.publication.runId,'123');
 assert.equal((await s.get({'if-none-match':r.headers.get('etag')})).status,304);
 assert.equal((await (await s.post()).json()).status,'unchanged');assert.equal(s.store.map.size,2);
 assert.equal((await s.handler(new Request(PUBLISH_URL))).status,405);
});
test('older or conflicting data cannot replace the last valid snapshot',async()=>{
 const s=setup();await s.post();
 for(const change of [{snapshotBlock:100475439},{snapshotTimestamp:seconds-121},{snapshotTimestamp:seconds-119},{ranking:[{...fixture().ranking[0],balanceRaw:'200'}]}])assert.equal((await s.post({...fixture(),...change})).status,409);
 assert.equal((await (await s.get()).json()).ranking[0].balanceRaw,fixture().ranking[0].balanceRaw);
});
test('racing publications cannot roll the feed backwards',async()=>{
 const s=setup();await s.post();const next={...fixture(),snapshotBlock:100475441,snapshotTimestamp:seconds-119},newest={...next,snapshotBlock:100475442,snapshotTimestamp:seconds-118};
 const results=await Promise.all([s.post(next),s.post(newest),s.post(next)]);assert(results.every(r=>[200,409].includes(r.status)));
 assert.equal((await (await s.get()).json()).snapshotBlock,newest.snapshotBlock);
});
test('failed storage writes retain the previous published snapshot',async()=>{
 const s=setup();await s.post();s.store.setJSON=async()=>{throw Error('unavailable')};
 assert.equal((await s.post({...fixture(),snapshotBlock:100475441,snapshotTimestamp:seconds-119})).status,503);assert.equal((await (await s.get()).json()).snapshotBlock,fixture().snapshotBlock);
});
test('SDK cannot acknowledge a failed conditional write',async()=>{
 const original=globalThis.fetch;
 try{for(const code of [403,429,500,503]){globalThis.fetch=async()=>new Response(null,{status:code});await assert.rejects(strictBlobFetch('https://example.invalid',{method:'put'}));}
 for(const code of [200,201,412]){globalThis.fetch=async()=>new Response(null,{status:code});assert.equal((await strictBlobFetch('https://example.invalid',{method:'PUT'})).status,code)}}finally{globalThis.fetch=original}
});
test('oversize publications are rejected without storage mutation',async()=>{const s=setup();const data={...fixture(),padding:'x'.repeat(180000)};assert.equal((await s.post(data)).status,422);assert.equal(s.store.map.size,0)});
test('feed uses API ETag and retains its snapshot after failure, rollback or conflict',async()=>{
 let response=Response.json(fixture(),{headers:{etag:'"first"'}}),seen;
 const feed=createRoarFeed({now:()=>now,fetcher:async(url,options)=>{seen={url,options};return response.clone()}});
 assert.equal((await feed.read()).state,'live');assert.equal(seen.url,'/api/roar/snapshot');
 response=new Response(null,{status:304});assert.equal((await feed.read()).state,'unchanged');assert.equal(seen.options.headers['If-None-Match'],'"first"');
 for(const bad of [{...fixture(),snapshotBlock:100475439},{...fixture(),ranking:[{...fixture().ranking[0],balanceRaw:'999'}]},{...fixture(),complete:false}]){response=Response.json(bad);assert.equal((await feed.read()).state,'retained');assert.equal(feed.current.ranking[0].balanceRaw,fixture().ranking[0].balanceRaw)}
 response=new Response(null,{status:503});assert.equal((await feed.read()).state,'retained');
});
test('feed uses the saved snapshot on first-load API failure, then recovers',async()=>{
 let live=false;const feed=createRoarFeed({now:()=>now,fetcher:async url=>url.startsWith('/')&&!live?new Response(null,{status:503}):Response.json(fixture())});
 assert.equal((await feed.read()).state,'saved');live=true;assert.equal((await feed.read()).state,'live');
 const unavailable=createRoarFeed({fetcher:async()=>{throw Error('offline')}});assert.deepEqual(await unavailable.read(),{snapshot:null,state:'unavailable'});
});
