import {BOOST_SECONDS,eventStart,eventEnd,ACTIVATION,movements,formatAmount,formatBoost} from './roar-data.mjs?v=20261019-calendar2';
import {createRoarFeed} from './roar-feed.mjs?v=20261019-calendar2';
import {snapshotStatus} from './roar-status.mjs?v=20261019-calendar2';
import {validatePrice,usdValue} from './roar-usd.mjs?v=20261017-usd1';
import {rewardPoolState,allocateRewards,verifyRewardFinal,REWARD_TOKEN} from './roar-rewards.mjs?v=20261019-poolprogress1';
import {verifyRoarPreview,PREVIEW_END} from './roar-preview.mjs?v=20261019-liveboost1';
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
let rewardCells=[],finalReward=null,rewardBusy=false,preview=null;
function cell(cls,text){const el=document.createElement('span');el.className=cls;el.textContent=text;return el}
function render(snapshot,baseline){
 const simulated=preview&&snapshot?.snapshotBlock===preview.source.snapshotBlock;
 const legend=document.getElementById('roar-legend');if(simulated&&legend)legend.textContent='Simulated event: 10–19 October UTC. Opening holders are assumed active from 10 October; later verified buys and resets keep their real timestamps. ROAR BOOST grows in +0.01% steps to +250.00% in eight days. Points and ranks use the latest verified balances.';else if(legend)legend.textContent='Points = token balance × (1 + ROAR BOOST / 100). '+(snapshot&&snapshot.eventStart<ACTIVATION?'This transition event uses the archived +200% / six-day boost rules. +250% over eight days starts on 21 Oct 2026.':'ROAR BOOST grows in +0.01 percentage-point steps from 0.00% to 250.00% over eight days.')+' Arrows compare positions with 00:00 UTC. Swipe horizontally to see every column.';
 const rows=(simulated?preview.ranking:snapshot?.ranking)||Array.from({length:100},(_,i)=>({rank:i+1}));
 const changes=snapshot&&!simulated?movements(snapshot,baseline):new Map();root.replaceChildren();rewardCells=[];
 for(const x of rows){
  const row=document.createElement('div');row.className='rank-row'+(x.rank<=10?' top-ten':'')+(x.rank<=3?' top-three':'');
  const rank=cell('rank '+(x.rank===1?'gold':x.rank===2?'silver':x.rank===3?'bronze':'red'),'#'+String(x.rank).padStart(3,'0'));
  const change=changes.get(x.address);const move=cell('roar-movement '+(change?.type||'unknown'),change?.text||'—');move.setAttribute('aria-label',change?.label||'No verified 00:00 UTC baseline');rank.append(move);
  const wallet=cell('roar-name',x.address?'Holder '+String(x.rank).padStart(3,'0'):'Awaiting launch');const hint=cell('roar-address',x.address?x.address.slice(0,6)+'…'+x.address.slice(-4):'Reserved position');if(x.address)wallet.title=x.address;wallet.append(hint);
  const amount=cell('roar-amount',snapshot?formatAmount(x.balanceRaw,snapshot.decimals):'—');
  const usd=cell('roar-usd','— USD');usd.dataset.balanceRaw=x.balanceRaw||'';amount.append(usd);
  const boost=cell('roar-boost','');const pct=cell('roar-boost-pct',snapshot?formatBoost(x.boostPercent):'—');const track=document.createElement('div');track.className='roar-boost-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label',snapshot?'ROAR BOOST':'ROAR BOOST waiting for verified data');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(x.boostMaxPercent||250));if(snapshot){track.setAttribute('aria-valuenow',x.boostPercent.toFixed(2));track.setAttribute('aria-valuetext',formatBoost(x.boostPercent))}const fill=document.createElement('i');fill.style.width=(snapshot?100*x.boostPercent/x.boostMaxPercent:0)+'%';track.append(fill);boost.append(pct,track);
  const points=cell('roar-points',snapshot?formatAmount(x.pointsNumerator,snapshot.decimals,BigInt(x.pointsDenominator)):'—');const chance=cell('roar-chance',odds?chanceFormat.format(odds[x.rank-1])+'%':'—');chance.title=odds?'Confirmed weighting for rank '+x.rank+' in the full 100-wallet draw; display rounded, original precision preserved':'Chance table unavailable · no probability estimated';
  const rewards=cell('roar-reward','');const rewardAmount=cell('roar-reward-amount','—'),rewardUsd=cell('roar-reward-usd','— USD'),rewardLabel=cell('roar-reward-label','ESTIMATE · LOCKED');rewards.append(rewardAmount,rewardUsd,rewardLabel);rewardCells.push({rank:x.rank,address:x.address,amount:rewardAmount,usd:rewardUsd,label:rewardLabel});
  row.append(rank,wallet,amount,boost,points,chance,rewards);root.append(row);
 }
 show();valuationKey='';updateMarket();updateRewards();
}
function show(){const total=root.children.length;[...root.children].forEach((row,i)=>{row.hidden=i>=visible});count.textContent='Showing '+Math.min(visible,total)+' of '+total+(current?(preview?' simulated ULTON test positions':' verified ULTON test positions'):' reserved positions · No live ranking');less.hidden=visible<=10;more.hidden=visible>=total;more.textContent='SHOW MORE · NEXT '+Math.min(10,Math.max(0,total-visible))}
less.addEventListener('click',()=>{visible=10;show();const first=root.querySelector('.rank-row');first?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});more.focus({preventScroll:true})});
more.addEventListener('click',()=>{visible=Math.min(100,visible+10);show()});render(null,null);
async function refresh(){
 if(busy)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const result=await feed.read(controller.signal),next=result.snapshot;
  feedState=result.state;
  if(!next){updateStatus();return}
  if(preview&&Date.now()/1000>=preview.end){updateStatus();return}
  if(finalReward?.eventStart!==next.eventStart&&(!current||next.snapshotBlock>=current.snapshotBlock)&&( !current||next.snapshotTimestamp!==current.snapshotTimestamp||next.snapshotBlock!==current.snapshotBlock)){current=next;preview=null;render(current,next.dayStartSnapshot)}
  if(next.eventStart===1792368000&&Math.floor(Date.now()/1000)<PREVIEW_END){
   try{const response=await fetch('/api/roar/preview',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Preview unavailable');const candidate=verifyRoarPreview(await response.json());if(candidate.source.snapshotBlock>=current.snapshotBlock){preview=candidate;current=candidate.source;render(current,null)}}catch{/* Retain the verified base ranking when the simulation is unavailable. */}
  }
  const eligible=document.getElementById('roar-eligible-count');if(eligible)eligible.textContent=String(next.eligibleWallets??next.ranking.length);
  updateStatus();refreshFinalRewards();
 }finally{clearTimeout(timer);busy=false}
}
loadOdds();refresh();setInterval(()=>{if(!document.hidden)refreshFinalRewards()},60000);setInterval(()=>{if(!document.hidden)refresh()},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

function updateStatus(){
 const result=snapshotStatus(current,feedState);
 if(preview&&current){result.mode=Date.now()/1000>=preview.end?'SIMULATED EVENT · CLOSED':'ULTON TEST · SIMULATED EVENT';result.text='Simulated boost, points and ranking · Source block '+current.snapshotBlock+' · '+new Date(current.snapshotTimestamp*1000).toISOString().replace('T',' ').slice(0,19)+' UTC · Scenario: 10–19 Oct';result.delayed=false}
 if(current&&finalReward?.eventStart===current.eventStart){result.mode='CLOSED · RESULTS VERIFIED';result.text='Final Top 100 verified · Block '+current.snapshotBlock+' · Simulated rewards allocation fixed · No real payouts';result.delayed=false}
 if(status){status.textContent=result.text;status.dataset.delayed=String(result.delayed)}
 return result;
}
function updateCountdown(){
 updateMarket();updateRewards();
 const now=Math.floor(Date.now()/1000),start=current?current.eventStart:eventStart(now),end=preview?preview.end:eventEnd(start);
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
 const info=document.getElementById('roar-price-status');
 let valid=null;try{valid=validatePrice(marketQuote)}catch{/* Expired prices are hidden, never converted to zero. */}
 if(info)info.textContent=valid?((priceFailed||valid.status==='stale'?'USD estimates · last available quote':'USD estimates')+' · checked '+new Date(valid.observedAt*1000).toISOString().slice(11,19)+' UTC · '+Math.max(0,Math.floor(Date.now()/1000)-valid.observedAt)+'s ago'):'Price unavailable · USD estimates paused';
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
 }catch{priceFailed=true}finally{priceBusy=false;updateMarket();updateRewards()}
}
refreshMarket();setInterval(()=>{if(!document.hidden)refreshMarket()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMarket()});

function updateRewards(){
 const start=current?.eventStart??eventStart(Math.floor(Date.now()/1000)),state=rewardPoolState(start,Math.floor(Date.now()/1000));
 const supported=current?.token===REWARD_TOKEN&&current?.decimals===18&&state.funded;
 const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
 let quote=null;try{quote=validatePrice(marketQuote)}catch{}
 const dollars=raw=>quote?'≈ '+usdValue(String(raw),18,quote.priceUsd):'— USD';
 const progress=state.total?Number(state.emitted*10000n/state.total)/100:0;
 set('roar-pool-percent',progress.toFixed(2)+'/100%');
 const meter=document.getElementById('roar-pool-fill');if(meter)meter.style.width=progress+'%';
 const progressbar=document.getElementById('roar-pool-meter');if(progressbar){progressbar.setAttribute('aria-valuenow',progress.toFixed(2));progressbar.setAttribute('aria-valuetext',progress.toFixed(2)+'% of the event pool released')}
 const confirmed=!state.preview&&finalReward?.eventStart===start;
 const remainingSeconds=Math.max(0,state.end-Math.floor(Date.now()/1000));
 set('roar-pool-timeline',state.preview?'SIMULATED EVENT · 10–19 OCT 2026 UTC · '+(state.closed?'PREVIEW COMPLETE':Math.floor(remainingSeconds/3600)+'H '+String(Math.floor(remainingSeconds%3600/60)).padStart(2,'0')+'M REMAINING'):'Rewards follow the verified event calendar.');
 set('roar-pool-status',!supported?'Waiting for verified ULTON event data':confirmed?'FINAL ALLOCATION VERIFIED · TEST ONLY':state.closed?(state.preview?'SIMULATION COMPLETE · NO CLAIMS':'EVENT CLOSED · FINAL SNAPSHOT PENDING'):'LIVE ESTIMATES · CLAIMS LOCKED UNTIL EVENT END');
 set('roar-pool-caption',state.preview?'Rewards unlock only after event closing and final snapshot verification. Live amounts remain estimates.':state.closed?'The simulated pool is fully released. Only the verified final Top 100 fixes each allocation.':'Released evenly over this event. Estimates follow the current rank and may change.');
 let amounts=null;
 if(supported&&odds&&current.ranking.length===100)try{amounts=allocateRewards(confirmed?state.total:state.emitted,odds)}catch{}
 for(const el of rewardCells){
  const pending=state.closed&&!confirmed,raw=amounts?.[el.rank-1];
  el.amount.textContent=raw===undefined||pending?'—':formatAmount(String(raw),18)+' ULTON';
  el.usd.textContent=raw===undefined||pending?'— USD':dollars(raw);
  el.label.textContent=pending?(state.preview?'PREVIEW COMPLETE':'FINAL SNAPSHOT PENDING'):confirmed?'FINAL · TEST ALLOCATION':'ESTIMATE · LOCKED';
 }
 const now=Math.floor(Date.now()/1000);
 if(current&&!state.preview&&state.closed&&!confirmed&&!rewardBusy&&(!refreshFinalRewards.lastAttempt||now-refreshFinalRewards.lastAttempt>=60))refreshFinalRewards();
}
async function refreshFinalRewards(){
 if(!current||rewardBusy||finalReward?.eventStart===current.eventStart||Date.now()/1000<eventEnd(current.eventStart))return;
 const start=current.eventStart;if(start<1792368000||rewardPoolState(start,Math.floor(Date.now()/1000)).preview)return;
 rewardBusy=true;refreshFinalRewards.lastAttempt=Math.floor(Date.now()/1000);
 try{
  const response=await fetch('/api/roar/rewards?eventStart='+start,{cache:'no-cache',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Final rewards unavailable');
  const payload=await response.json();if(payload.status!=='FINAL')return;
  const verified=verifyRewardFinal(payload,start,Math.floor(Date.now()/1000));
  if(current.eventStart!==start)return;
  finalReward=payload;current=verified;render(current,null);updateStatus();
 }catch{/* No extrapolated or post-deadline snapshot can unlock final allocations. */}
 finally{rewardBusy=false}
}
