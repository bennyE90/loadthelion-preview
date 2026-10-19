import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const a=n=>'0x'+n.toString(16).padStart(40,'0'),winner=a(2);
class Element{
 children=[];hidden=false;disabled=false;textContent='';dataset={};listeners={};style={setProperty(){}};classes=new Set();
 classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))};
 set className(v){this.classes=new Set(v.split(' '))}get className(){return [...this.classes].join(' ')}
 addEventListener(name,fn){this.listeners[name]=fn}append(...children){this.children.push(...children)}replaceChildren(...children){this.children=children}setAttribute(){}
}
const script=(await build({entryPoints:[new URL('./draw-page.mjs',import.meta.url).pathname],bundle:true,format:'iife',write:false,plugins:[{name:'proof-tested-separately',setup(b){b.onLoad({filter:/draw-proof\.mjs$/},()=>({contents:'export async function verifyPublicDraw(p){return {rank:2,winner:p.draw.winner}}',loader:'js'}))}}]})).outputFiles[0].text;
async function page(viewer){const nodes=new Map(),frames=[];const document={hidden:false,getElementById(id){if(!nodes.has(id)){const e=new Element();if(id==='draw-result')e.hidden=true;nodes.set(id,e)}return nodes.get(id)},querySelector(){return this.getElementById('stage')},createElement(){return new Element()},addEventListener(){}};
 document.getElementById('draw-result');
 const ranking=Array.from({length:100},(_,i)=>({rank:i+1,address:a(i+1)}));
 const fetcher=async url=>{if(url==='/api/profile/me')return viewer?Response.json({address:viewer,nickname:'My Wallet'}):new Response(null,{status:400});if(url==='/api/profile/lookup')return Response.json({profiles:[]});if(url==='/api/roar/draw')return Response.json({status:'VERIFIED',final:{eventStart:1791763200,snapshotTimestamp:1792367999,ranking},draw:{winner,randomness:'a'.repeat(64)},probabilitiesPercent:Array(100).fill(1),onchain:{status:'NOT_REGISTERED'}});throw Error(url)};
 vm.runInNewContext(script,{document,window:{addEventListener(){}},fetch:fetcher,Response,AbortSignal,Date,Intl,console,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>1,clearTimeout(){}});
 await new Promise(r=>setImmediate(r));return {nodes,frames};}
test('personal win/loss is revealed only after playback; viewers and ineligible wallets are not labelled losers',async()=>{
 for(const [viewer,outcome] of [[winner,'winner'],[a(1),'loser'],[null,'spectator'],[a(999),'not-entered']]){
  const p=await page(viewer);assert.equal(p.nodes.get('draw-candidates').children.length,100);assert.equal(p.nodes.get('draw-result').hidden,true);
  const playback=p.nodes.get('draw-play').listeners.click();await new Promise(r=>setImmediate(r));p.frames.shift()(0);p.frames.shift()(14999);assert.notEqual(p.nodes.get('draw-kicker').textContent,'THE WINNER');assert.equal(p.nodes.get('draw-result').hidden,true);
  p.frames.shift()(15000);await playback;assert.equal(p.nodes.get('draw-result').hidden,false);assert.equal(p.nodes.get('draw-result').dataset.outcome,outcome);assert.equal(p.nodes.get('draw-wallet').textContent,winner);assert.equal(p.nodes.get('draw-play').disabled,false);
  if(outcome==='loser')assert.equal(p.nodes.get('draw-result-message').textContent,'Ritenta, sarai più fortunato.');
  if(outcome==='winner')assert.equal(p.nodes.get('draw-result-title').textContent,'HAI VINTO!');
 }
});
