import {verifySnapshot} from './roar-data.mjs?v=20261019-calendar2';
const TOKEN='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef';
const core=s=>JSON.stringify({token:s.token,eventStart:s.eventStart,decimals:s.decimals,eligibleWallets:s.eligibleWallets,ranking:s.ranking.map(r=>[r.address,r.balanceRaw,r.boostStartedAt,r.rank])});
export function createRoarFeed({fetcher=fetch,now=()=>Date.now()}={}){
 let current=null,etag=null;
 function accept(raw){
  const next=verifySnapshot(raw);
  if(next.token!==TOKEN||next.environment!=='ULTON_TEST'||next.snapshotTimestamp>Math.floor(now()/1000)+300)throw Error('Unexpected test snapshot');
  if(current&&(next.snapshotBlock<current.snapshotBlock||next.snapshotTimestamp<current.snapshotTimestamp))throw Error('Older snapshot rejected');
  if(current&&next.snapshotBlock===current.snapshotBlock&&next.snapshotTimestamp===current.snapshotTimestamp&&core(next)!==core(current))throw Error('Conflicting snapshot rejected');
  current=next;return next;
 }
 return {
  get current(){return current;},
  async read(signal){
   try{
    const response=await fetcher('/api/roar/snapshot',{credentials:'same-origin',cache:'no-cache',signal,headers:etag?{'If-None-Match':etag}:{}});
    if(response.status===304){if(!current)throw Error('Missing cached snapshot');return {snapshot:current,state:'unchanged'};}
    if(!response.ok)throw Error('Snapshot service unavailable');
    const snapshot=accept(await response.json());etag=response.headers.get('etag');return {snapshot,state:'live'};
   }catch{
    if(current)return {snapshot:current,state:'retained'};
    try{const response=await fetcher('roar-snapshot.json',{cache:'no-cache',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('No backup');return {snapshot:accept(await response.json()),state:'saved'};}catch{return {snapshot:null,state:'unavailable'};}
   }
  }
 };
}
