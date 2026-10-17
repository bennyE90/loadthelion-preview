import {createHash,createPublicKey,verify} from 'node:crypto';
import {verifySnapshot} from '../site/roar-data.mjs';
export const TOKEN='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef';
export const PUBLISH_URL='https://scintillating-daffodil-e9e1c5.netlify.app/api/roar/publish';
const ISSUER='https://token.actions.githubusercontent.com';
const REPOSITORY='bennyE90/loadthelion-indexer';
const WORKFLOW=REPOSITORY+'/.github/workflows/roar-cycle-test.yml@';
const refs=new Set(['refs/heads/main','refs/heads/test-ulton-roar-boost']);
const MAX_BODY=180000;
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export const snapshotHash=v=>createHash('sha256').update(canonical(v)).digest('hex');
// Blobs 11.1.4 treats non-412 conditional write failures as successful writes.
// Reject those responses before the SDK can acknowledge a failed publication.
export async function strictBlobFetch(input,init){
 const response=await fetch(input,init);
 const method=(init?.method||input?.method||'GET').toUpperCase();
 if(method==='PUT'&&!response.ok&&response.status!==412)throw Error('Blob write failed');
 return response;
}
let cachedKeys=null,keysExpire=0;
async function githubKeys(){
 if(cachedKeys&&Date.now()<keysExpire)return cachedKeys;
 const r=await fetch(ISSUER+'/.well-known/jwks',{signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!r.ok)throw Error('Signing keys unavailable');
 const data=await r.json();if(!Array.isArray(data.keys)||data.keys.length>30)throw Error('Invalid signing keys');
 cachedKeys=data.keys;keysExpire=Date.now()+300000;return cachedKeys;
}
export async function verifyPublisher(token,{loadKeys=githubKeys,now=()=>Date.now()}={}){
 if(typeof token!=='string'||token.length>16000||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))throw Error('Invalid publisher');
 const [h,p,s]=token.split('.'),header=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(p,'base64url'));
 if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||header.kid.length>128)throw Error('Invalid signing algorithm');
 const key=(await loadKeys()).find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
 if(!key||!verify('RSA-SHA256',Buffer.from(h+'.'+p),createPublicKey({key,format:'jwk'}),Buffer.from(s,'base64url')))throw Error('Publisher signature rejected');
 const time=Math.floor(now()/1000);
 if(claims.iss!==ISSUER||claims.aud!==PUBLISH_URL||claims.repository!==REPOSITORY||claims.repository_id!=='1422080818'||claims.repository_owner_id!=='343509444'||claims.repository_visibility!=='private'||!refs.has(claims.ref)||claims.sub!==`repo:${REPOSITORY}:ref:${claims.ref}`||claims.workflow_ref!==WORKFLOW+claims.ref||!['push','schedule','workflow_dispatch'].includes(claims.event_name)||!/^\d+$/.test(claims.run_id||'')||!/^\d+$/.test(claims.run_attempt||'')||!['iat','nbf','exp'].every(k=>Number.isSafeInteger(claims[k]))||claims.iat>time+30||claims.nbf>time+30||claims.exp<=time||claims.iat<time-600||claims.exp-claims.iat>1200)throw Error('Publisher scope rejected');
 return claims;
}
export function validatePublishedSnapshot(data,archive,now){
 const s=verifySnapshot(data);
 if(data.environment!=='ULTON_TEST'||s.token.toLowerCase()!==TOKEN||s.decimals!==18||data.prizesEnabled!==false||data.audit?.prizesEnabled!==false||s.snapshotBlock<96210581||s.snapshotTimestamp>Math.floor(now/1000)+120||!Number.isSafeInteger(s.eligibleWallets)||s.eligibleWallets<s.ranking.length||s.ranking.length!==Math.min(100,s.eligibleWallets))throw Error('Unexpected snapshot scope');
 const a=data.audit;
 const fields=['activeHolders','zeroBalanceAddresses','historicalWallets','eligiblePlainWallets','eligibleDelegatedWallets','excludedActiveContracts','excludedActiveBurnAddresses'];
 if(fields.some(k=>!Number.isSafeInteger(a[k])||a[k]<0)||a.activeHolders+a.zeroBalanceAddresses!==a.historicalWallets||a.eligiblePlainWallets+a.eligibleDelegatedWallets!==s.eligibleWallets||s.eligibleWallets+a.excludedActiveContracts+a.excludedActiveBurnAddresses!==a.activeHolders||!/^0x[0-9a-f]{64}$/.test(a.snapshotBlockHash)||data.blockHash&&data.blockHash!==a.snapshotBlockHash)throw Error('Snapshot audit mismatch');
 if(archive?.eventId!==`25:${TOKEN}:${data.eventStart}`||!/^[0-9a-f]{40}$/.test(archive?.commit||'')||!/^[0-9a-f]{64}$/.test(archive?.snapshotHash||''))throw Error('Missing archive reference');
 if(data.ranking.some(r=>r.address.toLowerCase()==='0x'+'0'.repeat(36)+'dead'||r.address.toLowerCase()==='0x'+'0'.repeat(40)))throw Error('Burn address in ranking');
 return data;
}
async function readBody(request){
 if(Number(request.headers.get('content-length')||0)>MAX_BODY)throw Error('Body too large');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON required');
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('Body too large');}chunks.push(Buffer.from(value));}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function createRoarRelay({store,loadKeys,archiveReader,now=()=>Date.now()}){
 const read=key=>store.getWithMetadata(key,{type:'json',consistency:'strong'});
 async function save(data,archive,publisher){
  const contentHash=snapshotHash(data);
  try{
   for(let tries=0;tries<4;tries++){
    const old=await read('latest');
    if(old){
     const previous=old.data;
     if(data.snapshotBlock<previous.snapshotBlock||data.snapshotTimestamp<previous.snapshotTimestamp)return json({error:'Older snapshot rejected'},409);
     if((data.snapshotBlock===previous.snapshotBlock)!==(data.snapshotTimestamp===previous.snapshotTimestamp))return json({error:'Block timestamp conflict'},409);
     if(data.snapshotBlock===previous.snapshotBlock&&data.snapshotTimestamp===previous.snapshotTimestamp){
      if(contentHash!==previous.publication.contentHash)return json({error:'Conflicting snapshot rejected'},409);
      return json({status:'unchanged',snapshotBlock:data.snapshotBlock,contentHash});
     }
    }
    const immutable=await store.setJSON('snapshots/'+contentHash,data,{onlyIfNew:true});
    if(!immutable.modified){const saved=await read('snapshots/'+contentHash);if(!saved||snapshotHash(saved.data)!==contentHash)throw Error('Stored snapshot mismatch');}
    const publication={contentHash,archiveCommit:archive.commit,snapshotHash:archive.snapshotHash,runId:publisher.run_id,runAttempt:publisher.run_attempt,publishedAt:Math.floor(now()/1000)};
    const result=await store.setJSON('latest',{...data,publication},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    if(result.modified)return json({status:'published',snapshotBlock:data.snapshotBlock,contentHash});
   }
   return json({error:'Concurrent publication; retry'},409);
  }catch{console.warn('Roar archive publication failed');return json({error:'Publication unavailable; previous snapshot retained'},503);}
 }
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/roar/snapshot'&&['GET','HEAD'].includes(request.method)){
   try{
    let row=await read('latest');
    if(archiveReader&&(!row||now()/1000-row.data.publication.publishedAt>=600)){
     let stage='archive-read';
     try{const payload=await archiveReader();stage='snapshot-validation';validatePublishedSnapshot(payload.snapshot,payload.archive,now());stage='archive-publication';await save(payload.snapshot,payload.archive,{run_id:'archive-read',run_attempt:'1'});row=await read('latest')}catch(error){console.warn('Roar refresh failed',stage,/^ARCHIVE_HTTP_\d{3}$/.test(error?.code||'')?error.code:'UNAVAILABLE');/* Never log credentials, headers, response bodies or arbitrary error messages. */}
    }
    if(!row)return json({status:'awaiting-data'},503,{'Retry-After':'60'});
    const etag='"'+row.data.publication.contentHash+'"',headers={'ETag':etag,'Cache-Control':'public,max-age=15','Netlify-CDN-Cache-Control':'public,s-maxage=30,stale-while-revalidate=30','X-Content-Type-Options':'nosniff'};
    if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
    return new Response(request.method==='HEAD'?null:JSON.stringify(row.data),{status:200,headers:{...headers,'Content-Type':'application/json'}});
   }catch{return json({status:'unavailable'},503,{'Retry-After':'60'});}
  }
  if(path!=='/api/roar/publish')return json({error:'Not found'},404);
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
  let publisher;
  try{const auth=request.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))throw Error('No publisher');publisher=await verifyPublisher(auth.slice(7),{loadKeys,now});}catch{return json({error:'Publisher authentication rejected'},401);}
  let body;
  try{body=await readBody(request);validatePublishedSnapshot(body.snapshot,body.archive,now());}catch{return json({error:'Snapshot validation rejected'},422);}
  return save(body.snapshot,body.archive,publisher);
 };
}
