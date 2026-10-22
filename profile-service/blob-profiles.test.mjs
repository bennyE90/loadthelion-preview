import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import sharp from 'sharp';
import {createBlobProfiles} from './blob-profiles.mjs';
import {createHandler} from './profile-handler.mjs';
const origin='https://loadthelion.example';
function memoryStore(){const map=new Map();let seq=0;return {async getWithMetadata(k){return structuredClone(map.get(k)||null)},async setJSON(k,data,opts={}){const old=map.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return {modified:false};const etag=String(++seq);map.set(k,{data:structuredClone(data),etag});return {modified:true,etag}},async delete(k){map.delete(k)},async *list({prefix}){yield {blobs:[...map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}}}}
function setup(){let now=Date.parse('2026-10-17T07:00:00Z');const p=createBlobProfiles({origin,store:memoryStore(),now:()=>now});return {p,advance:n=>now+=n}}
async function login(p,wallet=Wallet.createRandom()){const c=await p.challenge(wallet.address);return p.login(c.secret,c.message,await wallet.signMessage(c.message))}
test('persistent adapter atomically consumes a challenge across concurrent requests',async()=>{const {p}=setup(),w=Wallet.createRandom(),c=await p.challenge(w.address),sig=await w.signMessage(c.message);const r=await Promise.allSettled([p.login(c.secret,c.message,sig),p.login(c.secret,c.message,sig)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(p.login(c.secret,c.message,sig))});
test('persistent adapter rejects spoofed signer, altered network and expired challenge',async()=>{const {p,advance}=setup(),w=Wallet.createRandom(),c=await p.challenge(w.address);await assert.rejects(p.login(c.secret,c.message,await Wallet.createRandom().signMessage(c.message)));await assert.rejects(p.login(c.secret,c.message.replace('Chain ID: 25','Chain ID: 1'),await w.signMessage(c.message)));advance(300001);await assert.rejects(p.login(c.secret,c.message,await w.signMessage(c.message)))});
test('owner-only edits, safe avatar conversion, deletion and recreation',async()=>{const {p}=setup(),w=Wallet.createRandom(),s=await login(p,w),other=Wallet.createRandom().address;await p.save(s.secret,{nickname:'Milo',address:other});assert.equal(await p.public(other),null);await assert.rejects(p.save(s.secret,{nickname:'<script>'}));await assert.rejects(p.avatar(s.secret,Buffer.from('<svg/>')));await assert.rejects(p.avatar(s.secret,Buffer.alloc(1048577)));const png=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();await p.avatar(s.secret,png);assert.equal((await sharp(await p.image(w.address)).metadata()).format,'webp');await p.remove(s.secret);assert.equal(await p.public(w.address),null);assert.equal(await p.image(w.address),null);await p.save(s.secret,{nickname:'Load'});assert.equal((await p.public(w.address)).nickname,'Load')});
test('persistent session logout, expiry and cleanup',async()=>{const {p,advance}=setup(),s=await login(p);await p.logout(s.secret);await assert.rejects(p.me(s.secret));const t=await login(p);advance(1800001);await assert.rejects(p.me(t.secret));assert.ok(await p.cleanup()>0)});
test('HTTP handler binds origin/cookies, denies CSRF, enforces body limits and owner authorization',async()=>{const {p}=setup(),handler=createHandler({profiles:p,origin}),w=Wallet.createRandom();
 const request=(path,{method='GET',body,headers={}}={})=>handler(new Request(origin+'/api/profile/'+path,{method,body,headers}));
 const h={origin,'content-type':'application/json'};
 assert.equal((await request('challenge',{method:'POST',headers:{...h,origin:'https://evil.example'},body:JSON.stringify({address:w.address})})).status,403);
 assert.equal((await request('challenge',{method:'POST',headers:h,body:' '.repeat(1100)})).status,400);
 const response=await request('challenge',{method:'POST',headers:h,body:JSON.stringify({address:w.address})});assert.equal(response.status,200);const challengeCookie=response.headers.get('set-cookie');assert.match(challengeCookie,/HttpOnly; Secure; SameSite=Strict/);const {message}=await response.json();
 const logged=await request('login',{method:'POST',headers:{...h,cookie:challengeCookie.split(';')[0]},body:JSON.stringify({message,signature:await w.signMessage(message)})});assert.equal(logged.status,200);const sessionCookie=logged.headers.getSetCookie().find(x=>x.startsWith('__Host-load-session=')).split(';')[0];
 assert.equal((await request('me',{method:'PUT',headers:h,body:JSON.stringify({nickname:'fake'})})).status,400);
 const saved=await request('me',{method:'PUT',headers:{...h,cookie:sessionCookie},body:JSON.stringify({nickname:'Milo'})});assert.equal(saved.status,200);assert.equal((await saved.json()).address,w.address.toLowerCase());assert.equal(saved.headers.get('access-control-allow-origin'),null);
 assert.equal((await handler(new Request('https://evil.example/api/profile/me'))).status,403);
 await request('logout',{method:'POST',headers:{...h,cookie:sessionCookie}});assert.equal((await request('me',{headers:{cookie:sessionCookie}})).status,400);
});
