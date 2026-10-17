import test from 'node:test';
import assert from 'node:assert/strict';
import {createPriceService,parseMarketQuote,PRICE_TOKEN,PRICE_POOL,PRICE_URL} from './roar-price.mjs';
import {validatePrice,usdValue} from '../site/roar-usd.mjs';
const data=()=>({pairs:[{chainId:'cronos',pairAddress:PRICE_POOL,baseToken:{address:PRICE_TOKEN},priceUsd:'0.00012345'}]});
const request=()=>new Request('https://example.invalid/api/roar/price');
test('quotes are bound to the exact Cronos pool and base token',()=>{
 assert.equal(parseMarketQuote(data(),100).priceUsd,'0.00012345');
 for(const change of [{chainId:'ethereum'},{pairAddress:PRICE_TOKEN},{baseToken:{address:PRICE_POOL}},{priceUsd:'0'},{priceUsd:'NaN'},{priceUsd:'-1'},{priceUsd:null}])assert.throws(()=>parseMarketQuote({pairs:[{...data().pairs[0],...change}]},100));
});
test('USD conversion uses the real balance without boost and preserves large integers',()=>{
 assert.equal(usdValue('1000000000000000000000',18,'0.00012345'),'$0.12');
 assert.equal(usdValue('999999999999999999999999999999999999',18,'1'),'$1,000,000,000,000,000,000.00');
 assert.equal(usdValue('1',18,'0.00012345'),'<$0.01');
 assert.equal(usdValue('0',18,'1'),'$0.00');
 assert.equal(usdValue('1005',3,'1'),'$1.01');
});
test('provider reads are coalesced and cached; failed checks retain original time then expire',async()=>{
 let time=1000000,calls=0,fail=false;
 const service=createPriceService({now:()=>time,fetcher:async url=>{assert.equal(url,PRICE_URL);calls++;if(fail)throw Error('offline');return Response.json(data())}});
 const results=await Promise.all([service(request()),service(request())]);assert.equal(calls,1);
 assert.equal((await results[0].json()).observedAt,1000);await service(request());assert.equal(calls,1);
 time+=121000;fail=true;let q=await (await service(request())).json();assert.equal(q.status,'stale');assert.equal(q.observedAt,1000);
 validatePrice(q,1121);time+=600000;assert.equal((await service(request())).status,503);
 assert.equal((await service(new Request(request(),{method:'POST'}))).status,405);
});
test('invalid or stale prices are hidden and first-load failure does not fabricate zero',async()=>{
 const service=createPriceService({fetcher:async()=>new Response(null,{status:429})});
 assert.equal((await service(request())).status,503);
 const q={...parseMarketQuote(data(),1000),status:'ok'};validatePrice(q,1000);
 for(const bad of [{...q,observedAt:0},{...q,observedAt:2000},{...q,token:PRICE_POOL},{...q,priceUsd:'0'}])assert.throws(()=>validatePrice(bad,1000));
});
