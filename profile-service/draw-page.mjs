import {verifyPublicDraw,wheelStop,units,BEACON} from './draw-proof.mjs';
const $=id=>document.getElementById(id),svg=$('draw-wheel'),NS='http://www.w3.org/2000/svg';
let evidence=null,verified=null,playing=false,rotation=0;
const short=a=>a.slice(0,6)+'…'+a.slice(-4);
function node(name,attrs,text){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e}
function paint(weights){
 svg.replaceChildren();const sum=weights.reduce((a,b)=>a+b,0n);let angle=0;
 for(let i=0;i<weights.length;i++){
  const size=Number(weights[i])*360/Number(sum),start=(angle-90)*Math.PI/180,end=(angle+size-90)*Math.PI/180;
  const a=[300+286*Math.cos(start),300+286*Math.sin(start)],b=[300+286*Math.cos(end),300+286*Math.sin(end)];
  const path=node('path',{d:`M300 300 L${a[0]} ${a[1]} A286 286 0 ${size>180?1:0} 1 ${b[0]} ${b[1]} Z`,fill:i<3?['#e4b46d','#b93049','#d08c5b'][i]:i%2?'#3b1423':'#792239',stroke:'#09070b','stroke-width':'.7'});svg.append(path);
  if(i<10||i%5===0){const middle=angle+size/2,r=(middle-90)*Math.PI/180;svg.append(node('text',{x:300+250*Math.cos(r),y:300+250*Math.sin(r),fill:i<3?'#160b10':'#f7e4d0','font-size':i<10?12:8,'font-weight':'800','text-anchor':'middle','dominant-baseline':'middle',transform:`rotate(${middle},${300+250*Math.cos(r)},${300+250*Math.sin(r)})`},String(i+1).padStart(2,'0')))}
  angle+=size;
 }
 svg.append(node('circle',{cx:300,cy:300,r:287,fill:'none',stroke:'#d9af6e','stroke-width':2}));
}
paint(Array.from({length:100},()=>1n));
async function load(){
 try{
  const response=await fetch('/api/roar/draw',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Proof unavailable');const p=await response.json();
  if(p.status==='PENDING'){$('draw-title').textContent='AWAITING THE FINAL ROAR';$('draw-verification').textContent='No verified closed-event draw yet';$('draw-play').textContent='RESULTS PENDING';return}
  const result=await verifyPublicDraw(p);evidence=p;verified=result;
  paint(result.weights);
  const first=new Date(p.final.eventStart*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}),last=new Date(p.final.snapshotTimestamp*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  $('draw-event').textContent=`CLOSED EVENT · ${first} — ${last} · UTC`;
  $('draw-verification').textContent='SIGNATURE & WEIGHTED RESULT VERIFIED';
  $('draw-play').disabled=false;$('draw-play').textContent='WATCH THE FINAL ROAR';
  $('proof-cutoff').textContent=`Final cutoff: ${new Date(p.final.snapshotTimestamp*1000).toISOString().replace('T',' ').replace('.000Z',' UTC')}. No later transactions enter this result.`;
  $('proof-block').textContent='FINAL BLOCK '+p.final.snapshotBlock.toLocaleString('en-US');
  $('proof-round').textContent='SIGNED ROUND '+result.round.toLocaleString('en-US');
  $('proof-hash').textContent=p.final.snapshotHash;$('proof-weights').textContent=p.plan.weightsHash;
  $('proof-beacon').href=`https://api.drand.sh/${BEACON.hash}/public/${result.round}`;
  $('draw-download').disabled=false;
  for(const [i,row] of p.final.ranking.entries()){
   const line=document.createElement('div');line.className='candidate';
   const name=document.createElement('span');name.textContent='#'+String(row.rank).padStart(3,'0')+' '+short(row.address);name.title=row.address;
   const chance=document.createElement('b');chance.textContent=new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(p.probabilitiesPercent[i])+'%';line.append(name,chance);$('draw-candidates').append(line);
  }
 }catch{$('draw-title').textContent='REVEAL PAUSED';$('draw-verification').textContent='Proof could not be verified';$('draw-description').textContent='A missing or invalid proof blocks playback. No replacement winner is generated.';$('draw-play').textContent='VERIFICATION REQUIRED';$('draw-state').textContent='Reload to retry verification.'}
}
function visible(){if(!document.hidden)return Promise.resolve();return new Promise(resolve=>{const check=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',check);resolve()}};document.addEventListener('visibilitychange',check)})}
async function play(){
 if(!verified||playing)return;playing=true;$('draw-play').disabled=true;$('draw-winner').hidden=true;
 $('draw-title').textContent='THE PRIDE IS WATCHING';$('draw-description').textContent='100 finalists. Approved weighted chances. One signed result.';$('draw-state').textContent='Replaying the verified draw…';$('hub-top').textContent='THE FINAL';$('hub-main').textContent='ROAR';$('hub-bottom').textContent='REVEAL IN PROGRESS';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?3000:14500;
 const stop=(360-wheelStop(verified.weights,verified.rank))%360;
 const target=Math.floor(rotation/360)*360+360*9+stop,start=rotation;
 try{
  const animation=svg.animate(reduced?[{opacity:.55},{opacity:1}]:[{transform:`rotate(${start}deg)`},{transform:`rotate(${target}deg)`}],{duration,easing:'cubic-bezier(.12,.72,.08,1)',fill:'forwards'});
  const progress=$('draw-progress').animate([{width:'0%'},{width:'100%'}],{duration,fill:'forwards'});
  await animation.finished;await visible();rotation=target;svg.style.transform=`rotate(${rotation}deg)`;animation.cancel();progress.cancel();$('draw-progress').style.width='100%';
  $('winner-name').textContent='Holder '+String(verified.rank).padStart(3,'0');$('winner-address').textContent=verified.winner;$('winner-address').href='https://explorer.cronos.org/address/'+verified.winner;
  $('winner-rank').textContent='FINAL RANK #'+String(verified.rank).padStart(3,'0')+' · '+new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(evidence.probabilitiesPercent[verified.rank-1])+'% CHANCE';
  $('draw-title').textContent='THE ROAR HAS CHOSEN';$('draw-description').textContent='The archived result is confirmed. Ownership verification is still required before any future real award.';$('draw-winner').hidden=false;
  $('hub-top').textContent='FINAL RANK';$('hub-main').textContent='#'+verified.rank;$('hub-bottom').textContent='VERIFIED TEST WINNER';
  $('draw-state').textContent='Verified test winner revealed. No prize has been transferred.';$('draw-play').textContent='REPLAY THE SAME DRAW';
 }catch{$('draw-state').textContent='Playback interrupted. The verified result has not changed.';$('draw-play').textContent='REPLAY THE SAME DRAW'}finally{playing=false;$('draw-play').disabled=false}
}
$('draw-play').addEventListener('click',play);
$('draw-download').addEventListener('click',()=>{if(!evidence)return;const blob=new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LoadTheLion-ULTON-draw-'+evidence.final.eventStart+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
load();
