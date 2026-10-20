import {verifyMonthly,MONTHLY_TOKEN} from '../site/monthly-roar.mjs';
const API='https://api.github.com/repos/bennyE90/loadthelion-indexer';
export function createMonthlyService({token,fetcher=fetch,now=()=>Date.now()}={}){
 let cached=null,expires=0,pending=null;
 async function read(){
  if(!token)throw Error('Monthly archive not connected');
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){const r=await fetcher(API+path,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Monthly archive unavailable');return r.json()}
  const ref=await get('/git/ref/heads/roar-test-archive'),commit=ref.object?.sha;
  if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Invalid monthly commit');
  const raw=await get('/contents/monthly/latest.json?ref='+commit);verifyMonthly(raw,now());
  // Explicitly expose totals only, never private transaction evidence or credentials.
  const ranking=raw.ranking.slice(0,100).map(({rank,address,buysUsd,sellsUsd,outgoingUsd,netUsdMicros,reachedAt})=>({rank,address,buysUsd,sellsUsd,outgoingUsd,netUsdMicros,reachedAt}));
  cached={schema:1,status:'VERIFIED',environment:'ULTON_TEST',chainId:25,token:MONTHLY_TOKEN,prizesEnabled:false,eventStart:raw.eventStart,eventEnd:raw.eventEnd,historyFrom:raw.historyFrom,complete:true,transactionPricesVerified:true,exclusionsVerified:true,snapshotTimestamp:raw.snapshotTimestamp,ranking,archiveCommit:commit};expires=now()+60000;return cached;
 }
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'GET, HEAD'}});
  try{let data;if(cached&&now()<expires){verifyMonthly(cached,now());data=cached}else{if(!pending)pending=read().finally(()=>{pending=null});data=await pending}
   return new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response(request.method==='HEAD'?null:JSON.stringify({status:'AWAITING_HISTORY',environment:'ULTON_TEST',prizesEnabled:false}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
 };
}
