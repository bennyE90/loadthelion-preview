import {BOOST_SECONDS,eventStart,movements,formatAmount,formatBoost} from './roar-data.mjs?v=20261017-boost1';
import {createRoarFeed} from './roar-feed.mjs?v=20261017-live1';
import {snapshotStatus} from './roar-status.mjs?v=20261017-close1';
import {validatePrice,usdValue} from './roar-usd.mjs?v=20261017-usd1';
const feed=createRoarFeed();
let marketQuote=null,priceBusy=false,priceFailed=false,valuationKey='';
const root=document.getElementById('roar-rows'),more=document.getElementById('roar-show-more'),count=document.getElementById('roar-count'),status=document.getElementById('roar-data-status');
let odds=null;
async function loadOdds(){
 try{
  const response=await fetch('probabilities.json?v=20261017-chance1',{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Chance table unavailable');
  const {probabilitiesPercent:values}=await response.json();
  if(!Array.isArray(values)||values.length!==100||values.some((x,i)=>!Number.isFinite(x)||x<=0||(i&&x>=values[i-1]))||Math.abs(values.reduce((a,b)=>a+b,0)-100)>1e-9)throw Error('Invalid chance table');
  odds=values;
 }catch{/* Missing weights must not prevent the verified ranking or timer from loading. */}
 render(current,current?.dayStartSnapshot);
}
const chanceFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});
const less=document.getElementById('roar-show-less');
let visible=10,current=null,busy=false,feedState='unavailable';
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
  const usd=cell('roar-usd','— USD');usd.dataset.balanceRaw=x.balanceRaw||'';amount.append(usd);
  const boost=cell('roar-boost','');const pct=cell('roar-boost-pct',snapshot?formatBoost(x.boostPercent):'—');const track=document.createElement('div');track.className='roar-boost-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label',snapshot?'ROAR BOOST':'ROAR BOOST waiting for verified data');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','200');if(snapshot){track.setAttribute('aria-valuenow',x.boostPercent.toFixed(1));track.setAttribute('aria-valuetext',formatBoost(x.boostPercent))}const fill=document.createElement('i');fill.style.width=(snapshot?x.boostPercent/2:0)+'%';track.append(fill);boost.append(pct,track);
  const points=cell('roar-points',snapshot?formatAmount(x.pointsNumerator,snapshot.decimals,BigInt(BOOST_SECONDS)):'—');const chance=cell('roar-chance',odds?chanceFormat.format(odds[x.rank-1])+'%':'—');chance.title=odds?'Confirmed weighting for rank '+x.rank+' in the full 100-wallet draw; display rounded, original precision preserved':'Chance table unavailable · no probability estimated';
  row.append(rank,wallet,amount,boost,points,chance);root.append(row);
 }
 show();valuationKey='';updateMarket();
}
function show(){const total=root.children.length;[...root.children].forEach((row,i)=>{row.hidden=i>=visible});count.textContent='Showing '+Math.min(visible,total)+' of '+total+(current?' verified ULTON test positions':' reserved positions · No live ranking');less.hidden=visible<=10;more.hidden=visible>=total;more.textContent='SHOW MORE · NEXT '+Math.min(10,Math.max(0,total-visible))}
less.addEventListener('click',()=>{visible=10;show();const first=root.querySelector('.rank-row');first?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});more.focus({preventScroll:true})});
more.addEventListener('click',()=>{visible=Math.min(100,visible+10);show()});render(null,null);
async function refresh(){
 if(busy)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const result=await feed.read(controller.signal),next=result.snapshot;
  feedState=result.state;
  if(!next){updateStatus();return}
  if(!current||next.snapshotTimestamp!==current.snapshotTimestamp||next.snapshotBlock!==current.snapshotBlock){current=next;render(current,next.dayStartSnapshot)}
  const eligible=document.getElementById('roar-eligible-count');if(eligible)eligible.textContent=String(next.eligibleWallets??next.ranking.length);
  updateStatus();
 }finally{clearTimeout(timer);busy=false}
}
loadOdds();refresh();setInterval(()=>{if(!document.hidden)refresh()},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

function updateStatus(){
 const result=snapshotStatus(current,feedState);
 if(status){status.textContent=result.text;status.dataset.delayed=String(result.delayed)}
 return result;
}
function updateCountdown(){
 updateMarket();
 const now=Math.floor(Date.now()/1000),start=current?current.eventStart:eventStart(now),end=start+7*86400;
 let remaining=Math.max(0,end-now);
 for(const [id,seconds] of [['roar-days',86400],['roar-hours',3600],['roar-minutes',60],['roar-seconds',1]]){const el=document.getElementById(id);if(el)el.textContent=String(Math.floor(remaining/seconds)).padStart(2,'0');remaining%=seconds}
 document.getElementById('roar-clock-mode').textContent=updateStatus().mode;
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

function updateMarket(){
 const price=document.getElementById('roar-token-price'),info=document.getElementById('roar-price-status');
 let valid=null;try{valid=validatePrice(marketQuote)}catch{/* Expired prices are hidden, never converted to zero. */}
 if(price)price.textContent=valid?'$'+valid.priceUsd:'—';
 if(info)info.textContent=valid?((priceFailed||valid.status==='stale'?'Last available quote':'DEX Screener quote')+' · checked '+new Date(valid.observedAt*1000).toISOString().slice(11,19)+' UTC · '+Math.max(0,Math.floor(Date.now()/1000)-valid.observedAt)+'s ago'):'Price unavailable · USD estimates paused';
 const key=String(current?.snapshotBlock)+':'+(valid?.priceUsd||'unavailable');
 if(key!==valuationKey){for(const el of root.querySelectorAll('.roar-usd'))el.textContent=valid&&current?('≈ '+usdValue(el.dataset.balanceRaw,current.decimals,valid.priceUsd)):'— USD';valuationKey=key}
}
async function refreshMarket(){
 if(priceBusy)return;priceBusy=true;
 try{
  const response=await fetch('/api/roar/price',{credentials:'same-origin',cache:'no-cache',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Quote unavailable');
  const next=validatePrice(await response.json());
  if(marketQuote&&next.observedAt<marketQuote.observedAt)throw Error('Older quote');
  marketQuote=next;priceFailed=false;
 }catch{priceFailed=true}finally{priceBusy=false;updateMarket()}
}
refreshMarket();setInterval(()=>{if(!document.hidden)refreshMarket()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMarket()});
