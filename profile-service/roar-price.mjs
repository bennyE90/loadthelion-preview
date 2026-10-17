export const PRICE_TOKEN='0x7ebfd1b08e1d7413d6d8fe6c3eef28945ce776ef';
export const PRICE_POOL='0xa3dc34f3c56157e35bd0e20d8800449dacdda2a5';
export const PRICE_URL='https://api.dexscreener.com/latest/dex/pairs/cronos/'+PRICE_POOL;
const decimal=value=>typeof value==='string'&&value.length<=62&&/^\d{1,24}(?:\.\d{1,36})?$/.test(value)&&Number.isFinite(Number(value))&&Number(value)>0;
export function parseMarketQuote(data,observedAt){
 const pairs=data?.pairs;
 if(!Array.isArray(pairs))throw Error('Missing pair');
 const pair=pairs.find(p=>p?.chainId==='cronos'&&p.pairAddress?.toLowerCase()===PRICE_POOL&&p.baseToken?.address?.toLowerCase()===PRICE_TOKEN);
 if(!pair||!decimal(pair.priceUsd))throw Error('Invalid token price');
 return {chainId:25,token:PRICE_TOKEN,pair:PRICE_POOL,currency:'USD',priceUsd:pair.priceUsd,source:'DEX Screener',observedAt};
}
export function createPriceService({fetcher=fetch,now=()=>Date.now()}={}){
 let quote=null,inflight=null,nextCheck=0;
 async function refresh(){
  try{
   const response=await fetcher(PRICE_URL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000),redirect:'error'});
   if(!response.ok)throw Error('Price provider unavailable');
   const next=parseMarketQuote(await response.json(),Math.floor(now()/1000));
   quote=next;
  }catch{/* A failed lookup cannot relabel an old quote as newly observed. */}
  finally{nextCheck=now()+60000;inflight=null}
 }
 return async request=>{
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  if(now()>=nextCheck){if(!inflight)inflight=refresh();await inflight}
  const age=quote?Math.max(0,Math.floor(now()/1000)-quote.observedAt):Infinity;
  const data=age<=600?{...quote,status:age<=120?'ok':'stale'}:{status:'unavailable',currency:'USD',token:PRICE_TOKEN};
  return new Response(request.method==='HEAD'?null:JSON.stringify(data),{status:data.status==='unavailable'?503:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=15','Netlify-CDN-Cache-Control':'public, s-maxage=30','X-Content-Type-Options':'nosniff'}});
 };
}
