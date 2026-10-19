import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
import {eventEnd} from '../site/roar-calendar.mjs';
import {formatAmount} from '../site/roar-data.mjs';
import {previewRows,PREVIEW_START,PREVIEW_END} from '../site/roar-preview.mjs';
import {usdValue} from '../site/roar-usd.mjs';
const script=buildSync({stdin:{contents:readFileSync(new URL('./public/roar.js',import.meta.url),'utf8').replace(/(\.mjs)\?v=[^']+/g,'$1'),resolveDir:new URL('../site/',import.meta.url).pathname,loader:'js'},bundle:true,format:'iife',write:false}).outputFiles[0].text;
const snapshot=JSON.parse(readFileSync(new URL('./public/roar-snapshot.json',import.meta.url)));
class Element{
 children=[];style={};dataset={};listeners={};hidden=false;textContent='';
 constructor(tag='span'){this.tagName=tag}
 append(...elements){for(const el of elements){el.parentElement=this;this.children.push(el)}}
 replaceChildren(...elements){this.children=[];this.append(...elements)}
 attributes={};setAttribute(name,value){this.attributes[name]=value}
 addEventListener(name,fn){this.listeners[name]=fn}
 matches(selector){return selector==='img'?this.tagName==='img':selector==='.roar-name[title]'?this.className==='roar-name'&&!!this.title:(this.className||'').split(' ').includes(selector.slice(1))}
 querySelectorAll(selector){return this.children.flatMap(el=>[...(el.matches(selector)?[el]:[]),...el.querySelectorAll(selector)])}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null}
 contains(el){return this===el||this.children.some(child=>child.contains(el))}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(el=>el!==this)}
 scrollIntoView(){}
}
async function page({oddsFailure=false,offline=false,priceFailure=false,dataOverride=null,rewardsFinal=null,nowOverride=null,previewPayload=null,profiles=[],profilesFailure=false}={}){
 const data=dataOverride||snapshot;
 const nodes=new Map(),intervals=[],errors=[];let now=nowOverride??(eventEnd(data.eventStart)*1000-1000);
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)},createElement(tag){return new Element(tag)},addEventListener(){}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const fetcher=async url=>{
  if(url==='/api/profile/lookup')return profilesFailure?new Response(null,{status:503}):Response.json({profiles});
  if(url==='/api/roar/price')return priceFailure?new Response(null,{status:503}):Response.json({status:'ok',chainId:25,token:data.token,pair:'0xa3dc34f3c56157e35bd0e20d8800449dacdda2a5',currency:'USD',source:'DEX Screener',priceUsd:'0.00012345',observedAt:Math.floor(now/1000)});
  if(url.startsWith('probabilities'))return oddsFailure?new Response(null,{status:503}):Response.json(JSON.parse(readFileSync(new URL('../site/probabilities.json',import.meta.url))));
  if(url.startsWith('/api/roar/rewards?'))return Response.json(rewardsFinal||{status:'PENDING'});
  if(url==='/api/roar/preview')return previewPayload?Response.json(previewPayload):new Response(null,{status:503});
  if(url==='/api/roar/snapshot'){if(offline)throw Error('offline');return Response.json(data)}
  if(url==='roar-snapshot.json')return Response.json(data);
  throw Error('Unexpected request '+url);
 };
 vm.runInNewContext(script,{document,fetch:fetcher,Date:Clock,Intl,AbortSignal,AbortController,console:{error:e=>errors.push(e)},MutationObserver:class{observe(){}},matchMedia:()=>({matches:true}),setInterval:(fn,ms)=>{intervals.push({fn,ms});return 1},setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,errors,intervals,advance(ms){now+=ms;intervals.filter(x=>x.ms===1000).forEach(x=>x.fn())}};
}
test('probability service failure leaves verified ranking, timer and pagination working',async()=>{
 const p=await page({oddsFailure:true}),rows=p.nodes.get('roar-rows').children;
 assert.equal(rows.length,100);assert.equal(rows.filter(x=>!x.hidden).length,25);
 assert.equal(rows[0].children[6].textContent,'—');
 assert.equal(rows[0].children[7].children[0].textContent,'—');
 assert.match(p.nodes.get('roar-data-status').textContent,/Block/);
 p.nodes.get('roar-show-more').listeners.click();assert.equal(rows.filter(x=>!x.hidden).length,100);
 assert.equal(p.nodes.get('roar-seconds').textContent,'01');
});
test('deadline updates without a network refresh and keeps scores frozen',async()=>{
 const p=await page();p.advance(0);const before=p.nodes.get('roar-rows').children[0].children[5].textContent;
 assert.equal(p.nodes.get('roar-clock-mode').textContent,'ULTON TEST · WEEKLY UTC');
 p.advance(1000);
 assert.equal(p.nodes.get('roar-clock-mode').textContent,'CLOSED · RESULTS PENDING');
 assert.equal(p.nodes.get('roar-seconds').textContent,'00');
 assert.match(p.nodes.get('roar-data-status').textContent,/final results pending verification/);
 assert.equal(p.nodes.get('roar-rows').children[0].children[5].textContent,before);
});
test('first-load API outage displays the saved backup explicitly',async()=>{
 const p=await page({offline:true});
 assert.match(p.nodes.get('roar-data-status').textContent,/Saved backup/);
 assert.equal(p.nodes.get('roar-rows').children.length,100);
});

test('price and holder USD estimates load independently and expire without altering the ranking',async()=>{
 const p=await page(),row=p.nodes.get('roar-rows').children[0];
 assert.equal(row.children[3].children[0].textContent,'≈ '+usdValue(snapshot.ranking[0].balanceRaw,snapshot.decimals,'0.00012345'));
 const points=row.children[5].textContent;
 p.advance(601000);
 assert.equal(row.children[3].children[0].textContent,'— USD');
 assert.equal(row.children[5].textContent,points);
});
test('price outage leaves token quantities, scores and pagination available',async()=>{
 const p=await page({priceFailure:true});
 assert.match(p.nodes.get('roar-price-status').textContent,/Price unavailable/);
 assert.equal(p.nodes.get('roar-rows').children.length,100);
 assert.notEqual(p.nodes.get('roar-rows').children[0].children[5].textContent,'—');
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
 const ranking=snapshot.ranking.map(r=>({...r,boostStartedAt:start})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const data={...snapshot,eventStart:start,eventEnd:eventEnd(start),snapshotTimestamp:start+8*86400,ranking,dayStartSnapshot:undefined};
 const p=await page({dataOverride:data});p.advance(0);const row=p.nodes.get('roar-rows').children[0];
 assert.equal(row.children[4].children[0].textContent,'250.00%');assert.equal(row.children[4].children[1].attributes['aria-valuemax'],'250');assert.equal(row.children[4].children[1].children[0].style.width,'100%');
 assert.equal(row.children[5].textContent,formatAmount(BigInt(ranking[0].balanceRaw)*35000n,snapshot.decimals,10000n));assert.match(p.nodes.get('roar-clock-deadline').textContent,/30 NOV 2026/);assert.equal(p.nodes.get('roar-clock-mode').textContent,'ULTON TEST · CALENDAR UTC');
 p.advance(1000);assert.equal(p.nodes.get('roar-clock-mode').textContent,'CLOSED · RESULTS PENDING');
});

test('live rewards release alongside chance and remain pending at deadline, without a fabricated final payout',async()=>{
 const start=1792368000,ranking=snapshot.ranking.map(r=>({...r,boostStartedAt:null})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const p=await page({nowOverride:1792454400000-1000,dataOverride:{...snapshot,eventStart:start,eventEnd:eventEnd(start),snapshotTimestamp:start+3600,ranking,dayStartSnapshot:undefined}}),row=p.nodes.get('roar-rows').children[0];p.advance(0);
 assert.equal(row.children.length,8);assert.equal(row.children[6].textContent,'5.00%');
 assert.match(row.children[7].children[0].textContent,/ULTON/);assert.match(row.children[7].children[1].textContent,/≈ \$/);
 assert.equal(row.children[7].children[2].textContent,'ESTIMATED SHARE');
 assert.match(p.nodes.get('roar-pool-percent').textContent,/99.99\/100%/);
 p.advance(1000);assert.equal(p.nodes.get('roar-pool-percent').textContent,'100.00/100%');
 assert.equal(row.children[7].children[0].textContent,'—');assert.equal(row.children[7].children[2].textContent,'PREVIEW COMPLETE');
 assert.match(p.nodes.get('roar-pool-status').textContent,/SIMULATION COMPLETE/);
});

test('only a verified final snapshot replaces the live ranking and fixes the simulated reward shares',async()=>{
 const full=JSON.parse(readFileSync(new URL('./fixtures/roar-draw-real.json',import.meta.url))).full,start=Date.parse('2026-11-21T00:00:00Z')/1000,end=eventEnd(start);
 const ranking=full.ranking.map(r=>({...r,boostStartedAt:null})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const data={...snapshot,eventStart:start,eventEnd:end,snapshotTimestamp:start+86400,ranking,dayStartSnapshot:undefined};
 const boundary=structuredClone(full.boundary);boundary.block.timestamp='0x'+(end-1).toString(16);boundary.nextBlock.timestamp='0x'+end.toString(16);
 const final={...data,snapshotTimestamp:end-1,snapshotBlock:full.snapshotBlock+1000000,blockHash:full.blockHash,prizesEnabled:false};
 boundary.block.number='0x'+final.snapshotBlock.toString(16);boundary.nextBlock.number='0x'+(final.snapshotBlock+1).toString(16);boundary.safeHead=final.snapshotBlock+101;
 const payload={schema:1,eventStart:start,status:'FINAL',environment:'ULTON_TEST',prizesEnabled:false,archiveCommit:'a'.repeat(40),snapshotHash:'b'.repeat(64),boundary,snapshot:final};
 const p=await page({dataOverride:data,rewardsFinal:payload});p.advance(1000);await new Promise(resolve=>setImmediate(resolve));
 const row=p.nodes.get('roar-rows').children[0];assert.equal(row.children[7].children[0].textContent,'50,000 ULTON');assert.equal(row.children[7].children[2].textContent,'FINAL · TEST ALLOCATION');
 assert.match(p.nodes.get('roar-pool-status').textContent,/FINAL ALLOCATION VERIFIED/);p.advance(0);assert.equal(p.nodes.get('roar-clock-mode').textContent,'CLOSED · RESULTS VERIFIED');
 p.intervals.find(i=>i.ms===300000).fn();await new Promise(resolve=>setImmediate(resolve));assert.equal(p.nodes.get('roar-rows').children[0],row);
});

test('live preview renders maximum boost, matching points/rank, the simulated deadline and a filling percentage-only pool',async()=>{
 const start=1792368000,ranking=snapshot.ranking.map(r=>({...r,boostStartedAt:start})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const data={...snapshot,eventStart:start,snapshotTimestamp:start+3600,ranking,dayStartSnapshot:undefined};
 const payload={schema:1,status:'SIMULATED',prizesEnabled:false,start:PREVIEW_START,end:PREVIEW_END,source:data,ranking:previewRows(data,ranking).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:start}))};
 const p=await page({dataOverride:data,previewPayload:payload,nowOverride:(start+4*3600)*1000});p.advance(0);const row=p.nodes.get('roar-rows').children[0];
 assert.equal(row.children[4].children[0].textContent,'250.00%');assert.equal(row.children[5].textContent,formatAmount(BigInt(ranking[0].balanceRaw)*35000n,18,10000n));
 assert.equal(p.nodes.get('roar-pool-percent').textContent,'91.66/100%');assert.equal(p.nodes.get('roar-pool-fill').style.width,'91.66%');assert.equal(p.nodes.get('roar-pool-meter').attributes['aria-valuenow'],'91.66');
 assert.match(p.nodes.get('roar-clock-deadline').textContent,/19 OCT 2026/);assert.equal(p.nodes.get('roar-clock-mode').textContent,'ULTON TEST · SIMULATED EVENT');
 assert.match(p.nodes.get('roar-legend').textContent,/Opening holders are assumed/);
 const html=readFileSync(new URL('./public/roar.html',import.meta.url),'utf8');assert.match(html,/roar-page-title">TOP 100 <em>ROAR/);assert(!html.includes('id="roar-pool-total"'));assert(!html.includes('id="roar-pool-remaining"'));assert(!html.includes('id="roar-pool-emitted"'));
});

test('PFP occupies its own column and loads the profile Settings avatar with a safe fallback',async()=>{
 const address=snapshot.ranking[0].address,p=await page({profiles:[{address,nickname:'MILO',hasAvatar:true}]}),row=p.nodes.get('roar-rows').children[0],pfp=row.children[1],name=row.children[2];
 assert.equal(pfp.className,'roar-pfp');assert.equal(name.querySelector('.roar-nickname').textContent,'MILO');
 const image=pfp.querySelector('img');assert(image);assert.equal(image.src,'/api/profile/'+address.toLowerCase()+'/avatar');assert.equal(pfp.attributes['aria-label'],'Profile picture for MILO');
 assert.equal(name.querySelector('img'),null);image.listeners.error();assert.equal(pfp.querySelector('img'),null);assert.equal(pfp.children.length,1);assert.equal(pfp.attributes['aria-label'],'Profile picture not set');
 const offline=await page({profilesFailure:true});assert.equal(offline.nodes.get('roar-rows').children[0].children[1].querySelector('img'),null);assert.equal(offline.nodes.get('roar-rows').children.filter(r=>!r.hidden).length,25);
});
test('25 positions open by default, both full-view controls expose all 100, and collapse returns to 25',async()=>{
 const p=await page(),rows=p.nodes.get('roar-rows').children,toggle=p.nodes.get('roar-view-all');
 assert.equal(rows.filter(r=>!r.hidden).length,25);assert.equal(toggle.textContent,'SHOW ALL 100');toggle.listeners.click();assert.equal(rows.filter(r=>!r.hidden).length,100);assert.equal(toggle.attributes['aria-expanded'],'true');
 p.nodes.get('roar-show-less').listeners.click();assert.equal(rows.filter(r=>!r.hidden).length,25);assert.equal(toggle.attributes['aria-expanded'],'false');p.nodes.get('roar-show-more').listeners.click();assert.equal(rows.filter(r=>!r.hidden).length,100);
 const html=readFileSync(new URL('./public/roar.html',import.meta.url),'utf8');assert(html.includes('<span>PFP</span>'));assert(html.includes('EVENT RULES &amp; LIVE DATA'));assert(!html.includes('THE FINAL ROAR · CLOSED EVENT REPLAY'));
});

test('simulated leaderboard displays green up and red down arrows against yesterday closing balances',async()=>{
 const start=1792368000,ranking=snapshot.ranking.map(r=>({...r,boostStartedAt:start})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const data={...snapshot,eventStart:start,snapshotTimestamp:start+3600,ranking,dayStartSnapshot:undefined};
 const original=ranking.map((r,i)=>({...r,balanceRaw:i===0?ranking[1].balanceRaw:i===1?ranking[0].balanceRaw:r.balanceRaw})).sort((a,b)=>BigInt(a.balanceRaw)===BigInt(b.balanceRaw)?a.address.localeCompare(b.address):BigInt(a.balanceRaw)>BigInt(b.balanceRaw)?-1:1).map((r,i)=>({...r,rank:i+1}));
 const block=data.snapshotBlock-1,blockHash='0x'+'d'.repeat(64),source={...data,snapshotTimestamp:start,snapshotBlock:block,blockHash,ranking:original,prizesEnabled:false};
 const baseline={source,comparisonTimestamp:start,snapshotHash:'e'.repeat(64),ranking:previewRows(source,original).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:start})),boundary:{block:{number:block,timestamp:start-1,hash:blockHash},nextBlock:{number:block+1,timestamp:start,parentHash:blockHash},safeHead:data.snapshotBlock}};
 const previewPayload={schema:1,status:'SIMULATED',prizesEnabled:false,start:PREVIEW_START,end:PREVIEW_END,source:data,ranking:previewRows(data,ranking).map(r=>({rank:r.rank,address:r.address,balanceRaw:r.balanceRaw,sourceBoostStartedAt:start})),baseline};
 const p=await page({dataOverride:data,previewPayload,nowOverride:(start+4*3600)*1000}),rows=p.nodes.get('roar-rows').children;
 assert.equal(rows[0].children[0].children[0].textContent,'↑1');assert.match(rows[0].children[0].children[0].className,/up/);
 assert.equal(rows[1].children[0].children[0].textContent,'↓1');assert.match(rows[1].children[0].children[0].className,/down/);assert.equal(rows[2].children[0].children[0].textContent,'—');
 p.nodes.get('roar-view-all').listeners.click();assert.equal(rows[0].children[0].children[0].textContent,'↑1');
});
