import {isIP} from 'node:net';
export function canonicalIP(value){
 if(typeof value!=='string'||value.includes('%'))throw Error('Invalid client address');
 const address=value.trim(),family=isIP(address);
 if(family===4)return address;
 if(family!==6)throw Error('Invalid client address');
 const canonical=new URL('http://['+address+']/').hostname.slice(1,-1);
 const mapped=canonical.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
 if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return [high>>8,high&255,low>>8,low&255].join('.')}
 return canonical;
}
export function createClientAddress(trustedProxies=''){
 if(typeof trustedProxies!=='string')throw Error('Invalid trusted proxies');
 const trusted=new Set(trustedProxies.trim()?trustedProxies.split(',').map(canonicalIP):[]);
 return req=>{
  const peer=canonicalIP(req.socket.remoteAddress);
  if(!trusted.has(peer))return peer;
  // Only a configured peer may supply one IP; it must overwrite this header.
  return canonicalIP(req.headers['x-forwarded-for']);
 };
}
export function createRateLimit({now=()=>Date.now(),limit=40,windowMs=60000}={}){
 const rates=new Map();
 return key=>{
  const time=now();
  for(const [address,row] of rates)if(row.until<=time)rates.delete(address);
  let row=rates.get(key);
  if(!row){row={count:0,until:time+windowMs};rates.set(key,row)}
  if(row.count>=limit)return Math.max(1,Math.ceil((row.until-time)/1000));
  row.count++;return 0;
 };
}
