import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {once} from 'node:events';
import {canonicalIP,createClientAddress,createRateLimit} from './client-rate-limit.mjs';
import {createProfileServer} from './server.mjs';
import {createProfiles} from './auth.mjs';
const origin='https://loadthelion.example',address='0x'+'1'.repeat(40),publicPath='/api/profile/'+address;
function req(peer,value){return {socket:{remoteAddress:peer},headers:{'x-forwarded-for':value}}}
test('client and trusted proxy IP aliases canonicalize without accepting ambiguous forms',()=>{
 for(const value of ['198.51.100.1','::ffff:198.51.100.1','0:0:0:0:0:ffff:c633:6401'])assert.equal(canonicalIP(value),'198.51.100.1');
 for(const value of ['2001:db8::1','2001:0DB8:0:0:0:0:0:1'])assert.equal(canonicalIP(value),'2001:db8::1');
 for(const value of [undefined,[],{},'', 'unknown','198.51.100.1, 198.51.100.2','198.51.100.1:80','[2001:db8::1]','fe80::1%eth0','127.000.0.1','127.1','2130706433'])assert.throws(()=>canonicalIP(value));
 assert.equal(createClientAddress('::ffff:127.0.0.1')(req('127.0.0.1','198.51.100.1')),'198.51.100.1');
 for(const config of ['*','127.0.0.0/8','127.0.0.1,','localhost',[],null])assert.throws(()=>createClientAddress(config));
});
test('only configured peers may supply a single overwritten X-Forwarded-For address',()=>{
 for(const forwarded of ['198.51.100.1','garbage','a,b',undefined])assert.equal(createClientAddress()(req('127.0.0.1',forwarded)),'127.0.0.1');
 const trusted=createClientAddress('127.0.0.1,::1');
 for(const value of [undefined,'', '198.51.100.1,198.51.100.2',['198.51.100.1','198.51.100.2'],'fe80::1%eth0'])assert.throws(()=>trusted(req('127.0.0.1',value)));
 assert.equal(trusted(req('198.51.100.9','198.51.100.1')),'198.51.100.9');
});
test('rate-limit boundary preserves forty requests and exact window reset',()=>{
 let now=1000;const limit=createRateLimit({now:()=>now});
 for(let i=0;i<40;i++)assert.equal(limit('a'),0);
 assert.equal(limit('a'),60);assert.equal(limit('b'),0);now+=1001;assert.equal(limit('a'),59);
 now=61000;assert.equal(limit('a'),0);
});
async function setup(t,trustedProxies=''){
 let now=1000;const profiles=createProfiles({origin,filename:':memory:'});
 const server=createProfileServer({origin,profiles,trustedProxies,now:()=>now});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));profiles.close()});
 const call=(path=publicPath,headers={},method='GET',body)=>new Promise((resolve,reject)=>{
  const r=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}))});
  r.on('error',reject);r.end(body);
 });
 return {call,advance:delta=>now+=delta};
}
test('trusted-proxy clients have separate quotas; unknown routes do not exhaust victims',async t=>{
 const {call}=await setup(t,'127.0.0.1'),a={'x-forwarded-for':'198.51.100.1'},b={'x-forwarded-for':'198.51.100.2'};
 for(let i=0;i<45;i++)assert.equal((await call('/api/profile/unknown',a)).status,404);
 for(let i=0;i<40;i++)assert.equal((await call(publicPath,a)).status,200);
 const blocked=await call(publicPath,a);assert.equal(blocked.status,429);assert.equal(blocked.headers['retry-after'],'60');
 assert.equal((await call(publicPath,b)).status,200);
});
test('untrusted forwarding headers cannot evade the default socket quota',async t=>{
 const {call,advance}=await setup(t);
 for(let i=0;i<40;i++)assert.equal((await call(publicPath,{'x-forwarded-for':'198.51.100.'+(i+1),'forwarded':'for=203.0.113.1','x-real-ip':'203.0.113.2'})).status,200);
 const blocked=await call(publicPath,{'x-forwarded-for':'203.0.113.9'});assert.equal(blocked.status,429);
 advance(1001);assert.equal((await call()).headers['retry-after'],'59');advance(58999);assert.equal((await call()).status,200);
});
test('canonical client forms share quota and malformed or duplicate trusted headers are rejected',async t=>{
 const {call}=await setup(t,'::ffff:127.0.0.1');
 for(const value of [undefined,'unknown','198.51.100.1,198.51.100.2',['198.51.100.1','198.51.100.2'],'fe80::1%eth0','198.51.100.1:80']){
  assert.equal((await call(publicPath,value===undefined?{}:{'x-forwarded-for':value})).status,400);
 }
 for(let i=0;i<40;i++)assert.equal((await call(publicPath,{'x-forwarded-for':i%2?'198.51.100.1':'::ffff:c633:6401'})).status,200);
 assert.equal((await call(publicPath,{'x-forwarded-for':'0:0:0:0:0:ffff:c633:6401'})).status,429);
 assert.equal((await call(publicPath,{'x-forwarded-for':'2001:db8::1'})).status,200);
});
test('legitimate public and challenge callers remain available without adding unsupported endpoints',async t=>{
 const {call}=await setup(t,'127.0.0.1'),headers={'x-forwarded-for':'198.51.100.1',origin,'content-type':'application/json'};
 const challenge=await call('/api/profile/challenge',headers,'POST',JSON.stringify({address}));assert.equal(challenge.status,200);assert.match(challenge.headers['set-cookie'][0],/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await call(publicPath,headers)).status,200);assert.equal((await call(publicPath+'/avatar',headers)).status,404);
 assert.equal((await call('/api/profile/challenge',{...headers,origin:'https://evil.example'},'POST','{}')).status,403);
 assert.equal((await call('/api/profile/challenge',headers,'PATCH','{}')).status,405);
 for(const path of ['/api/profile/status','/api/profile/lookup'])assert.equal((await call(path,headers)).status,404);
});
