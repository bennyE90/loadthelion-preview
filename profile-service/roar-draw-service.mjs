import probabilityData from '../site/probabilities.json' with {type:'json'};
import {hash,verifyPublicDraw} from './draw-proof.mjs';
import {verifySnapshot} from '../site/roar-data.mjs';
const API='https://api.github.com/repos/bennyE90/loadthelion-indexer';
const approved=probabilityData.probabilitiesPercent;
export function createDrawService({token,fetcher=fetch,now=()=>Date.now()}={}){
 let cached=null,expires=0,pending=null;
 async function load(){
  if(!token)throw Error('Archive not configured');
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){const r=await fetcher(API+path,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Archive unavailable');return r.json()}
  const ref=await get('/git/ref/heads/roar-test-archive'),commit=ref.object?.sha;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Invalid archive commit');
  const contents=path=>get('/contents/'+path+'?ref='+commit),index=await contents('index.json');
  if(index.environment!=='ULTON_TEST'||index.prizesEnabled!==false)throw Error('Invalid archive');
  const events=index.events.filter(e=>e.draw&&e.snapshots.some(s=>s.kind==='final')).sort((a,b)=>Number(b.id.split(':').at(-1))-Number(a.id.split(':').at(-1)));
  if(!events.length)return {schema:1,status:'PENDING',prizesEnabled:false};
  const event=events[0],record=event.snapshots.find(s=>s.kind==='final'),full=await contents('snapshots/'+record.hash+'.json');
  if(hash(full)!==record.hash||full.kind!=='final'||full.eventId!==event.id||full.snapshotBlock!==record.block||full.snapshotTimestamp!==record.at||full.prizesEnabled!==false||full.snapshotTimestamp>=Math.floor(now()/1000))throw Error('Final archive mismatch');
  verifySnapshot({...full,schema:1});
  const units=approved.map(v=>{const [a,b='']=String(v).split('.');return String(BigInt(a)*10n**12n+BigInt(b.padEnd(12,'0')))});
  const end=full.eventStart+604800,round=event.draw.round;
  const plan={schema:1,eventId:event.id,snapshotHash:record.hash,weightsHash:hash(units),chainHash:'8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce',round,releaseTime:1595431050+(round-1)*30,algorithm:'SHA256_REJECTION_SAMPLING_V1',prizesEnabled:false};
  const payload={schema:1,status:'VERIFIED',environment:'ULTON_TEST',prizesEnabled:false,archiveCommit:commit,final:{token:full.token,eventStart:full.eventStart,snapshotTimestamp:full.snapshotTimestamp,snapshotBlock:full.snapshotBlock,blockHash:full.blockHash,boundary:full.boundary,snapshotHash:record.hash,ranking:full.ranking},plan,draw:event.draw,probabilitiesPercent:approved,onchain:{status:'NOT_REGISTERED',chainId:25,transactionHash:null}};
  await verifyPublicDraw(payload);return payload;
 }
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405});
  try{if(!cached||now()>=expires){if(!pending)pending=load().then(p=>{cached=p;expires=now()+60000;return p}).finally(()=>{pending=null});await pending}return new Response(request.method==='HEAD'?null:JSON.stringify(cached),{headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}})}catch{return Response.json({status:'UNAVAILABLE',error:'Verified draw unavailable; reveal blocked'},{status:503,headers:{'Cache-Control':'no-store'}})}
 };
}
