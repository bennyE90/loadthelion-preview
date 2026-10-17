import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import vm from 'node:vm';
import {MARKET} from '../site/market-config.mjs';
const script=buildSync({entryPoints:[new URL('../site/dashboard.js',import.meta.url).pathname],bundle:true,format:'iife',write:false}).outputFiles[0].text;
async function page({missing=false,offline=false}={}){
 let now=1792240763000;const nodes=new Map(),ticks=[];
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
 const quote={chainId:MARKET.chainId,token:MARKET.token,pair:MARKET.pair,currency:'USD',source:'DEX Screener',status:'ok',observedAt:now/1000,priceUsd:'0.0002690',marketCapUsd:123456,fdvUsd:234567,liquidityUsd:10000,volume24hUsd:250,change24h:-3.25,buys24h:5,sells24h:7};
 if(missing){quote.marketCapUsd=null;quote.fdvUsd=null;quote.change24h=null}
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',className:''});return nodes.get(id)},addEventListener(){}};
 vm.runInNewContext(script,{document,Date:Clock,Intl,AbortSignal,fetch:async()=>offline?new Response(null,{status:503}):Response.json(quote),setInterval:(fn,ms)=>ticks.push({fn,ms})});
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,advance(ms){now+=ms;ticks.filter(x=>x.ms===1000).forEach(x=>x.fn())}};
}
test('dashboard presents price, independent market metrics and the exact token links',async()=>{
 const p=await page();assert.equal(p.nodes.get('market-price').textContent,'$0.0002690');assert.equal(p.nodes.get('market-cap').textContent,'$123,456');assert.equal(p.nodes.get('market-fdv').textContent,'$234,567');assert.equal(p.nodes.get('market-change').textContent,'-3.25%');assert.equal(p.nodes.get('market-change').className,'negative');assert.equal(p.nodes.get('market-trades').textContent,'5 / 7');assert.equal(p.nodes.get('market-contract').textContent,MARKET.token);assert(p.nodes.get('market-chart').href.endsWith(MARKET.pair));
});
test('missing values stay blank, and old prices and metrics expire together',async()=>{
 const p=await page({missing:true});assert.equal(p.nodes.get('market-cap').textContent,'—');assert.equal(p.nodes.get('market-change').textContent,'—');p.advance(601000);for(const id of ['market-price','market-liquidity','market-volume','market-trades'])assert.equal(p.nodes.get(id).textContent,'—');
});
test('market outages preserve the configured contract but never create prices',async()=>{
 const p=await page({offline:true});assert.equal(p.nodes.get('market-price').textContent,'—');assert.match(p.nodes.get('market-status').textContent,/unavailable/);assert.equal(p.nodes.get('market-contract').textContent,MARKET.token);
});
