import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Wallet} from 'ethers';
import {createBlobProfiles} from './blob-profiles.mjs';
import {createHandler} from './profile-handler.mjs';
process.env.NODE_ENV='test';
const {getProfileStore,strictBlobFetch}=await import('./blob-store.mjs');
const origin='https://loadthelion.example',address='0x'+'1'.repeat(40),secret='a'.repeat(64);
const digest=value=>createHash('sha256').update(value).digest('hex');
function setup(){
 const rows=new Map([
  ['sessions/'+digest(secret),{data:{address,expires:Date.now()+3600000},etag:'s1'}],
  ['profiles/'+address,{data:{nickname:'Public identity',avatar:Buffer.from('avatar').toString('base64')},etag:'p1'}]
 ]),calls=[];let failure=null,seq=1;
 const transport=async(input,init)=>{
  const url=new URL(input);assert.equal(url.origin,'https://blobs.invalid');
  const method=init.method.toUpperCase(),match=url.pathname.match(/\/(sessions|profiles|challenges)\/(.+)$/);
  if(!match){assert.equal(method,'GET');return Response.json({blobs:[...rows.keys()].filter(key=>key.startsWith(url.searchParams.get('prefix')||'')).map(key=>({key}))})}
  const key=match[1]+'/'+decodeURIComponent(match[2]),old=rows.get(key),headers=new Headers(init.headers);calls.push({method,key});
  if(failure?.method===method&&key.startsWith(failure.prefix))return new Response('Synthetic failure',{status:failure.status});
  if(method==='GET')return old?Response.json(old.data,{headers:{etag:old.etag}}):new Response(null,{status:404});
  if(method==='DELETE'){rows.delete(key);return new Response(null,{status:204})}
  assert.equal(method,'PUT');
  if(headers.get('if-match')&&headers.get('if-match')!==old?.etag||headers.get('if-none-match')==='*'&&old)return new Response(null,{status:412});
  const etag=String(++seq);rows.set(key,{data:JSON.parse(init.body),etag});return new Response(null,{status:200,headers:{etag}});
 };
 const store=getProfileStore({siteID:'synthetic-site',token:'not-a-real-token',edgeURL:'https://blobs.invalid',uncachedEdgeURL:'https://blobs.invalid',fetch:transport});
 const profiles=createBlobProfiles({store,origin}),handler=createHandler({profiles,origin});
 return {rows,calls,store,profiles,handler,fail:(method,prefix,status)=>failure={method,prefix,status},recover:()=>failure=null};
}
test('actual SDK rejects failed profile deletion without acknowledging a public removal',async()=>{
 for(const status of [403,429,500,503]){
  const e=setup();e.fail('PUT','profiles/',status);
  const response=await e.handler(new Request(origin+'/api/profile/me',{method:'DELETE',headers:{origin,cookie:'__Host-load-session='+secret}}));
  assert.equal(response.status,400);assert.equal((await response.json()).ok,undefined);
  assert.equal((await e.profiles.public(address)).nickname,'Public identity');assert.ok(await e.profiles.image(address));
 }
});
test('actual SDK preserves successful deletion, conditional conflicts and ordinary profile recreation',async()=>{
 const e=setup();e.fail('PUT','profiles/',412);await assert.rejects(e.profiles.remove(secret),/Concurrent edit/);
 assert.equal(e.calls.filter(c=>c.method==='PUT').length,4);
 e.recover();await e.profiles.remove(secret);assert.equal(await e.profiles.public(address),null);assert.equal(await e.profiles.image(address),null);
 await e.profiles.save(secret,{nickname:'Recreated'});assert.equal((await e.profiles.public(address)).nickname,'Recreated');
 assert.equal((await e.store.setJSON('profiles/'+address,{}, {onlyIfNew:true})).modified,false);
});
test('actual SDK cannot issue challenges or sessions when their conditional writes fail',async()=>{
 const e=setup(),wallet=Wallet.createRandom();e.fail('PUT','challenges/',403);
 await assert.rejects(e.profiles.challenge(wallet.address),/Blob write failed/);
 e.recover();const challenge=await e.profiles.challenge(wallet.address),signature=await wallet.signMessage(challenge.message);
 e.fail('PUT','challenges/',500);await assert.rejects(e.profiles.login(challenge.secret,challenge.message,signature),/Blob write failed/);
 assert.equal(e.rows.get('challenges/'+digest(challenge.secret)).data.used,false);
 e.fail('PUT','sessions/',429);await assert.rejects(e.profiles.login(challenge.secret,challenge.message,signature),/Blob write failed/);
 assert.equal([...e.rows.keys()].filter(key=>key.startsWith('sessions/')).length,1);
});
test('actual SDK cleanup and logout keep delete failures visible and still succeed on retry',async()=>{
 const e=setup();e.rows.set('challenges/expired',{data:{expires:0},etag:'x'});
 e.fail('DELETE','challenges/',500);await assert.rejects(e.profiles.cleanup());assert.ok(e.rows.has('challenges/expired'));
 e.recover();assert.equal(await e.profiles.cleanup(),1);assert.equal(e.rows.has('challenges/expired'),false);
 e.fail('DELETE','sessions/',403);await assert.rejects(e.profiles.logout(secret));assert.equal((await e.profiles.me(secret)).address,address);
 e.recover();await e.profiles.logout(secret);await assert.rejects(e.profiles.me(secret));
});
test('shared transport handles request-method forms, leaves GET/DELETE to SDK and releases rejected bodies',async()=>{
 for(const status of [400,403,404,409,429,500,503]){
  let cancelled=false;const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status});
  await assert.rejects(strictBlobFetch(new Request('https://blobs.invalid',{method:'PUT'}),undefined,async()=>response),/Blob write failed/);assert.equal(cancelled,true);
 }
 for(const status of [200,201,204,412])assert.equal((await strictBlobFetch('https://blobs.invalid',{method:'put'},async()=>new Response(null,{status}))).status,status);
 for(const method of ['GET','DELETE'])assert.equal((await strictBlobFetch('https://blobs.invalid',{method},async()=>new Response(null,{status:404}))).status,404);
});

test('profile write guard preserves SDK Retry-After reset timing and nonretryable failures',async()=>{
 let attempts=0,firstAt=0,retryAt=0;
 const store=getProfileStore({siteID:'synthetic-site',token:'not-a-real-token',edgeURL:'https://blobs.invalid',uncachedEdgeURL:'https://blobs.invalid',fetch:async()=>{
  attempts++;
  if(attempts===1){firstAt=Date.now();return new Response(null,{status:429,headers:{'X-RateLimit-Reset':String(Math.ceil((firstAt+1100)/1000))}})}
  retryAt=Date.now();return new Response(null,{status:200,headers:{etag:'saved'}});
 }});
 assert.equal((await store.setJSON('profiles/retry',{nickname:'Retry'},{onlyIfNew:true})).modified,true);
 assert.equal(attempts,2);assert.ok(retryAt-firstAt>=1000,'provider reset must delay retry');
 const e=setup();e.fail('PUT','profiles/',403);await assert.rejects(e.profiles.remove(secret),/Blob write failed/);
 assert.equal(e.calls.filter(c=>c.method==='PUT').length,1,'403 preserves SDK nonretryable semantics');
});
test('concurrent binary and JSON conditional writes cannot exchange success state',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const store=getProfileStore({siteID:'synthetic-site',token:'not-a-real-token',edgeURL:'https://blobs.invalid',uncachedEdgeURL:'https://blobs.invalid',fetch:async input=>{
  if(String(input).endsWith('/bad')){await pending;return new Response(null,{status:403})}
  release();return new Response(null,{status:200,headers:{etag:'good'}});
 }});
 const results=await Promise.allSettled([store.set('bad','bytes',{onlyIfNew:true}),store.setJSON('good',{ok:true},{onlyIfNew:true})]);
 assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');assert.equal(results[1].value.modified,true);
});
