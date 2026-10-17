import {BOOST_SECONDS,eventStart,verifySnapshot,movements,formatAmount,formatBoost} from './roar-data.mjs?v=20261017-boost1';
const root=document.getElementById('roar-rows'),more=document.getElementById('roar-show-more'),count=document.getElementById('roar-count'),status=document.getElementById('roar-data-status');
const oddsResponse=await fetch('probabilities.json?v=20261017-chance1');
if(!oddsResponse.ok)throw Error('Chance table unavailable');
const {probabilitiesPercent:odds}=await oddsResponse.json();
if(!Array.isArray(odds)||odds.length!==100||odds.some((x,i)=>!Number.isFinite(x)||x<=0||(i&&x>=odds[i-1]))||Math.abs(odds.reduce((a,b)=>a+b,0)-100)>1e-9)throw Error('Invalid chance table');
const chanceFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});
const less=document.getElementById('roar-show-less');
let visible=10,current=null,busy=false;
function cell(cls,text){const el=document.createElement('span');el.className=cls;el.textContent=text;return el}
function render(snapshot,baseline){
 const rows=snapshot?.ranking||Array.from({length:100},(_,i)=>({rank:i+1}));
 const changes=snapshot?movements(snapshot,baseline):new Map();root.replaceChildren();
 for(const x of rows){
  const row=document.createElement('div');row.className='rank-row'+(x.rank<=10?' top-ten':'')+(x.rank<=3?' top-three':'');
  const rank=cell('rank '+(x.rank===1?'gold':x.rank===2?'silver':x.rank===3?'bronze':'red'),'#'+String(x.rank).padStart(3,'0'));
  const change=changes.get(x.address);const move=cell('roar-movement '+(change?.type||'unknown'),change?.text||'—');move.setAttribute('aria-label',change?.label||'No verified 00:00 UTC baseline');rank.append(move);
  const wallet=cell('roar-name',x.address?'Holder '+String(x.rank).padStart(3,'0'):'Awaiting launch');const hint=cell('roar-address',x.address?x.address.slice(0,6)+'…'+x.address.slice(-4):'Reserved position');if(x.address)wallet.title=x.address;wallet.append(hint);
  const amount=cell('roar-amount',snapshot?formatAmount(x.balanceRaw,snapshot.decimals):'—');
  const boost=cell('roar-boost','');const pct=cell('roar-boost-pct',snapshot?formatBoost(x.boostPercent):'—');const track=document.createElement('div');track.className='roar-boost-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label',snapshot?'ROAR BOOST':'ROAR BOOST waiting for verified data');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','200');if(snapshot){track.setAttribute('aria-valuenow',x.boostPercent.toFixed(1));track.setAttribute('aria-valuetext',formatBoost(x.boostPercent))}const fill=document.createElement('i');fill.style.width=(snapshot?x.boostPercent/2:0)+'%';track.append(fill);boost.append(pct,track);
  const points=cell('roar-points',snapshot?formatAmount(x.pointsNumerator,snapshot.decimals,BigInt(BOOST_SECONDS)):'—');const chance=cell('roar-chance',chanceFormat.format(odds[x.rank-1])+'%');chance.title='Confirmed weighting for rank '+x.rank+' in the full 100-wallet draw; display rounded, original precision preserved';
  row.append(rank,wallet,amount,boost,points,chance);root.append(row);
 }
 show();
}
function show(){const total=root.children.length;[...root.children].forEach((row,i)=>{row.hidden=i>=visible});count.textContent='Showing '+Math.min(visible,total)+' of '+total+(current?' verified ULTON test positions':' reserved positions · No live ranking');less.hidden=visible<=10;more.hidden=visible>=total;more.textContent='SHOW MORE · NEXT '+Math.min(10,Math.max(0,total-visible))}
less.addEventListener('click',()=>{visible=10;show();const first=root.querySelector('.rank-row');first?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});more.focus({preventScroll:true})});
more.addEventListener('click',()=>{visible=Math.min(100,visible+10);show()});render(null,null);
async function refresh(){
 if(busy)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch('roar-snapshot.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Snapshot unavailable');const payload=await response.json();
  if(payload.status==='awaiting-data'){if(status)status.textContent=current?'Update unavailable · retaining last verified snapshot':'Waiting for verified snapshots · movement arrows compare with the verified 00:00 UTC leaderboard';return}
  const next=verifySnapshot(payload);if(current&&(next.snapshotTimestamp<current.snapshotTimestamp||next.snapshotBlock<current.snapshotBlock))throw Error('Older snapshot rejected');
  if(current&&next.snapshotTimestamp===current.snapshotTimestamp&&next.snapshotBlock===current.snapshotBlock)return;
  current=next;render(current,payload.dayStartSnapshot);const eligible=document.getElementById('roar-eligible-count');if(eligible)eligible.textContent=String(next.eligibleWallets??next.ranking.length);if(status)status.textContent='ULTON TEST · Verified snapshot · Block '+next.snapshotBlock.toLocaleString('en-US')+' · '+new Date(next.snapshotTimestamp*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
 }catch(e){if(status)status.textContent=current?'Update unavailable · retaining last verified snapshot':'Verified snapshot unavailable · no points or movement data displayed'}finally{clearTimeout(timer);busy=false}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

function updateCountdown(){
 const now=Math.floor(Date.now()/1000),start=current?current.eventStart:eventStart(now),end=start+7*86400;
 let remaining=Math.max(0,end-now);
 for(const [id,seconds] of [['roar-days',86400],['roar-hours',3600],['roar-minutes',60],['roar-seconds',1]]){const el=document.getElementById(id);if(el)el.textContent=String(Math.floor(remaining/seconds)).padStart(2,'0');remaining%=seconds}
 document.getElementById('roar-clock-mode').textContent=current?(now>=end?'EVENT CLOSED':'ULTON TEST · WEEKLY UTC'):'WEEKLY TIMER · TEST';
 const close=new Date((end-1)*1000);
 document.getElementById('roar-clock-deadline').textContent='ENDS '+close.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).toUpperCase()+' · 23:59:59 UTC'+(current?'':' · PRE-LAUNCH PREVIEW');
}
updateCountdown();setInterval(updateCountdown,1000);

const profileRoot=document.getElementById('roar-rows');
async function hydrateProfiles(){
 const wallets=[...profileRoot.querySelectorAll('.roar-name[title]')].filter(w=>/^0x[a-f0-9]{40}$/i.test(w.title));
 if(!wallets.length)return;
 try{
  const response=await fetch('/api/profile/lookup',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({addresses:wallets.map(w=>w.title)})});
  if(!response.ok)return;
  const data=await response.json();if(!Array.isArray(data.profiles))return;
  const profiles=new Map(data.profiles.filter(p=>/^0x[a-f0-9]{40}$/i.test(p?.address)).map(p=>[p.address.toLowerCase(),p]));
  for(const wallet of wallets){if(!profileRoot.contains(wallet))continue;const p=profiles.get(wallet.title.toLowerCase());if(!p)continue;
   if(typeof p.nickname==='string'&&p.nickname.length<=48&&p.nickname&&wallet.firstChild?.nodeType===3)wallet.firstChild.nodeValue=p.nickname;
   if(p.hasAvatar&&!wallet.querySelector('img')){const image=document.createElement('img');image.alt='';image.width=34;image.height=34;image.loading='lazy';image.src='/api/profile/'+encodeURIComponent(p.address.toLowerCase())+'/avatar';image.style.cssText='border-radius:50%;object-fit:cover;float:left;margin:0 9px 4px 0';image.addEventListener('error',()=>image.remove(),{once:true});wallet.prepend(image)}
  }
 }catch{/* Wallet addresses remain visible when profile service is unavailable. */}
}
if(profileRoot){hydrateProfiles();new MutationObserver(hydrateProfiles).observe(profileRoot,{childList:true})}
