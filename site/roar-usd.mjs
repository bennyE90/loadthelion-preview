const usdIntegerFormat=new Intl.NumberFormat('en-US');
import {MARKET} from './market-config.mjs';
export function validatePrice(quote,now=Math.floor(Date.now()/1000)){
 if(!quote||!['ok','stale'].includes(quote.status)||quote.chainId!==MARKET.chainId||quote.token!==MARKET.token||quote.pair!==MARKET.pair||quote.currency!=='USD'||quote.source!=='DEX Screener'||!Number.isSafeInteger(quote.observedAt)||quote.observedAt>now+30||now-quote.observedAt>600||typeof quote.priceUsd!=='string'||quote.priceUsd.length>62||!/^\d{1,24}(?:\.\d{1,36})?$/.test(quote.priceUsd)||Number(quote.priceUsd)<=0)throw Error('Invalid or expired USD quote');
 return quote;
}
// Keep token quantities and the quoted decimal exact until USD-cent rounding.
export function usdValue(balanceRaw,decimals,priceUsd){
 if(typeof balanceRaw!=='string'||!/^\d{1,100}$/.test(balanceRaw)||!Number.isInteger(decimals)||decimals<0||decimals>36||typeof priceUsd!=='string'||!/^\d{1,24}(?:\.\d{1,36})?$/.test(priceUsd))throw Error('Invalid valuation');
 const [whole,fraction='']=priceUsd.split('.'),denominator=10n**BigInt(decimals+fraction.length);
 const numerator=BigInt(balanceRaw)*BigInt(whole+fraction)*100n;
 const cents=(numerator+denominator/2n)/denominator;
 if(cents===0n&&numerator>0n)return '<$0.01';
 return '$'+usdIntegerFormat.format(cents/100n)+'.'+String(cents%100n).padStart(2,'0');
}
