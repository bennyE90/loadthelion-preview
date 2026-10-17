(()=>{
'use strict';
const btn=document.getElementById('ultcrow-refresh'),status=document.getElementById('ultcrow-status'),root=document.getElementById('roar-rows');
const remote='https://raw.githubusercontent.com/bennyE90/loadthelion-indexer/test-ultcrow/tests/ultcrow-top100-snapshot.json';
const local='ultcrow-snapshot.json';
let current=null,source='';
const short=a=>a.slice(0,6)+'…'+a.slice(-4);
const format=(raw,decimals=18)=>{const n=BigInt(raw),base=10n**BigInt(decimals),integer=n/base,frac=n%base;return Number(integer).toLocaleString('en-US')+(frac===0n?'':'.'+String(frac).padStart(decimals,'0').slice(0,2));};
function valid(d){return d&&d.token?.toLowerCase()==='0xc863041d31b4da4a156a07682e3ea04070121b32'&&d.status==='historical-verified'&&d.isLive===false&&Number.isSafeInteger(d.snapshotBlock)&&Array.isArray(d.ranking)&&d.ranking.length<=100&&d.ranking.every((x,i)=>x.rank===i+1&&/^0x[0-9a-f]{40}$/i.test(x.address)&&/^\d+$/.test(x.balanceRaw));}
function render(d,label){
 if(!valid(d))throw Error('Invalid verified test snapshot');
 if(current&&d.snapshotBlock<current.snapshotBlock)throw Error('Older snapshot ignored');
 if(current&&d.snapshotBlock===current.snapshotBlock){status.textContent=d.ranking.length+' verified balances · Block '+d.snapshotBlock.toLocaleString()+' · No new snapshot · checked '+new Date().toLocaleTimeString();return;}
 current=d;source=label;root.replaceChildren();
 // Adaptive test odds: a smooth ranking curve, not fixed tier budgets for N<100.
 // N=100 retains the original 60/30/10 benchmark. At N=52 the top rank
 // targets 5%, without discontinuities at rank 10/11 or 50/51.
 const activeCount=d.ranking.length;
 const normalize=w=>{const total=w.reduce((a,b)=>a+b,0);return w.map(v=>v/total);};
 const topAt=(n,k)=>{const w=Array.from({length:n},(_,i)=>Math.exp(-k*i));return normalize(w)[0];};
 let lo=0,hi=2;
 for(let j=0;j<80;j++){const mid=(lo+hi)/2;if(topAt(52,mid)<.05)lo=mid;else hi=mid;}
 const k52=(lo+hi)/2;
 const smooth52=Array.from({length:activeCount},(_,i)=>Math.exp(-k52*i));
 // Reference 100-holder smooth curve, numerically fitted to 60/30/10.
 const reference=()=>{
  const n=100;
  const shares=(k,c)=>{
   const w=normalize(Array.from({length:n},(_,i)=>Math.exp(-k*i)+c));
   return [w.slice(0,10).reduce((a,b)=>a+b,0),w.slice(10,50).reduce((a,b)=>a+b,0)];
  };
  let k=.1,c=.015;
  for(let j=0;j<100;j++){
   const v=shares(k,c),e0=v[0]-.60,e1=v[1]-.30;
   if(Math.max(Math.abs(e0),Math.abs(e1))<1e-11)break;
   const h=1e-5,vk=shares(k+h,c),vc=shares(k,c+h);
   const a=(vk[0]-v[0])/h,b=(vc[0]-v[0])/h,cc=(vk[1]-v[1])/h,dd=(vc[1]-v[1])/h,det=a*dd-b*cc;
   if(Math.abs(det)<1e-12)break;
   const dk=(e0*dd-b*e1)/det,dc=(a*e1-e0*cc)/det;
   let step=1,ok=false;
   while(step>1e-7){const nk=k-step*dk,nc=c-step*dc;
    if(nk>0&&nk<2&&nc>=0&&nc<5){const nv=shares(nk,nc);if(Math.abs(nv[0]-.60)+Math.abs(nv[1]-.30)<Math.abs(e0)+Math.abs(e1)){k=nk;c=nc;ok=true;break;}}
    step/=2;
   }
   if(!ok)break;
  }
  const v=shares(k,c);
  if(Math.abs(v[0]-.60)>.001||Math.abs(v[1]-.30)>.001)throw Error('100-holder benchmark fit failed');
  return Array.from({length:activeCount},(_,i)=>Math.exp(-k*i)+c);
 };
 // For N<=52 use the 52-holder calibrated curve, renormalized to the
 // actual active wallets. From 53 to 100 transition continuously toward
 // the full 100-holder reference distribution.
 const mix=Math.max(0,Math.min(1,(activeCount-52)/48));
 const w100=reference();
 const w52=normalize(smooth52),wFull=normalize(w100);
 const weights=w52.map((v,i)=>(1-mix)*v+mix*wFull[i]);
 const odds=normalize(weights).map(v=>100*v);
 for(let i=1;i<odds.length;i++)if(!(odds[i-1]>odds[i]))throw Error('Chance must decrease strictly by rank');
 const exactTierFit=activeCount===100;

 for(let i=0;i<100;i++){
  const x=d.ranking[i],row=document.createElement('div');row.className='rank-row'+(i<3?' top-three':'');
  const rank=document.createElement('span');rank.className='rank '+(i===0?'gold':i===1?'silver':i===2?'bronze':'red');rank.textContent='#'+String(i+1).padStart(3,'0');row.append(rank);
  const who=document.createElement('span');who.className='roar-name';who.textContent=x?('Holder '+String(i+1).padStart(3,'0')):'—';
  const address=document.createElement('span');address.className='roar-address';address.textContent=x?short(x.address):'No holder at snapshot';if(x){who.title=x.address;address.title=x.address;}who.append(address);row.append(who);
  const amount=document.createElement('span');amount.className='roar-amount';amount.textContent=x?format(x.balanceRaw,d.decimals===undefined?18:d.decimals):'—';row.append(amount);
  const usd=document.createElement('span');usd.className='roar-value';usd.textContent='—';usd.title='No verified USD price feed';row.append(usd);
  const chance=document.createElement('span');chance.className='roar-chance';
  if(x){
   const pct=document.createElement('span');pct.className='roar-pct';
   pct.textContent=odds[i].toFixed(4)+'%';
   pct.title='TEST adaptive odds: '+(exactTierFit?'100-holder 60/30/10 benchmark':'smooth redistribution for '+activeCount+' holders')+'; not official contest odds';
   const bar=document.createElement('div');bar.className='roar-meter';
   const fill=document.createElement('i');fill.style.width=Math.min(100,odds[i]*10)+'%';bar.append(fill);
   chance.append(pct,bar);
  }else chance.textContent='—';
  row.append(chance);root.append(row);
 }
 status.textContent=d.ranking.length+' verified balances · Block '+d.snapshotBlock.toLocaleString()+' · '+label+' · Historical, NOT live · Odds TEST normalized over '+activeCount+' active positions · checked '+new Date().toLocaleTimeString();
}
async function fetchSnapshot(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
let busy=false;
async function refresh(){if(busy)return;busy=true;if(btn)btn.disabled=true;try{const d=await fetchSnapshot(remote);render(d,'GitHub verified snapshot');}catch(e){if(!current){try{render(await fetchSnapshot(local),'Local verified fallback');}catch(err){status.textContent='Snapshot unavailable: '+err.message;}}else{status.textContent='GitHub unavailable or unchanged · Keeping verified block '+current.snapshotBlock.toLocaleString()+' · checked '+new Date().toLocaleTimeString();}}finally{busy=false;if(btn)btn.disabled=false;}}
btn?.addEventListener('click',refresh);refresh();setInterval(()=>{if(!document.hidden)refresh();},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();