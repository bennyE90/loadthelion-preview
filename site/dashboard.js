import {MARKET} from './market-config.mjs';
import {validatePrice} from './roar-usd.mjs';
import {verifiedHolders} from './market-holders.mjs';
const el=id=>document.getElementById(id),money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2});
el('market-symbol').textContent=MARKET.symbol+' / USD';el('market-contract').textContent=MARKET.token;
el('market-explorer').href='https://explorer.cronos.org/address/'+MARKET.token;
el('market-chart').href='https://dexscreener.com/'+MARKET.chainSlug+'/'+MARKET.pair;
let quote=null,busy=false,failed=false,holders=null,holderBusy=false,holderFailed=false;
function render(){
 let current=null;try{current=validatePrice(quote)}catch{}
 el('market-price').textContent=current?'$'+current.priceUsd:'—';
 for(const [id,key] of [['market-cap','marketCapUsd'],['market-liquidity','liquidityUsd'],['market-volume','volume24hUsd']])el(id).textContent=current&&typeof current[key]==='number'&&Number.isFinite(current[key])&&current[key]>=0?money.format(current[key]):'—';
 const change=current?.change24h;el('market-change').textContent=typeof change==='number'&&Number.isFinite(change)?(change>0?'+':'')+change.toFixed(2)+'%':'—';el('market-change').className=typeof change==='number'?(change>0?'positive':change<0?'negative':''):'';
 el('market-holders').textContent=holders?holders.count.toLocaleString('en-US'):'—';
 const age=holders?Math.max(0,Math.floor((Date.now()/1000-holders.at)/60)):0;
 el('market-holder-status').textContent=holders?((holderFailed?'Update unavailable · ':age>30?'Update delayed · ':'')+'Snapshot '+new Date(holders.at*1000).toISOString().slice(11,19)+' UTC · '+age+' min old'):'Verified holder snapshot unavailable';
 el('market-status').textContent=current?((failed||current.status==='stale'?'Last available quote':'DEX Screener quote')+' · checked '+new Date(current.observedAt*1000).toISOString().replace('T',' ').replace('.000Z',' UTC')+' · '+Math.max(0,Math.floor(Date.now()/1000)-current.observedAt)+'s ago'):'Market data unavailable · waiting for a valid quote';
}
async function refresh(){if(busy)return;busy=true;try{const r=await fetch('/api/roar/price',{credentials:'same-origin',cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Unavailable');const next=validatePrice(await r.json());if(quote&&next.observedAt<quote.observedAt)throw Error('Older quote');quote=next;failed=false}catch{failed=true}finally{busy=false;render()}}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);setInterval(render,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
async function refreshHolders(){if(holderBusy)return;holderBusy=true;try{const r=await fetch('/api/roar/snapshot',{credentials:'same-origin',cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Unavailable');const next=verifiedHolders(await r.json());if(holders&&(next.block<holders.block||next.at<holders.at||next.block===holders.block&&next.count!==holders.count))throw Error('Conflicting holder snapshot');holders=next;holderFailed=false}catch{holderFailed=true}finally{holderBusy=false;render()}}
refreshHolders();setInterval(()=>{if(!document.hidden)refreshHolders()},300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHolders()});
