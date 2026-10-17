import {snapshotHash,TOKEN} from './roar-relay.mjs';
const API='https://api.github.com/repos/bennyE90/loadthelion-indexer';
// Only the public Top 100 is returned to the browser. Credentials and the full
// private ranking stay on the server. Every read is pinned to one archive commit.
export function createArchiveReader({token,fetcher=fetch,now=()=>Date.now(),ttl=300000}){
 let cached=null,expires=0,pending=null;
 async function read(){
  if(typeof token!=='string'||!token)throw Error('Read-only archive connection not configured');
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){const r=await fetcher(API+path,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Private archive read unavailable');return r.json()}
  const ref=await get('/git/ref/heads/roar-test-archive'),commit=ref.object?.sha;
  if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Invalid archive commit');
  const contents=path=>get('/contents/'+path+'?ref='+commit);
  const [snapshot,index]=await Promise.all([contents('latest.json'),contents('index.json')]);
  const eventId=`25:${TOKEN}:${snapshot.eventStart}`;
  if(index.environment!=='ULTON_TEST'||index.prizesEnabled!==false||!Array.isArray(index.events))throw Error('Invalid private archive index');
  const matches=index.events.find(e=>e.id===eventId)?.snapshots.filter(s=>s.kind==='current'&&s.block===snapshot.snapshotBlock&&s.at===snapshot.snapshotTimestamp)||[];
  if(matches.length!==1||!/^[0-9a-f]{64}$/.test(matches[0].hash))throw Error('Current snapshot missing from archive');
  const hash=matches[0].hash,full=await contents('snapshots/'+hash+'.json');
  if(snapshotHash(full)!==hash||full.eventId!==eventId||full.kind!=='current')throw Error('Full snapshot hash mismatch');
  const {allRanking,excludedAddresses,boundary,kind,eventId:unused,schema,...publicData}=full;
  if(snapshotHash({...publicData,schema:1})!==snapshotHash(snapshot))throw Error('Public snapshot differs from archive');
  cached={snapshot,archive:{commit,eventId,snapshotHash:hash}};expires=now()+ttl;return cached;
 }
 return async()=>{
  if(cached&&now()<expires)return cached;
  if(!pending)pending=read().finally(()=>{pending=null});
  return pending;
 };
}
