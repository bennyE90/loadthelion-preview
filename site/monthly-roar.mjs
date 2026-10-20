// USD amounts use integer millionths; never derive historical spending from today's price.
export const MONTHLY_TOKEN='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef';
export function monthWindow(at=Date.now()){
 const d=new Date(at);if(!Number.isFinite(d.getTime()))throw Error('Invalid date');
 const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;
 const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000;
 return {start,end,id:new Date(start*1000).toISOString().slice(0,7)};
}
export function usdMicros(value){
 if(typeof value!=='string'||!/^\d{1,24}(?:\.\d{1,6})?$/.test(value))throw Error('Invalid USD amount');
 const [whole,fraction='']=value.split('.');return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));
}
export function formatUsd(value){
 const n=BigInt(value),abs=n<0n?-n:n,cents=(abs%1000000n)/10000n;
 return (n<0n?'−':'')+'$'+(abs/1000000n).toLocaleString('en-US')+'.'+String(cents).padStart(2,'0');
}
export function netBuy(buys,sells,outgoing){return usdMicros(buys)-usdMicros(sells)-usdMicros(outgoing)}
// Only a complete, event-bound ULTON dataset can supply a ranking. No balance fallback.
export function verifyMonthly(data,now=Date.now()){
 const window=monthWindow(now),seconds=Math.floor(now/1000);
 if(data?.schema!==1||data.status!=='VERIFIED'||data.environment!=='ULTON_TEST'||data.token!==MONTHLY_TOKEN||data.chainId!==25||data.prizesEnabled!==false||data.eventStart!==window.start||data.eventEnd!==window.end||data.historyFrom!==window.start||data.complete!==true||data.transactionPricesVerified!==true||data.exclusionsVerified!==true||!Number.isSafeInteger(data.snapshotTimestamp)||data.snapshotTimestamp<window.start||data.snapshotTimestamp>=window.end||data.snapshotTimestamp>seconds||seconds-data.snapshotTimestamp>900||!Array.isArray(data.ranking)||data.ranking.length>10000)throw Error('Monthly transaction history unavailable');
 const seen=new Set();let previous=null;
 const ranking=data.ranking.map((r,index)=>{
  if(!/^0x[a-f0-9]{40}$/.test(r.address||'')||seen.has(r.address)||r.rank!==index+1)throw Error('Invalid monthly wallet');seen.add(r.address);
  const buys=usdMicros(r.buysUsd),sells=usdMicros(r.sellsUsd),outgoing=usdMicros(r.outgoingUsd),net=buys-sells-outgoing;
  if(!/^-?\d+$/.test(r.netUsdMicros||'')||BigInt(r.netUsdMicros)!==net||!Number.isSafeInteger(r.reachedAt)||r.reachedAt<window.start||r.reachedAt>data.snapshotTimestamp)throw Error('Invalid monthly totals');
  if(previous&&(net>previous.net||(net===previous.net&&(r.reachedAt<previous.reachedAt||(r.reachedAt===previous.reachedAt&&r.address<previous.address)))))throw Error('Invalid monthly order');
  previous={net,reachedAt:r.reachedAt,address:r.address};return {...r,buys,sells,outgoing,net};
 });return {...data,ranking};
}
