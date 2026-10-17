import {BOOST_SECONDS,verifySnapshot,movements,formatAmount,formatBoost} from './roar-data.mjs?v=20261017-boost1';
const root=document.getElementById('roar-rows'),more=document.getElementById('roar-show-more'),count=document.getElementById('roar-count'),status=document.getElementById('roar-data-status');
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
  const points=cell('roar-points',snapshot?formatAmount(x.pointsNumerator,snapshot.decimals,BigInt(BOOST_SECONDS)):'—');const chance=cell('roar-chance','—');chance.title='Draw percentages pending final confirmation';
  row.append(rank,wallet,amount,boost,points,chance);root.append(row);
 }
 show();
}
function show(){const total=root.children.length;[...root.children].forEach((row,i)=>{row.hidden=i>=visible});count.textContent='Showing '+Math.min(visible,total)+' of '+total+(current?' verified positions':' reserved positions · No live ranking');more.hidden=visible>=total;more.textContent='SHOW MORE · NEXT '+Math.min(10,Math.max(0,total-visible))}
more.addEventListener('click',()=>{visible=Math.min(100,visible+10);show()});render(null,null);
async function refresh(){
 if(busy)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch('roar-snapshot.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Snapshot unavailable');const payload=await response.json();
  if(payload.status==='awaiting-data'){if(status)status.textContent=current?'Update unavailable · retaining last verified snapshot':'Waiting for verified snapshots · movement arrows compare with the verified 00:00 UTC leaderboard';return}
  const next=verifySnapshot(payload);if(current&&(next.snapshotTimestamp<current.snapshotTimestamp||next.snapshotBlock<current.snapshotBlock))throw Error('Older snapshot rejected');
  if(current&&next.snapshotTimestamp===current.snapshotTimestamp&&next.snapshotBlock===current.snapshotBlock)return;
  current=next;render(current,payload.dayStartSnapshot);if(status)status.textContent='Verified snapshot · Block '+next.snapshotBlock.toLocaleString('en-US')+' · '+new Date(next.snapshotTimestamp*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
 }catch(e){if(status)status.textContent=current?'Update unavailable · retaining last verified snapshot':'Verified snapshot unavailable · no points or movement data displayed'}finally{clearTimeout(timer);busy=false}
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
