import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
import {eventEnd} from '../site/roar-calendar.mjs';
import {formatAmount} from '../site/roar-data.mjs';
import {usdValue} from '../site/roar-usd.mjs';
const script=buildSync({stdin:{contents:readFileSync(new URL('./public/roar.js',import.meta.url),'utf8').replace(/(\.mjs)\?v=[^']+/g,'$1'),resolveDir:new URL('../site/',import.meta.url).pathname,loader:'js'},bundle:true,format:'iife',write:false}).outputFiles[0].text;
const snapshot=JSON.parse(readFileSync(new URL('./public/roar-snapshot.json',import.meta.url)));
class Element{
 children=[];style={};dataset={};listeners={};hidden=false;textContent='';
 append(...elements){this.children.push(...elements)}
 replaceChildren(...elements){this.children=elements}
 attributes={};setAttribute(name,value){this.attributes[name]=value}
 addEventListener(name,fn){this.listeners[name]=fn}
 querySelectorAll(selector){return this.children.flatMap(el=>[...(selector==='.roar-usd'&&el.className==='roar-usd'?[el]:[]),...el.querySelectorAll(selector)])}
}
async function page({oddsFailure=false,offline=false,priceFailure=false,dataOverride=null}={}){
 const data=dataOverride||snapshot;
 const nodes=new Map(),intervals=[],errors=[];let now=eventEnd(data.eventStart)*1000-1000;
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)},createElement(){return new Element()},addEventListener(){}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const fetcher=async url=>{
  if(url==='/api/roar/price')return priceFailure?new Response(null,{status:503}):Response.json({status:'ok',chainId:25,token:data.token,pair:'0xa3dc34f3c56157e35bd0e20d8800449dacdda2a5',currency:'USD',source:'DEX Screener',priceUsd:'0.00012345',observedAt:Math.floor(now/1000)});
  if(url.startsWith('probabilities'))return oddsFailure?new Response(null,{status:503}):Response.json(JSON.parse(readFileSync(new URL('../site/probabilities.json',import.meta.url))));
  if(url==='/api/roar/snapshot'){if(offline)throw Error('offline');return Response.json(data)}
  if(url==='roar-snapshot.json')return Response.json(data);
  throw Error('Unexpected request '+url);
 };
 vm.runInNewContext(script,{document,fetch:fetcher,Date:Clock,Intl,AbortSignal,AbortController,console:{error:e=>errors.push(e)},MutationObserver:class{observe(){}},setInterval:(fn,ms)=>{intervals.push({fn,ms});return 1},setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,errors,intervals,advance(ms){now+=ms;intervals.filter(x=>x.ms===1000).forEach(x=>x.fn())}};
}
test('probability service failure leaves verified ranking, timer and pagination working',async()=>{
 const p=await page({oddsFailure:true}),rows=p.nodes.get('roar-rows').children;
 assert.equal(rows.length,100);assert.equal(rows.filter(x=>!x.hidden).length,10);
 assert.equal(rows[0].children.at(-1).textContent,'—');
 assert.match(p.nodes.get('roar-data-status').textContent,/Block/);
 p.nodes.get('roar-show-more').listeners.click();assert.equal(rows.filter(x=>!x.hidden).length,20);
 assert.equal(p.nodes.get('roar-seconds').textContent,'01');
});
test('deadline updates without a network refresh and keeps scores frozen',async()=>{
 const p=await page();p.advance(0);const before=p.nodes.get('roar-rows').children[0].children[4].textContent;
 assert.equal(p.nodes.get('roar-clock-mode').textContent,'ULTON TEST · WEEKLY UTC');
 p.advance(1000);
 assert.equal(p.nodes.get('roar-clock-mode').textContent,'CLOSED · RESULTS PENDING');
 assert.equal(p.nodes.get('roar-seconds').textContent,'00');
 assert.match(p.nodes.get('roar-data-status').textContent,/final results pending verification/);
 assert.equal(p.nodes.get('roar-rows').children[0].children[4].textContent,before);
});
test('first-load API outage displays the saved backup explicitly',async()=>{
 const p=await page({offline:true});
 assert.match(p.nodes.get('roar-data-status').textContent,/Saved backup/);
 assert.equal(p.nodes.get('roar-rows').children.length,100);
});

test('price and holder USD estimates load independently and expire without altering the ranking',async()=>{
 const p=await page(),row=p.nodes.get('roar-rows').children[0];
 assert.equal(row.children[2].children[0].textContent,'≈ '+usdValue(snapshot.ranking[0].balanceRaw,snapshot.decimals,'0.00012345'));
 const points=row.children[4].textContent;
 p.advance(601000);
 assert.equal(row.children[2].children[0].textContent,'— USD');
 assert.equal(row.children[4].textContent,points);
});
test('price outage leaves token quantities, scores and pagination available',async()=>{
 const p=await page({priceFailure:true});
 assert.match(p.nodes.get('roar-price-status').textContent,/Price unavailable/);
 assert.equal(p.nodes.get('roar-rows').children.length,100);
 assert.notEqual(p.nodes.get('roar-rows').children[0].children[4].textContent,'—');
});

test('Roar keeps holder USD estimates but moves the market panel and duplicate explanations out',()=>{
 const html=readFileSync(new URL('./public/roar.html',import.meta.url),'utf8');
 assert(!html.includes('id="roar-token-price"'));
 assert(!html.includes('class="stats"'));
 assert(html.includes('home.html#load-dashboard'));
 assert(html.includes('id="roar-price-status"'));
});

test('calendar leaderboard renders a 250.00% cap, exact 3.5x points and the true month deadline',async()=>{
 const start=Date.parse('2026-11-21T00:00:00Z')/1000;
 const ranking=snapshot.ranking.map(r=>({...r,boostStartedAt:start})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const data={...snapshot,eventStart:start,eventEnd:eventEnd(start),snapshotTimestamp:start+8*86400,ranking,dayStartSnapshot:undefined};
 const p=await page({dataOverride:data});p.advance(0);const row=p.nodes.get('roar-rows').children[0];
 assert.equal(row.children[3].children[0].textContent,'250.00%');assert.equal(row.children[3].children[1].attributes['aria-valuemax'],'250');assert.equal(row.children[3].children[1].children[0].style.width,'100%');
 assert.equal(row.children[4].textContent,formatAmount(BigInt(ranking[0].balanceRaw)*35000n,snapshot.decimals,10000n));assert.match(p.nodes.get('roar-clock-deadline').textContent,/30 NOV 2026/);assert.equal(p.nodes.get('roar-clock-mode').textContent,'ULTON TEST · CALENDAR UTC');
 p.advance(1000);assert.equal(p.nodes.get('roar-clock-mode').textContent,'CLOSED · RESULTS PENDING');
});
