import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const a=n=>'0x'+n.toString(16).padStart(40,'0'),winner=a(2);
class Element{
 children=[];hidden=false;disabled=false;textContent='';dataset={};listeners={};style={setProperty(){}};classes=new Set();
 classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))};
 set className(v){this.classes=new Set(v.split(' '))}get className(){return [...this.classes].join(' ')}
 addEventListener(name,fn){this.listeners[name]=fn}append(...children){this.children.push(...children)}replaceChildren(...children){this.children=children}setAttribute(){}focus(){}
}
const script=(await build({entryPoints:[new URL('./draw-page.mjs',import.meta.url).pathname],bundle:true,format:'iife',write:false,plugins:[{name:'proof-tested-separately',setup(b){b.onLoad({filter:/draw-proof\.mjs$/},()=>({contents:'export async function verifyPublicDraw(p){return {rank:2,winner:p.draw.winner}}',loader:'js'}))}}]})).outputFiles[0].text;
async function page(viewer){const nodes=new Map(),frames=[];const document={hidden:false,getElementById(id){if(!nodes.has(id)){const e=new Element();if(id==='draw-result')e.hidden=true;nodes.set(id,e)}return nodes.get(id)},querySelector(){return this.getElementById('stage')},createElement(){return new Element()},addEventListener(){}};
 document.getElementById('draw-result');document.getElementById('draw-title');
 const ranking=Array.from({length:100},(_,i)=>({rank:i+1,address:a(i+1)}));
 const fetcher=async url=>{if(url==='/draw-prize.json')return Response.json({eventId:'weekly-test',name:'Loaded Lion test',image:'assets/test-prize.webp'});if(url==='/api/profile/me')return viewer?Response.json({address:viewer,nickname:'My Wallet'}):new Response(null,{status:400});if(url==='/api/profile/lookup')return Response.json({profiles:[]});if(url==='/api/roar/draw')return Response.json({status:'VERIFIED',prizesEnabled:false,plan:{eventId:'weekly-test'},final:{eventStart:1791763200,snapshotTimestamp:1792367999,ranking},draw:{winner,randomness:'a'.repeat(64)},probabilitiesPercent:Array(100).fill(1),onchain:{status:'NOT_REGISTERED'}});throw Error(url)};
 vm.runInNewContext(script,{document,window:{addEventListener(){}},fetch:fetcher,Response,AbortSignal,Date,Intl,console,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>1,clearTimeout(){}});
 await new Promise(r=>setImmediate(r));return {nodes,frames};}
test('all viewers see the same verified winner and shared prize only after the full ascending reveal',async()=>{
 for(const viewer of [winner,a(1),null,a(999)]){
  const p=await page(viewer);assert.equal(p.nodes.get('draw-candidates').children.length,100);assert.equal(p.nodes.get('draw-result').hidden,true);
  const playback=p.nodes.get('draw-play').listeners.click();await new Promise(r=>setImmediate(r));p.frames.shift()(0);p.frames.shift()(43000);assert.equal(p.nodes.get('draw-atlas').children[1].classes.has('winner'),true);assert.equal(p.nodes.get('draw-atlas').children[0].classes.has('active'),false);assert.equal(p.nodes.get('draw-state').textContent,'VINCITORE #002 · CONFERMATO');p.frames.shift()(44999);assert.notEqual(p.nodes.get('draw-kicker').textContent,'THE WINNER');assert.equal(p.nodes.get('draw-result').hidden,true);
  p.frames.shift()(45000);await playback;assert.equal(p.nodes.get('draw-result').hidden,false);assert.equal(p.nodes.get('draw-result').dataset.outcome,'winner');assert.equal(p.nodes.get('draw-wallet').textContent,winner);assert.equal(p.nodes.get('draw-play').disabled,false);
  assert.equal(p.nodes.get('draw-result-title').textContent,'ROOOOAR, 0x0000…0002, YOU WON!!! 🎉🎉🎉');assert.equal(p.nodes.get('draw-prize').hidden,false);assert.equal(p.nodes.get('draw-prize-image').src,'assets/test-prize.webp');
 }
});

test('creator winner preview leaves the verified draw unrevealed and finalist inspection works',async()=>{
 const p=await page(null);const original=p.nodes.get('draw-title').textContent;
 assert.equal(p.nodes.get('draw-studio').hidden,false);
 await p.nodes.get('preview-win').listeners.click();assert.equal(p.nodes.get('draw-preview').hidden,false);assert.equal(p.nodes.get('preview-title').textContent,'ROOOOAR, THE LUCKY LION, YOU WON!!! 🎉🎉🎉');assert.equal(p.nodes.get('draw-result').hidden,true);assert.equal(p.nodes.get('draw-title').textContent,original);
 p.nodes.get('preview-close').listeners.click();assert.equal(p.nodes.get('draw-preview').hidden,true);
 assert.equal(p.nodes.has('preview-loss'),false);assert.equal(p.nodes.has('draw-progress'),false);
 assert.equal(p.nodes.get('draw-atlas').children.length,100);p.nodes.get('draw-atlas').children[99].listeners.click();assert.match(p.nodes.get('draw-inspect').textContent,/#100/);
});
