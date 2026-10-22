import {snapshotHash,TOKEN} from './roar-relay.mjs';
import {eventStart,eventEnd} from '../site/roar-calendar.mjs';
import {POOL_START,verifyRewardFinal} from '../site/roar-rewards.mjs';
const API='https://api.github.com/repos/bennyE90/loadthelion-indexer';
export function createRewardsService({token,fetcher=fetch,now=()=>Date.now()}={}){
 let cached=null,expires=0,pending=null,pendingStart=null;
 async function load(start){
  const base={schema:1,eventStart:start,environment:'ULTON_TEST',prizesEnabled:false};
  if(Math.floor(now()/1000)<eventEnd(start))return {...base,status:'LOCKED'};
  if(!token)throw Error('Archive not configured');
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){const r=await fetcher(API+path,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Archive unavailable');return r.json()}
  const ref=await get('/git/ref/heads/roar-test-archive'),commit=ref.object?.sha;
  if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Invalid archive commit');
  const contents=path=>get('/contents/'+path+'?ref='+commit),index=await contents('index.json');
  if(index.environment!=='ULTON_TEST'||index.prizesEnabled!==false||!Array.isArray(index.events))throw Error('Invalid rewards archive');
  const id=`25:${TOKEN}:${start}`,records=index.events.find(e=>e.id===id)?.snapshots.filter(s=>s.kind==='final')||[];
  if(!records.length)return {...base,status:'PENDING'};
  if(records.length!==1||!/^[0-9a-f]{64}$/.test(records[0].hash))throw Error('Ambiguous final snapshot');
  const record=records[0],full=await contents('snapshots/'+record.hash+'.json');
  if(snapshotHash(full)!==record.hash||full.kind!=='final'||full.eventId!==id||full.snapshotBlock!==record.block||full.snapshotTimestamp!==record.at||full.environment!=='ULTON_TEST')throw Error('Final archive mismatch');
  // Explicit public allowlist: never publish the full private holder archive.
  const fields=['status','chainId','token','decimals','eventStart','snapshotTimestamp','snapshotBlock','blockHash','complete','balancesVerified','openingBalancesVerified','dexClassificationVerified','prizesEnabled','ranking'];
  const snapshot={schema:1,...Object.fromEntries(fields.map(k=>[k,full[k]]))};
  const payload={...base,status:'FINAL',archiveCommit:commit,snapshotHash:record.hash,boundary:full.boundary,snapshot};
  verifyRewardFinal(payload,start,Math.floor(now()/1000));return payload;
 }
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  const value=new URL(request.url).searchParams.get('eventStart'),start=Number(value),time=Math.floor(now()/1000);
  if(!/^\d{10}$/.test(value||'')||!Number.isSafeInteger(start)||start<POOL_START||start!==eventStart(start)||start>eventStart(time))return Response.json({error:'Invalid reward event'},{status:400});
  try{
   if(!cached||cached.eventStart!==start||now()>=expires){
    // Each request retains its own event promise; concurrent event reads cannot mix.
    if(!pending||pendingStart!==start){pendingStart=start;pending=load(start);}
    const task=pending;try{const result=await task;cached=result;expires=now()+(result.status==='LOCKED'?Math.min(60000,Math.max(0,eventEnd(start)*1000-now())):60000)}finally{if(pending===task){pending=null;pendingStart=null}}
   }
   return new Response(request.method==='HEAD'?null:JSON.stringify(cached),{headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({status:'UNAVAILABLE',error:'Final rewards pending verification'},{status:503,headers:{'Cache-Control':'no-store'}})}
 };
}
