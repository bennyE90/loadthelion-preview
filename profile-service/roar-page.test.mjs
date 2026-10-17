import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const script=buildSync({stdin:{contents:readFileSync(new URL('./public/roar.js',import.meta.url),'utf8').replace(/(\.mjs)\?v=[^']+/g,'$1'),resolveDir:new URL('../site/',import.meta.url).pathname,loader:'js'},bundle:true,format:'iife',write:false}).outputFiles[0].text;
const snapshot=JSON.parse(readFileSync(new URL('./public/roar-snapshot.json',import.meta.url)));
class Element{
 children=[];style={};dataset={};listeners={};hidden=false;textContent='';
 append(...elements){this.children.push(...elements)}
 replaceChildren(...elements){this.children=elements}
 setAttribute(){}
 addEventListener(name,fn){this.listeners[name]=fn}
 querySelectorAll(){return []}
}
async function page({oddsFailure=false,offline=false}={}){
 const nodes=new Map(),intervals=[],errors=[];let now=(snapshot.eventStart+604800)*1000-1000;
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)},createElement(){return new Element()},addEventListener(){}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const fetcher=async url=>{
  if(url.startsWith('probabilities'))return oddsFailure?new Response(null,{status:503}):Response.json(JSON.parse(readFileSync(new URL('../site/probabilities.json',import.meta.url))));
  if(url==='/api/roar/snapshot'){if(offline)throw Error('offline');return Response.json(snapshot)}
  if(url==='roar-snapshot.json')return Response.json(snapshot);
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
