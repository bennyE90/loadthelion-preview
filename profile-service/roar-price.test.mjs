import test from 'node:test';
import assert from 'node:assert/strict';
import {createPriceService,parseMarketQuote,PRICE_TOKEN,PRICE_POOL,PRICE_URL} from './roar-price.mjs';
import {validatePrice,usdValue} from '../site/roar-usd.mjs';
const data=()=>({pairs:[{chainId:'cronos',pairAddress:PRICE_POOL,baseToken:{address:PRICE_TOKEN},priceUsd:'0.00012345'}]});
const request=()=>new Request('https://example.invalid/api/roar/price');
test('market metrics preserve missing fields and distinguish market cap from FDV',()=>{
 const input=data();Object.assign(input.pairs[0],{marketCap:123,fdv:456,liquidity:{usd:789},volume:{h24:10},priceChange:{h24:-2.5},txns:{h24:{buys:4,sells:8}}});
 const q=parseMarketQuote(input,100);assert.equal(q.marketCapUsd,123);assert.equal(q.fdvUsd,456);assert.equal(q.change24h,-2.5);assert.equal(q.buys24h,4);
 const absent=parseMarketQuote(data(),100);assert.equal(absent.marketCapUsd,null);assert.equal(absent.liquidityUsd,null);
 Object.assign(input.pairs[0],{marketCap:-1,fdv:Infinity,txns:{h24:{buys:1.5,sells:-1}}});const invalid=parseMarketQuote(input,100);assert.equal(invalid.marketCapUsd,null);assert.equal(invalid.fdvUsd,null);assert.equal(invalid.buys24h,null);
});
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
