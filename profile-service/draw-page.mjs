import {verifyPublicDraw} from './draw-proof.mjs';
import {participantName,revealFrame,chainReceiptUrl} from './draw-grid-model.mjs';
const $=id=>document.getElementById(id),cards=[],names=[];
let evidence=null,verified=null,playing=false,active=-1;
const short=a=>a.slice(0,6)+'…'+a.slice(-4),percent=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(n)+'%';
function highlight(index,winner=false){if(active>=0)cards[active]?.classList.remove('active');active=index;cards[index]?.classList.add(winner?'winner':'active')}
function paint(rows,probabilities,profiles=[]){
 const mapped=new Map(profiles.filter(p=>/^0x[0-9a-f]{40}$/i.test(p?.address)).map(p=>[p.address.toLowerCase(),p]));
 $('draw-candidates').replaceChildren();cards.length=0;names.length=0;
 for(const [i,row] of rows.entries()){
  const card=document.createElement('li');card.className='candidate';card.dataset.wallet=row.address;
  const meta=document.createElement('div');meta.className='card-meta';const rank=document.createElement('span');rank.className='card-rank';rank.textContent='#'+String(row.rank).padStart(3,'0');const chance=document.createElement('span');chance.className='card-chance';chance.textContent=percent(probabilities[i]);meta.append(rank,chance);
  const name=document.createElement('strong');name.className='candidate-name';name.textContent=participantName(row,mapped.get(row.address));names.push(name.textContent);
  const wallet=document.createElement('span');wallet.className='candidate-wallet';wallet.textContent=short(row.address);wallet.title=row.address;wallet.hidden=name.textContent===short(row.address);
  card.append(meta,name,wallet);$('draw-candidates').append(card);cards.push(card);
 }
}
async function profiles(rows){try{const r=await fetch('/api/profile/lookup',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({addresses:rows.map(r=>r.address)}),signal:AbortSignal.timeout(5000)});if(!r.ok)return [];const p=await r.json();return Array.isArray(p.profiles)?p.profiles:[]}catch{return []}}
async function load(){
 try{
  const r=await fetch('/api/roar/draw',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Proof unavailable');const p=await r.json();
  if(p.status==='PENDING'){$('draw-title').textContent='THE PRIDE IS GATHERING';$('draw-play').textContent='RESULTS PENDING';$('draw-state').textContent='Waiting for the closed event';return}
  const result=await verifyPublicDraw(p);evidence=p;verified=result;
  paint(p.final.ranking,p.probabilitiesPercent,await profiles(p.final.ranking));
  const first=new Date(p.final.eventStart*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'}),last=new Date(p.final.snapshotTimestamp*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  $('draw-event').textContent=`${first} — ${last} · UTC`;$('draw-play').disabled=false;$('draw-play').textContent='WATCH THE FINAL ROAR';$('draw-state').textContent='Ready when you are';
  const chain=chainReceiptUrl(p.onchain);if(chain){$('draw-chain-proof').href=chain;$('draw-chain-proof').hidden=false;$('draw-chain-pending').hidden=true}
 }catch{$('draw-title').textContent='REVEAL PAUSED';$('draw-play').textContent='TRY AGAIN LATER';$('draw-state').textContent='Verified result unavailable'}
}
function visible(){if(!document.hidden)return Promise.resolve();return new Promise(resolve=>{const check=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',check);resolve()}};document.addEventListener('visibilitychange',check)})}
async function play(){
 if(!verified||playing)return;playing=true;$('draw-play').disabled=true;document.querySelector('.reveal-stage').classList.remove('finished');for(const card of cards)card.classList.remove('winner','active');active=-1;
 $('draw-kicker').textContent='THE PRIDE IS WATCHING';$('draw-title').textContent='LET THE ROAR BEGIN';$('draw-wallet').textContent='';$('draw-state').textContent='The reveal is in motion';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?3000:15000,offset=parseInt(evidence.draw.randomness.slice(0,4),16)%100;
 try{
  await new Promise(resolve=>{let start;function frame(now){if(start===undefined)start=now;const view=revealFrame(now-start,duration,offset);$('draw-progress').style.width=view.progress*100+'%';if(view.done){resolve();return}if(!reduced&&view.index!==active){highlight(view.index);$('draw-title').textContent=names[view.index];$('draw-wallet').textContent=short(evidence.final.ranking[view.index].address)}requestAnimationFrame(frame)}requestAnimationFrame(frame)});
  await visible();const row=evidence.final.ranking[verified.rank-1],name=names[verified.rank-1];highlight(verified.rank-1,true);
  $('draw-kicker').textContent='THE WINNER';$('draw-title').textContent=name;$('draw-wallet').textContent=row.address;$('draw-state').textContent='FINAL RANK #'+String(verified.rank).padStart(3,'0')+' · '+percent(evidence.probabilitiesPercent[verified.rank-1]);
  document.querySelector('.reveal-stage').classList.add('finished');$('draw-play').textContent='WATCH AGAIN';
 }catch{$('draw-state').textContent='Playback interrupted · result unchanged';$('draw-play').textContent='WATCH AGAIN'}finally{playing=false;$('draw-play').disabled=false}
}
$('draw-play').addEventListener('click',play);load();
